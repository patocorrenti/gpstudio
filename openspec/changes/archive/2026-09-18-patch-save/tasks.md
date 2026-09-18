## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so current-patch store (Save / rename / duplicate onto another slot) and current-patch download are in-scope SysEx on USB and Bluetooth, Library import/reorder and Valeton `.prst` stay later, and verify the out-of-scope list still forbids copied SysEx, IRs/NAM, and USB duplex knobs
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (store SET of the existing parameter-write family allowed; current-patch file export allowed; still no copied SysEx or Library route), and verify the file still parses as YAML
- [x] 1.3 Note in `docs/protocol-references.md` that storing the working patch is a parameter-write SET (family `114a`, path `01 01 04`, CRC-8 + nibble-expand; not live notify `01 02 04`) and that Patone download wraps the current-preset dump rather than Suite `.prst`, and verify the file still forbids copying `reference/` source or payloads

## 2. Store codec

- [x] 2.1 Add a Patone-owned store encoder (packed family `114a`, destination slot 0–99, 10-character space-padded name, CRC-8 + nibble-expand, `F0`…`F7`) from a Patone capture guided by `reference/` behavior without pasting that JavaScript, wrap Bluetooth like other SysEx, and verify USB vs Bluetooth only differ by that wrap
- [x] 2.2 Sanitize names (ASCII letters, digits, space, hyphen, max 10) in the device layer, reject blank names, and verify a too-long or accented name is trimmed/stripped before encode
- [x] 2.3 If the first Save capture is ignored by the pedal, stop and do not encode a full preset dump; record the miss like `stomp-assignment` and ask before expanding scope

## 3. Session store

- [x] 3.1 Add `DeviceSession.savePatch`, `renamePatch(name)`, and `duplicatePatch(dest)` that send the store SET when ready and not chain-syncing, update `patchNames` for the destination, leave the current patch index unchanged, send no extra recall or chain dump, no-op when busy/disconnected/same-slot duplicate/blank name, and verify `npx tsc -b --pretty false` typechecks callers
- [x] 3.2 Capture Save versus duplicate-to-another-slot (Log; no third-party payload copy) and verify the destination index is what the pedal stores; if it only overwrites the current slot, stop and ask before expanding scope

## 4. Download

- [x] 4.1 Keep the last assembled current-preset dump bytes on the session when a dump decodes, drop them on disconnect or a newer generation, and verify a missing dump leaves no export bytes
- [x] 4.2 Add `downloadCurrentPatch` that re-requests the current-preset dump without CC 0, waits on the existing `chainSync` gate, returns `{ filename, bytes }` for a Patone-owned file (magic + model + slot + name + dump) or `null` if the dump never arrives, and verify no extra patch recall is sent solely to download
- [x] 4.3 Filename includes the two-digit slot and sanitized name (e.g. `gp50-05-Flow.patch`), and verify GP-5 vs GP-50 filenames follow the connected model

## 5. Controller patch bar

- [x] 5.1 Expand `PatchBar` with English Save, rename, duplicate, and download controls beside previous / select / next, disable those four plus previous / next while `chainSync === "syncing"`, leave the 00–99 selector usable, hide the bar when disconnected, and verify typecheck
- [x] 5.2 Add a rename dialog (shadcn `Input` if missing, reuse `Dialog`) that calls `renamePatch` and a duplicate dialog that picks a different 00–99 slot, confirms overwrite when that slot already has a known name, then calls `duplicatePatch`, and verify no store write is sent until confirm
- [x] 5.3 Save calls `savePatch` on click; download calls `downloadCurrentPatch` and triggers a `Blob` + `<a download>` (no new Tauri command) and is disabled when no dump can be exported; verify Controller still sends no raw MIDI

## 6. Check

- [x] 6.1 Run `npx tsc -b --pretty false` and fix type errors from this change
