## Context

See `proposal.md` for why. `BluetoothLink` is discover/open/close only (`src/bluetooth/types.ts`). `ble_open` connects the peripheral and does not discover services (`src-tauri/src/ble.rs`). Web `open` calls `gatt.connect()` with no `optionalServices` (`src/bluetooth/web.ts`). `capabilitiesForLink` sets `commandToPedal: false` on Bluetooth; `DeviceSession.setPatch` throws and Controller shows “Patch control is not available over Bluetooth yet.” USB still encodes official CC 0 (`[0xB0, 0, patch]`) and `MidiTransport.send`. Pedal Bluetooth is Valeton Suite GATT, not BLE-MIDI (`docs/architecture.md`). Service/characteristic UUIDs are unknown; `bluetooth-connect` deferred that map to this encoder, from our captures, not third-party SysEx.

## Goals / Non-Goals

**Goals:**

- Real `BluetoothLink.send(bytes)` on web and desktop (not a throwing stub).
- `open` selects the control characteristic so `send` has somewhere to write.
- `DeviceSession` encodes patch recall and routes bytes by `linkMode`.
- `commandToPedal` true on Bluetooth; Controller reuses the USB patch bar.
- Discover the GATT map from Patone (desktop first) and, if needed, Valeton Suite traffic.

**Non-Goals:**

- Folding GATT into `MidiTransport` or leaking Web Bluetooth types above the link.
- Applying notifications to the session patch (`liveFromPedal` stays unused).
- A product GATT browser. Capture output is debug logs / `tauri dev` console.
- Copying framing from third-party editors.

## Decisions

### 1. Byte pipe on `BluetoothLink`; encoder stays in `DeviceSession`

**Choice:** Extend the contract to `discover` / `open` / `send` / `close`. `send(bytes)` writes those bytes to the open control characteristic. `setPatch` / `stepPatch` keep computing the patch index, then call `bluetooth.send` when `linkMode` is Bluetooth and `transport.send` when it is USB. First Bluetooth payload is the same official CC 0 frame as USB. If captures show a different frame, replace only the Bluetooth encode path in the device layer (for example `encodePatch(linkMode, patch)`), not the GATT backends.

**Why:** `docs/architecture.md` — if BLE cannot speak CC, the encoder (CC vs SysEx) is the seam. The link must not learn patch numbers.

**Alternative:** `BluetoothLink.sendPatch(n)` that owns GATT framing. Rejected; it forks protocol into the link.

**Alternative:** A throwing `send()`. Rejected; that stub was forbidden, and this change is the real encoder.

### 2. Desktop GATT map first, then lock UUIDs, then Web Bluetooth

**Choice:** Spike on desktop: `ble_open` connects, `discover_services`, and logs each service/characteristic UUID plus properties (read/write/notify). Operator captures from Patone trial writes and, if the pedal ignores CC 0, from Valeton Suite (official app) via a BLE sniffer. Record the control characteristic UUID as a constant shared by Rust and TypeScript. Web `requestDevice` then adds that UUID to `optionalServices` so `getPrimaryService` works. Do not guess UUIDs from third-party editors.

**Why:** Web Bluetooth will not expose a service unless it was listed in `optionalServices` at chooser time. `btleplug` can list everything after connect. Desktop is the only way to learn the map without already knowing it.

**Alternative:** Web-only discovery. Rejected; Chrome will hide the control service.

**Alternative:** Scan with a wildcard / all services. Rejected; Web Bluetooth has no “all services” option.

### 3. `open` binds the write characteristic; `send` only writes

**Choice:** After connect, `open` discovers services, finds the documented control characteristic, and keeps that handle until `close`. `send` fails if nothing is open. Prefer write-without-response when the characteristic allows it (command-out, lower latency); otherwise write-with-response. Write type is confirmed in the spike, not guessed here.

**Why:** Specs require send on an open session and fail when closed. Binding at `open` keeps `send` a byte write on both backends.

**Alternative:** Look up the characteristic on every `send`. Rejected; extra GATT round-trip on every patch step.

### 4. Flip `commandToPedal`; do not fork Controller

**Choice:** `capabilitiesForLink("bluetooth").commandToPedal = true`. Controller already hides the patch bar when that flag is false; it will show the same bar as USB. Snapshot still starts at patch `00` and does not send on connect.

**Why:** Matches USB live-controller behavior and the device-connection delta. `liveFromPedal` can stay true for later work; this slice does not apply inbound bytes to `snapshot.patch`.

**Alternative:** A Bluetooth-specific Controller screen. Rejected; links are a capability mask (`docs/architecture.md`).

### 5. Architecture and OpenSpec context catch up

**Choice:** Update `docs/architecture.md` and `openspec/config.yaml` so `BluetoothLink` includes `send`, this encoder is in scope, and copying third-party SysEx stays forbidden. Phase-1 “no encoder” rules must not survive this change.

**Why:** Later proposals still read those files; `bluetooth-connect` did the same when GATT connect became real.

## Risks / Trade-offs

- [Web Bluetooth cannot list services until UUIDs are known] → Desktop spike first; then add `optionalServices` and re-test Chrome.
- [Official CC 0 written to GATT does not change the pedal] → Iterate with Patone notify/write captures, then Valeton Suite sniff; change only `encodePatch` for Bluetooth.
- [Characteristic is notify-only or needs a handshake before writes] → Spike logs properties; if a enable-notify or “start” write is required, do it in `open`, not in Controller.
- [Payload larger than ATT MTU] → Spike records size; split only if captures show chunking. CC 0 is three bytes if that attempt works.
- [Operator copies ToneLib / other editor SysEx] → Tasks and architecture say Valeton Suite + Patone only.
- [Displayed `00` may not match the pedal] → Same as USB; do not send on connect.
- [No in-browser verification] → `tsc`; operator tests patch bar on a real GP-5/GP-50 over Bluetooth (web and desktop).

## Migration Plan

Additive. USB path untouched. Rollback is reverting the change. After the spike, commit the UUID constant and encode path together so web/desktop do not ship `send` against an unknown characteristic.

## Open Questions

- Exact service and characteristic UUIDs, write-with-response vs without, and whether the Bluetooth frame equals USB CC 0. The spike answers these; the approach above does not change.
