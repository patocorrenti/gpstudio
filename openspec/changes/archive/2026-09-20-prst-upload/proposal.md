## Why

Controller can download the current patch as a Valeton `.prst` for the connected pedal, but there is no way to put that file back (`docs/architecture.md`). Users need the inverse on the same patch bar: pick a `.prst` from the PC, load it into the **currently selected** working patch, then Save if they want it stored on the pedal — with a chance to cancel before that load.

## What Changes

- Controller’s patch bar gains **Upload** next to Download. Same English labels, same USB and Bluetooth presentation.
- Upload opens a local `.prst` file picker. After a file is chosen, Controller shows a confirmation dialog that this will load into the current working patch. Cancel sends nothing. Accept applies the file through the device session. Save (already on the bar) stores that working patch on the current slot. The onboard name does not change until the user Saves or renames.
- Decoder is Patone-owned (inverse of the connected-model `.prst` encoder). GP-50 session accepts a GP-50 `.prst`; GP-5 session accepts a GP-5 `.prst`. Wrong-model or invalid files MUST NOT send MIDI. No conversion.
- Architecture / OpenSpec context: current-patch `.prst` **import onto the selected slot** becomes in-scope Controller upload. Library browse/import/reorder of `.prst` stays later.
- Same busy gate as Save / Download (wait while `chainSync` is syncing; the 00–99 selector may stay usable). No new Tauri command.

## Non-goals

- Library route, library list, library reorder, or importing a `.prst` onto a slot the user is not currently on.
- Dropdown to upload “as GP-5” or “as GP-50” and convert across models.
- Copying reverse-engineered JavaScript or payloads from `reference/` HTML into `src/`.
- IR / SnapTone / NAM upload, Editor route, volume/tuner UI, Patch/Stomp mode, or stomp-assignment edit (paused lab).
- Dirty tracking or unsaved-edit warnings when changing patch.
- Picking a destination slot other than the current one (that remains Duplicate).

## Capabilities

### New Capabilities

- None. This is the next live-controller slice after `.prst` download, not a new spec domain. The Editor and Library routes stay unspecified.

### Modified Capabilities

- `live-controller`: Connected Controller’s patch bar includes Upload. Choosing a `.prst` asks the user to confirm loading into the current working patch; cancel does nothing; accept applies that file through the device session and does not store. Upload waits while the current patch is syncing. Disconnect still hides the bar.
- `device-connection`: After the session is ready, `uploadCurrentPatch` applies a connected-model Valeton `.prst` onto the working patch (owned writes, no store SET) and refreshes the current-preset dump. Wrong-model or invalid bytes MUST NOT send a write. No extra patch recall solely because upload ran. Disconnect drops that working state.

## Impact

- `src/device/patch-store.ts`: Patone-owned `.prst` decode (header, CRC-8 ATM, name, descriptor, dump body) matching the TOB captures already used for encode.
- `DeviceSession.uploadCurrentPatch(bytes)`: parse, reject mismatches, apply through existing command-out writes, then re-request the dump. Does not send store `114a`. UI never calls raw MIDI.
- `src/features/controller/PatchBar.tsx`: Upload control, hidden `.prst` file input (`Blob` inverse of Download; no Tauri dialog), confirmation Dialog (Cancel / Load; Save is separate), English error when the file is invalid or for the other model.
- `docs/architecture.md`, `openspec/config.yaml`, `docs/protocol-references.md`: current-patch `.prst` import onto the selected slot in; Library import still out.
