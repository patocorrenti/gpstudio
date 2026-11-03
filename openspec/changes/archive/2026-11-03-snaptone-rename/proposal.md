## Why

GP Studio can name a user SnapTone only while uploading the capture, and can delete that slot. Valeton Suite can rename an onboard capture without sending the file again. Matching that means a short USB rename of protocol slots 50–79. The Windows bytes for that rename are not captured yet, and a guessed body is not safe to send (`docs/architecture.md`).

## What Changes

- In the existing SnapTone modal, an occupied user slot (protocol indices 50–79, occupancy flag 0) can be renamed. Factory rows (0–49) and slots that do not hold a capture cannot.
- The session sends one GP Studio-owned USB SysEx for that slot and the sanitized name. It does not re-upload the 2696-byte capture, does not change the selected patch, and does not send patch recall.
- The name rule is the one upload already uses: ASCII letters and digits, at most 10 characters. An empty result is stored as `X`.
- After the pedal acknowledges the command, the session reads the user-slot table again. The modal shows the refreshed name. It does not invent the submitted name.
- Bluetooth does not send a rename. The modal uses the same English explanation it already uses when the link cannot accept a SnapTone file.
- While a rename is in progress, the same controls that wait during a SnapTone delete stay unusable. The chain-sync overlay is not shown solely because of the rename.
- The encoder is written only from a Windows Suite USB capture (USBPcap opened in Wireshark). The Android function `0x27` at `0x691010` is not the wire. Windows delete already proved Suite does not send the Android file command.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-controller`: The SnapTone modal renames an occupied user slot and shows the name from the refreshed table. React does not send MIDI.
- `device-connection`: A connected USB session renames one user SnapTone (protocol indices 50–79) without rewriting the capture, then refreshes that slot table. Bluetooth sends nothing.

## Non-goals

- Re-uploading a `.nam` in order to change its name. Upload already submits a name with the file.
- Renaming factory NS models, empty slots, user IR slots, or the current patch (store `114a` stays the patch rename).
- NAM A1, cabinet IR upload, and Bluetooth rename until a capture shows the pedal accepts it.
- Copying Valeton Suite, its binaries, or the Android file command. If the capture does not lock a short SET, stop and ask.
- Editor and Library routes.

## Impact

- UI: rename on an occupied row of the SnapTone modal in `src/features/controller/`. Imports `@/device/session` only.
- Session: a USB write next to `deleteUserSnapTone` (`src/device/session/`, `src/device/snaptone-table.ts`). Same busy flag as a SnapTone file send. The slot-table read already used after upload and delete is the refresh.
- Protocol note: `src/snaptone/RESEARCH.md` records the capture before the encoder is written. `docs/architecture.md` and `openspec/config.yaml` gain USB SnapTone rename when this change is applied, beside the existing USB delete.
- Hardware: one Windows capture before encoding. A second pedal model is a check after the bytes are locked, unless that capture contains a model-specific field.
