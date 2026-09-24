## 1. Encoder

- [ ] 1.1 Add `encodeTuner` in `src/device/encode.ts` that sends CC 58 with value 0 (off) or 127 (on) through the existing USB / BLE-MIDI wrap. Extend the module-load assert so a wrong controller or wrap throws. Verify the assert sees controller `0x3a` (58) and values `0x00` / `0x7f`.

## 2. Session

- [ ] 2.1 Add connected-snapshot `tunerOn: boolean` (false on connect; dropped on disconnect). Add `setTuner(on: boolean)` on `DeviceSession` with the same gates as `pressStomp` / `toggleChainSlot`: connected, sync ready, chain not syncing, `commandToPedal`. Update `tunerOn`, send the matching CC, do not mark `modified`, do not request a dump, do not set `chainSync` to syncing, and do not apply inbound CC 58. Verify `npx tsc -b --pretty false` typechecks `src/device/session/`.

## 3. Controller

- [ ] 3.1 Add a Tuner control under `src/features/controller/` (beside the stomp press row is fine; not under `src/components/`): English `Tuner`, pressed state from `tunerOn`, disabled while `chainSync` is syncing, hidden on disconnect, calls `setTuner` and does not import the encoder. Same control on USB and Bluetooth. No pitch display. Verify `npx tsc -b --pretty false` typechecks `src/features/controller/`.

## 4. Docs and context

- [ ] 4.1 Update `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so tuner write (CC 58, 0 / 127) is in scope on USB and Bluetooth, inbound tuner stays out, and no pitch UI is promised. Verify `openspec/config.yaml` still parses as YAML.

## 5. Check

- [ ] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change. Do not add an in-browser pass.
- [ ] 5.2 Operator: on USB and Bluetooth, Tuner on sends CC 58 = 127 and the pedal enters tuner; Tuner off sends 0 and exits. Confirm no chain-refresh overlay and no patch recall. If a value other than 0/127 is required, change only those constants and note it here.
