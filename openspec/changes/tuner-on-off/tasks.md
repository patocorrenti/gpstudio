## 1. Encoder

- [x] 1.1 Add `encodeTuner` in `src/device/encode.ts` that sends CC 58 with value 0 (off) or 127 (on) through the existing USB / BLE-MIDI wrap. Extend the module-load assert so a wrong controller or wrap throws. Verify the assert sees controller `0x3a` (58) and values `0x00` / `0x7f`.

## 2. Session

- [x] 2.1 Add connected-snapshot `tunerOn: boolean` (false on connect; dropped on disconnect). Add `setTuner(on: boolean)` on `DeviceSession` with the same gates as `pressStomp` / `toggleChainSlot`: connected, sync ready, chain not syncing, `commandToPedal`. Update `tunerOn`, send the matching CC, do not mark `modified`, do not request a dump, do not set `chainSync` to syncing, and do not apply inbound CC 58. Verify `npx tsc -b --pretty false` typechecks `src/device/session/`.

## 3. Controller

- [x] 3.1 Add Switch / Tuner under `src/features/connect/` in the shell next to Global (not under `src/components/`, not in the patch body): English `Switch` on GP-5, `Switch A` / `Switch B` on GP-50, and `Tuner` with pressed state from `tunerOn`. Disabled while sync or chainSync is busy, hidden on disconnect, calls `pressStomp` / `setTuner` and does not import the encoder. Same controls on USB and Bluetooth. No pitch display. Verify `npx tsc -b --pretty false` typechecks.

## 4. Docs and context

- [x] 4.1 Update `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so tuner write (CC 58, 0 / 127) is in scope on USB and Bluetooth, inbound tuner stays out, and no pitch UI is promised. Verify `openspec/config.yaml` still parses as YAML.

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change. Do not add an in-browser pass.
- [ ] 5.2 Operator: on USB and Bluetooth, Tuner on sends CC 58 = 127 and the pedal enters tuner; Tuner off sends 0 and exits. Confirm no chain-refresh overlay and no patch recall. If a value other than 0/127 is required, change only those constants and note it here.
