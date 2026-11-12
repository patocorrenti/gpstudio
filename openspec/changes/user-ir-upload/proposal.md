## Why

GP Studio can select the twenty onboard User IR slots and show their names, but it cannot put a cabinet IR on the pedal. Users still need Valeton Suite for that. The wire is known: VLTN Tone Studio reverse-engineered Suite 2.1.0 and a GP-5 accepted it (`app/src/renderer/src/gp5/lib/userir.mjs`). It is the SnapTone import with a different command and data block, so the session's SnapTone transport carries it unchanged.

## What Changes

- The header gets an `IR` control again (hidden in `33345fd`). It opens an IR modal that lists User IR 01–20 from the `12 20` slot table (occupancy flag + name).
- A row accepts a `.wav` by button or drop. `src/snaptone/ir-wav.ts` (ported from VLTN, GPL-3.0) reads channel 0, resamples to 44.1 kHz with the existing r8brain port (loaded on demand), rounds to 24-bit like JUCE, and keeps the first 512 samples, zero-padded. 16/24/32-bit PCM and 32-bit float are accepted. A longer IR shows a truncation note.
- The modal shows the source format, the target slot (with an overwrite note when the flag is 0) and the name (Suite's printable set, at most 10, `X` when blank).
- `DeviceSession.uploadUserIr` sends `[0x11, 0x21, nId 0, fxId 0x0A100000 + (slot − 1), name[16], node[16], fPara[32], data[2048]]` — 2122 bytes, 112 frames — through `sendSnapFrames` (per-frame ACK, resend, 20 ms gap) and reports per-frame progress. Other writes return `busy` while it runs. It verifies by reading `12 20` until the slot has flag 0 and the stored name.
- The `12 20` read is byte-for-byte the USB IR-name ask already sent on connect. The session now also reads the flags from that reply (`userIrSlots`) and still lets it through to `IrNameDecoder`, so names and the Nam-ask order are unchanged.
- Bluetooth does not send the file and the control explains USB is required.

## Non-goals

- User IR delete and rename. Android Suite has a `0x22` delete, but SnapTone delete turned out to use a different Windows wire, so this waits for a USB capture.
- GP-200 family (1024 samples).
- Reading an IR file back from the pedal (not possible).
- Including IR files in `.prst` export.

## Impact

- `src/device/user-ir-table.ts` (codec), `src/snaptone/ir-wav.ts` (conversion), `src/device/session/device-session.ts` (`uploadUserIr`, `refreshUserIrSlots`, `prepareUserIr`, `userIrSlots`), `src/device/session/snaptone-upload.ts` (optional per-frame callback).
- UI: `src/features/controller/UserIrDialog.tsx`, `user-ir-bridge.ts`, `SnapTonesControl.tsx`, `PatchBar.tsx`.
- Checks in `src/device/session/checks.ts`: wire (112 frames, fxId of User IR 03 = CAB wire `02 00 10 0a`, table request == IR-name ask), WAV conversion (24-bit passthrough, 16-bit scaling, padding, truncation, 48 kHz resample, non-WAV rejected), and a scripted USB upload (Bluetooth refused, slot 21 refused, save returns busy, 112 frames, one table read, name refreshed).
- Hardware checklist in `src/snaptone/HARDWARE_TEST.md`. GP-50 is the open question.
