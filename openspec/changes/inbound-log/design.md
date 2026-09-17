## Context

See `proposal.md` for why. USB inbound already hits `DeviceSession.handleInbound` from `MidiTransport.subscribe` at construction and always grows a 40-event buffer. `BluetoothLink` can write BLE-MIDI (`encodePatch` wraps CC 0 as `80 80 …`) and both backends already enable GATT notify on open, but neither listens: web never adds `characteristicvaluechanged`, desktop `subscribe`s in Rust and drops the stream. Log is `/log` + `MidiInMonitor`; `useInboundLog` is the only reader, yet every inbound `emit()` still wakes snapshot subscribers (Connect chrome). Specs: `inbound-log` (capture only while Log is visible) and `bluetooth-link` (subscribe delivers MIDI bytes). Dump decode and `liveFromPedal` snapshot apply stay out.

## Goals / Non-Goals

**Goals:**

- `BluetoothLink` gains `subscribe`, matching the USB byte pipe. Web and desktop backends unwrap MMA BLE-MIDI and deliver MIDI messages.
- `DeviceSession` appends to the inbound log only while Log is mounted; leaving clears the buffer and stops appends.
- Same Log UI for USB and Bluetooth. Inbound never mutates `snapshot.patch`.
- Log updates do not re-render Connect/Controller snapshot listeners.

**Non-Goals:**

- Folding Bluetooth into `MidiTransport`.
- Applying inbound CC/SysEx to the live snapshot.
- Toggling GATT CCCD on every navigation (notify stays enabled for the open session).
- Adding a test runner or browser verification.

## Decisions

### 1. Subscribe on BluetoothLink, not a second MidiTransport

**Choice:** Add `subscribe(handler): () => void` to `BluetoothLink`. `DeviceSession` already subscribed to USB stays; it also subscribes to Bluetooth. `handleInbound` is shared. React still never sees bytes.

**Why:** Architecture keeps USB and Bluetooth as separate pipes (`docs/architecture.md`). Log is one session feature, not a third transport.

**Alternative:** Make Bluetooth another `MidiTransport` kind. Rejected; links stay asymmetric.

### 2. Unwrap BLE-MIDI in TypeScript, deliver MIDI to subscribers

**Choice:** Shared decoder in `src/bluetooth/` (MMA BLE-MIDI header + timestamps, running status, SysEx spanning packets). Web `characteristicvaluechanged` and desktop `ble-inbound` payloads go through it before handlers. Callers receive the same MIDI bytes USB already logs. Decoder is written from the public MMA packet format, not from a third-party editor.

**Why:** Specs require MIDI summaries, not GATT framing. USB backends already unframe host MIDI packets; BLE-MIDI timestamps are the Bluetooth equivalent. One decoder keeps web and Tauri identical.

**Alternative:** Log raw notification hex. Rejected; USB would show `CC 0 = 42` while Bluetooth showed `80 80 B0 …`. **Alternative:** Decode in Rust only. Rejected; web would still need the same code.

### 3. Capture is armed by Log mount, not by connect

**Choice:** `DeviceSession.setInboundCapture(enabled)`. `MidiInMonitor` (inside `RequirePedal`) enables on mount and disables on unmount. Disable clears the log and resets BLE-MIDI SysEx assembly in the session path that feeds the log. Default is off, including while Controller is open.

**Why:** Matches the visibility spec and avoids the current always-on 40-event buffer plus `emit()` on every USB dump. Mounting the monitor (connected Log) is the observable “user is on that page.”

**Alternative:** Keep the last 40 lines when leaving. Rejected; the request is to stop spending memory off-page, and a stale list on return is more surprising than empty. **Alternative:** Unsubscribe GATT notify when leaving. Rejected; CCCD churn on every nav is flakier than dropping bytes in session.

### 4. Split session listeners so log does not refresh chrome

**Choice:** Snapshot listeners and log listeners are separate sets. `handleInbound` notifies only log listeners. Connect chrome keeps using the snapshot subscription.

**Why:** Today one `listeners` set means every USB dump re-renders the shell. Gating capture without splitting would still thrash chrome while Log is open.

**Alternative:** Keep one listener set. Rejected; it is the leftover cost of the current log.

### 5. Desktop forwards notifications like USB inbound

**Choice:** After `peripheral.subscribe`, spawn a task on `peripheral.notifications()` and `emit("ble-inbound", value)`. Abort the task on `ble_close`. TypeScript `TauriBluetoothLink` `listen`s the same way `TauriMidiTransport` listens to `midi-inbound`. `core:event:default` already allows it.

**Why:** Matches the working USB desktop inbound pattern. No new Tauri command.

**Alternative:** Poll `read` on the characteristic. Rejected; the characteristic is notify-based (Patone GATT map).

## Risks / Trade-offs

- [BLE-MIDI SysEx split across packets is logged incomplete if the decoder is naive] → Stateful unwrap that reassembles until `F7`; reset that state on capture off and on close.
- [Desktop BlueZ notify stream never fires, same class of host issue as desktop GATT write] → Web remains the known-good inbound path on this host; desktop still implements the contract.
- [Pedal may notify while Log is closed] → Bytes are dropped at session; GATT notify stays on for the open link. Accept the radio cost to avoid CCCD flicker.
- [No browser verification in this change] → `tsc`; the user tests Log on USB and Bluetooth with a real pedal.

## Migration Plan

Additive. No stored log to migrate. Rollback is reverting the change.

## Open Questions

None for this slice.
