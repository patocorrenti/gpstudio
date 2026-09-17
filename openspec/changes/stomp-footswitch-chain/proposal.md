## Why

Controller already toggles audio-chain modules from the app, and Bluetooth already applies some live-module SysEx when the pedal reports on/off (`docs/architecture.md`). Pressing a footswitch in Stomp mode is a different origin of that same chain-state change; users need the slots to follow the pedal without treating the stomp as a patch change.

## What Changes

- On a Bluetooth session, a Stomp-mode footswitch that toggles one or more effect modules MUST update those slots' on/off through `DeviceSession` (`liveFromPedal`). Module order MUST NOT change. Controller MUST show the new on/off without a chain-refresh busy overlay.
- GP-50 in Patch mode keeps today's pedal-initiated patch reports (footswitches change patches, then the chain dump refreshes). This change does not add Patch/Stomp UI or send the Patch/Stomp CC.
- GP-5 Bluetooth footswitches that toggle modules use the same apply path. USB MUST still ignore live module reports (`docs/architecture.md`: USB is not duplex for those controls).
- Stomp inbound MUST NOT be treated as a patch-changed event: no extra patch recall, no chain dump solely because a footswitch was pressed. If the captured frame is not the existing live-module SysEx (identity-family command `09`) or EXP SysEx (command `02`), extend the Patone-owned decoder from captures — do not copy third-party SysEx.
- Architecture / OpenSpec context: Bluetooth stomp-originated module on/off is in scope. Patch/Stomp mode control, volume, tuner, and USB live stomps stay later.

## Non-goals

- GP-50 Patch/Stomp mode control or display (official CC 28 / related extras).
- Sending MIDI because a footswitch was pressed (app is follower, not echo).
- Treating USB as duplex, or applying USB inbound live-module / footswitch reports.
- Applying inbound volume, tuner, CTL, BPM, or other non-module live knobs.
- Drag-and-drop reorder, full preset parameters, IR / SnapTone / NAM (`docs/architecture.md`).
- Copying reverse-engineered SysEx from third-party editors.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. Stomp footswitch follow is the next live-controller / session slice after module on/off, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown on Bluetooth, Stomp-mode footswitches that change module on/off MUST update those slots through the device session. USB MUST NOT follow. The chain-refresh overlay MUST NOT appear solely because of a stomp.
- `device-connection`: When `liveFromPedal` is true, inbound stomp-originated module on/off (existing live-module/EXP SysEx, or the captured equivalent) MUST update the snapshot chain. That inbound MUST NOT be classified as a pedal patch change. USB MUST ignore it.

## Impact

- `src/device/session.ts`: keep applying Bluetooth live module on/off; do not start `refreshChain` / `chainSync: "syncing"` for stomp frames; ignore the same bytes on USB.
- `src/device/chain-codec.ts` / `src/device/identity.ts`: if footswitch captures differ from command `09` / `02`, extend the decoder so they are module changes, not `patch-changed`.
- `src/features/controller/ControllerPage.tsx`: no new controls; the existing chain row follows snapshot on/off.
- `docs/architecture.md` and `openspec/config.yaml`: Bluetooth stomp-originated chain on/off is in scope; Patch/Stomp UI still later; USB still not duplex.
- No new Tauri commands or HTTP backend.
