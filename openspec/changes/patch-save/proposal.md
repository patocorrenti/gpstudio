## Why

Live edits already go to the pedal’s working buffer (module CC, chain-order SET, model/control SETs), but leaving a patch without storing that buffer loses the work (`docs/architecture.md`). Controller still only recalls 00–99. Users need to persist the current patch on the pedal, rename it, copy it to another slot, and keep a local file — from the same bar that already navigates patches.

## What Changes

- Controller’s patch navigator becomes a **patch bar** that can hold more than previous / select / next: those three stay, and the bar gains **Save**, **rename**, **duplicate to another slot**, and **download the current patch** to the PC.
- **Save** stores the current working patch on the pedal into the current slot (overwrite). UI never sends raw MIDI; `DeviceSession` owns the write.
- **Rename** lets the user change the onboard name of the current patch (10-character pedal name) through the session.
- **Duplicate** copies the current working patch onto another 00–99 slot the user picks, without changing which patch is selected. Overwriting a destination that already has a patch requires confirmation.
- **Download** writes a local file of the current patch so the user can keep it on the PC. This is a current-patch export from Controller, not the Library route.
- Save, rename, duplicate, download, previous, and next MUST wait until the current patch’s data is synced (`chainSync` idle), the same busy gate already used by previous / next. The 00–99 selector MAY stay usable so the user can still change patch. The chain-refresh overlay below the bar is unchanged.
- Same controls on USB and Bluetooth. Architecture / OpenSpec context: current-patch **store / rename / duplicate / download** become in-scope SysEx (Patone-owned SET of the existing parameter-write family, plus a local file from the dump we already request). The Editor and Library routes stay stubs. Full library browse/import/reorder stay later.

## Non-goals

- The Editor and Library routes stay stubs. No library list, library reorder, import of a downloaded file back onto the pedal, or official Valeton Suite `.prst` interchange (`docs/architecture.md`).
- IR / SnapTone / NAM upload or extra dumps.
- Warning the user about unsaved edits when they change patch (the pedal already drops the working buffer on recall).
- Dirty-only Save (Save is available whenever the patch is synced, not only after an edit).
- Copying reverse-engineered JavaScript or payloads from `reference/` or other third-party editors.
- Volume, tuner, Patch/Stomp mode UI, stomp-assignment edit (paused lab), or treating USB and Bluetooth as interchangeable.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. This is the next live-controller slice after slot model/control write, not a new spec domain. The Editor and Library routes stay unspecified.

### Modified Capabilities

- `live-controller`: Connected Controller’s patch bar includes previous / select / next plus Save, rename, duplicate, and download. Save, rename, duplicate, download, previous, and next are disabled while the current patch is syncing; the selector may stay usable. Disconnect still hides the bar.
- `device-connection`: After the session is ready, store / rename / duplicate send a Patone-owned current-patch store write on the open link (parameter-write SET family). Duplicate does not recall the destination. Download produces a local file of the current patch through the session. None of those actions send extra patch recall solely to perform them. Disconnect drops that working state.

## Impact

- `src/device/`: Patone-owned store encoder (same CRC-8 + nibble-expand SET path as chain-order / `1147` / `1148`). `DeviceSession` methods for save, rename, duplicate, and download; snapshot name list updates after a successful store/rename/duplicate. UI never calls raw MIDI.
- `src/features/controller/ControllerPage.tsx`: expand `PatchBar` with the new English controls and the existing busy gate.
- `docs/architecture.md`, `openspec/config.yaml`, and `docs/protocol-references.md`: current-patch store/rename/duplicate/download become in-scope; Library still later.
- No new Tauri commands, HTTP backend, or transport contract. Exact SET body and download file layout are apply-time fill-in from Patone captures plus `reference/` as a behavioral guide (`docs/protocol-references.md`).
