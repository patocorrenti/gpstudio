## 1. Wire and conversion

- [x] 1.1 `src/device/user-ir-table.ts`: `11 21` import frames, `12 20` request and decode, name rule. Self-check in `checks.ts`.
- [x] 1.2 `src/snaptone/ir-wav.ts`: WAV → 2048-byte block (port of VLTN `userir/convert.ts`), with notice. Self-check in `checks.ts`.

## 2. Session

- [x] 2.1 `uploadUserIr` over `sendSnapFrames`, blocks writes, verifies from `12 20`, USB only. `refreshUserIrSlots`, `userIrSlots` in the snapshot, connect-time reply read without swallowing it from `IrNameDecoder`. Scripted-USB self-check.

## 3. UI

- [x] 3.1 Header `IR` control (USB; Bluetooth toast), IR modal with slot list, WAV pick/drop, preview (format, slot, overwrite note, name, truncation note), per-frame progress, errors.

## 4. Hardware

- [ ] 4.1 Pato runs the User IR section of `src/snaptone/HARDWARE_TEST.md` on GP-5.
- [ ] 4.2 Same on GP-50. If it fails, capture Suite's USB upload before changing the wire.

## 5. Later

- [ ] 5.1 Capture Suite's Windows USB delete / rename of a User IR and add them like the SnapTone ones.
