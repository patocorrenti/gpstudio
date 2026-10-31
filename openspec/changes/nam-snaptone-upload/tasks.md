## 1. Research

- [x] 1.1 Write `src/snaptone/RESEARCH.md` from a local clone of VLTN Tone Studio, covering the eight points in `docs/nam-snaptone-upload.md` with upstream paths and line numbers. Include name-length, whether a blank user name still holds audio, whether Bluetooth accepts a file, and the USB upload sequence. Do not add the worker, the wasm, or a session writer. Verify the eight points are present and that `src/snaptone/` has no `.ts` yet.
- [x] 1.2 Apply design Decision 1. If user slots are not the twenty-four indices 56–79, if a blank name still holds audio, if Bluetooth accepts the file, or if the uploader would have to be copied from VLTN, update the delta specs and stop. Otherwise record at the end of `RESEARCH.md` that none of those gates tripped. Verify that sentence, or the spec edits, exists. Stop and show the summary. Do not start section 2 until that summary is accepted.

## 2. Read-only modal

- [x] 2.1 Add an English `SnapTones` item to the patch bar Options menu, shown only while a pedal is connected. It opens a modal that lists factory NS models (protocol indices 0–49) as not accepting a file and user slots `SnapTone 50` through `SnapTone 79` (or the slot-table name). Names that arrive while it is open update the rows and do not send patch recall. Disconnect closes it. The modal imports `@/device/session` only. `npx tsc -b --pretty false` exits 0. Web and desktop share this UI.

## 3. Conversion

- [x] 3.1 Add `inspectNam` in `src/snaptone/` with the GPL-3.0 attribution header and a module `README.md` (upstream file and commit). A2 returns kind, version, and name when present. A1 returns unsupported with `A1 captures aren't supported yet`. An invalid file returns an English reason. Self-check those three on import. Verify the A1 reason string and that the module does not import the session, React, or a MIDI transport.
- [x] 3.2 Run `convertNamToSnapTone` in a Web Worker, following `RESEARCH.md`, including the wasm kernel and clone pipeline. `device` stays on the options only if RESEARCH says GP-5 and GP-50 blobs differ. The session delegates inspect and convert and does not let the module touch the link. Verify a convert call resolves off the UI thread (the worker posts the result) and `npx tsc -b --pretty false` exits 0.
- [x] 3.3 Add a golden compare against the VLTN bytes for one committable A2 fixture. If the bytes differ, document the diff in `RESEARCH.md` instead of loosening the check. Verify the self-check fails if the blob is truncated.

## 4. Upload

- [x] 4.1 Add a session write sibling that sends the converted bytes to one user slot using the sequence in `RESEARCH.md` (GP Studio-owned, not a VLTN port). Factory slots are refused. USB reports that the link can accept a file. Bluetooth reports that it cannot, unless section 1 updated the spec. A mock-link self-check in `src/device/session/checks.ts` asserts sequence, chunking, and checksums, and asserts no patch recall. Verify that check is imported with `@/device/session` and `npx tsc -b --pretty false` exits 0. The same TypeScript path serves web MIDI and Tauri midir.
- [x] 4.2 From the modal, a user slot accepts a `.nam` by button or drop. Show inspection, the name field capped at 10 ASCII letters and digits (`X` when none remain), and the replace ask when occupancy flag is 0 (protocol index and name, including a blank name; no patch list). `Empty` with a flag other than 0 does not ask. Progress is `Converting…` then `Sending to the multi-effects…`. Cancel during conversion sends nothing. Cancel during the send stops further bytes and says the slot is unknown until names are read again. While the send is in progress, the writes that already return `busy` during chain sync return `busy`, without setting `chainSync` to `syncing`. On completion, read the user-slot table (indices 50–79, including the flag) and replace the in-memory snapshot. Show success only when that table carries the submitted name. A failed refresh leaves the slot unnamed. A port that cannot be written suggests closing Valeton Suite. Verify a session self-check: save during the send returns `busy`, and a finished write issues one table request that patch change does not repeat.
- [x] 4.3 Write `src/snaptone/HARDWARE_TEST.md` with the checklist from `docs/nam-snaptone-upload.md` (backup, empty slot, overwrite, cancel, USB unplug, GP-5 and GP-50). Verify each of those lines is present. Pato runs the checklist. Do not add an in-browser pass.

## 5. Docs and build

- [x] 5.1 Update `docs/architecture.md` and the `context` in `openspec/config.yaml` so A2 SnapTone file upload is in scope for this change and copied third-party SysEx stays forbidden. Verify both files mention the session-owned upload and `src/snaptone/` conversion.
- [x] 5.2 Run `npm run build` and verify it exits 0. Web and desktop share that Vite bundle (worker and wasm included), so there is no separate MIDI-backend build.
