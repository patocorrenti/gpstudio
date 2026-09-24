## 1. Encoder

- [x] 1.1 Add `ctrl2: 70` on `gp50Cc` in `src/device/cc.ts` (CC 69 stays the inherited `ctl`) and `encodeStompPress` in `src/device/encode.ts`: GP-5 and GP-50 index 0 send CC 69 value 127; GP-50 index 1 sends CC 70 value 127; any other index returns null. USB is the raw CC; Bluetooth is that same CC in the existing BLE-MIDI wrap. Extend the module-load assert so a wrong controller, value, or wrap throws. Verify the assert names CC 69 as `0x45` and CC 70 as `0x46` with value `0x7F`, and that it does not emit CC 48–57.

## 2. Session

- [x] 2.1 Add `pressStomp` on `DeviceSession` (the façade UI already imports), with the same gates as `toggleChainSlot`: connected, sync ready, chain not syncing, `commandToPedal`. Flip `enabled` on each effect in that stomp's assignment, leave other slots, EXP, order, models, controls, and assignment lists unchanged, set `modified` through the existing working-patch check, then send the one CC. An empty assignment still sends. GP-5 index other than 0 sends nothing. Do not recall a patch, request a chain dump, or set `chainSync` to syncing. Do not add a write sibling under `src/device/session/`. Verify `npx tsc -b --pretty false` typechecks `src/device/session/`.

## 3. Controller

- [x] 3.1 Add a press row under `src/features/controller/` (not `src/components/`): English `Stomp` on GP-5, `A` and `B` on GP-50, shown only while the chain is on screen, disabled while `chainSync` is syncing, hidden on disconnect. It calls `pressStomp` and does not import the encoder. Assignment marks stay assign-only. The same row is used on USB and Bluetooth. Verify `npx tsc -b --pretty false` typechecks `src/features/controller/`.

## 4. Docs and context

- [x] 4.1 Update `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so a stomp press (GP-5 CC 69, GP-50 CC 69 and CC 70, value 127) is in scope on USB and Bluetooth, the chain updates on-change, and USB still ignores live stomp reports. Verify `openspec/config.yaml` still parses as YAML and still forbids pasted reference JavaScript.

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change. Do not add an in-browser pass.
- [ ] 5.2 Operator, on a pedal: GP-5 press sends CC 69 and the assigned modules toggle; GP-50 A sends CC 69 and B sends CC 70. Check one USB session and one Bluetooth session (web or desktop; both backends send the same CC, Bluetooth only adds the BLE-MIDI wrap already asserted in 1.1). Confirm no chain-refresh overlay and no extra patch recall. If value 127 is ignored, change only that constant and note it here.
