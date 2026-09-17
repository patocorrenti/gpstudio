## Why

`audio-chain` already draws the current patch’s modules and on/off state, but activating a slot does nothing. Users need to toggle those ten effects from Controller, and on Bluetooth the app should follow the pedal when a module is switched there. USB still does not telemetry knobs (`docs/architecture.md`), so that inbound path stays unused.

## What Changes

- Controller slots for NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, and RVB become toggles (official CC 48–57). On GP-50, EXP is also a toggle: Bluetooth sends official CC 13; USB sends captured EXP SysEx because USB ignores CC 13. The same row is used on USB and Bluetooth; React still MUST NOT send raw MIDI.
- `DeviceSession` updates the snapshot on-change (optimistic) and sends the matching CC on the open link (`commandToPedal` is already true on both). It MUST NOT send SysEx, extra patch recall, or a chain dump solely because a module was toggled.
- When `liveFromPedal` is true (Bluetooth only), inbound live-module SysEx MUST update the matching slot’s on/off without changing order. GP-50 EXP inbound uses a separate SysEx (command `02`). USB MUST ignore those reports even if they arrive. Volume, tuner, and other live CCs stay unapplied.
- Architecture and OpenSpec context: UI module on/off (including GP-50 EXP) is in scope; Bluetooth `liveFromPedal` applies live-module/EXP SysEx; USB remains one-way for those controls. Drag-and-drop reorder stays later.

## Non-goals

- Drag-and-drop reorder, SysEx chain writes, or encoding a new order.
- Full preset parameters, rename, IR / SnapTone / NAM (`docs/architecture.md`).
- Applying inbound volume, tuner, CTL, or other non-module CCs (`liveFromPedal` knobs besides 48–57).
- Treating USB as duplex, or listening for USB module telemetry.
- GP-50 master/BPM/Patch|Stomp.
- Volume, tuner, or CTL from Controller.
- Copying reverse-engineered SysEx from third-party editors.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. Module on/off is the next live-controller slice after the display-only chain, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, the ten effect slots toggle on/off through the device session. GP-50 EXP is also a toggle. Slots MUST NOT reorder. USB and Bluetooth share the same chain UI.
- `device-connection`: The session sends official module CC on toggle. Bluetooth (`liveFromPedal`) applies inbound live-module SysEx to the snapshot chain. USB does not apply those reports.
- `inbound-log`: Log still MUST NOT apply traffic. `DeviceSession` MAY apply Bluetooth live-module SysEx to the snapshot independently of Log capture, same pattern as identity and chain dumps.

## Impact

- `src/device/session.ts`: `toggleChainSlot` (or equivalent) flips `chain[].enabled` and sends CC; Bluetooth inbound live-module SysEx updates the same field when `liveFromPedal` is true.
- `src/device/encode.ts` / `src/device/cc.ts`: encode module on/off as official CC 48–57, wrapped as BLE-MIDI on Bluetooth like CC 0. No new SysEx.
- `src/features/controller/ControllerPage.tsx`: effect slots become buttons including GP-50 EXP; chainSync overlay still blocks the body.
- `docs/architecture.md` and `openspec/config.yaml`: module on/off writes in scope; Bluetooth live module CC in scope; USB still not duplex; drag-and-drop still later.
- No new Tauri commands or HTTP backend.
