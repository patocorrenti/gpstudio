## Why

USB connection works, but Controller is still a reserved placeholder. The home screen needs a disconnected empty state and, once a pedal is linked, a way to choose patches 00–99 via official MIDI CC (`docs/architecture.md`).

## What Changes

- Controller shows an English empty state when no pedal is connected (for example `No pedals connected`).
- When a session is connected, Controller shows a patch bar: previous arrow, current patch as a selectable label, next arrow.
- `DeviceSession` owns the current patch (00–99), sends official CC 0 on channel 1, and does not expose raw MIDI to React.
- This is the first slice of `live-controller`. Volume, module toggles, tuner, and GP-50 extras stay out.

## Non-goals

- Volume, NR/PRE/DST/NS/AMP/CAB/EQ/MOD/DLY/RVB, tuner, CTL, GP-50 master/EXP/BPM/Patch|Stomp.
- Reading or displaying onboard preset names (needs SysEx later).
- SysEx, preset editor/library, IRs/NAM, Bluetooth, mobile packaging (`docs/architecture.md`).
- Copying reverse-engineered SysEx from third-party editors.

## Capabilities

### New Capabilities

- `live-controller`: Controller empty state when disconnected; patch 00–99 select / previous / next through DeviceSession using official CC 0.

### Modified Capabilities

- `app-shell`: Controller is no longer a reserved screen with no live controls. Disconnected it shows the empty state; connected it shows the patch selector. Editor and Library stay stubs.

## Impact

- `src/device/session.ts` tracks patch and sends CC 0 through the existing transport.
- `src/features/controller/` replaces the placeholder copy with empty state + patch bar.
- No new MIDI backends, Tauri commands, or HTTP services.
