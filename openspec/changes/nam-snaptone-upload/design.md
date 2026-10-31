## Context

See `proposal.md` for why. The session already requests the Nam name dump once per connect and keeps twenty-four user names in memory (`src/device/nam-names.ts`, dump indices 56–79). Factory NS names are the static catalog. Selecting a user slot is the existing model SET. File upload is the gap. The working plan is `docs/nam-snaptone-upload.md`.

`docs/architecture.md`: UI imports `@/device/session` only. SysEx for this upload is reimplemented in GP Studio. Do not paste `reference/` or VLTN Tone Studio into the session. VLTN is GPL-3.0; GP Studio is MIT. The license choice is unresolved.

## Goals / Non-Goals

**Goals:**

- One isolated conversion module, replaceable without touching the modal or the link.
- Upload and name refresh go through the existing session.
- Phase 0 writes `src/snaptone/RESEARCH.md` and stops before conversion or upload code if a fact would change the specs.

**Non-Goals:**

- See `proposal.md`. Design adds nothing to that product scope.

## Decisions

### 1. Phase 0 is a gate

**Choice:** Clone VLTN Tone Studio and write `src/snaptone/RESEARCH.md` with the eight points in `docs/nam-snaptone-upload.md` (paths and line numbers). Do not add the worker, the wasm, or the upload writer in that step. Stop and show the summary.

**Why:** Slot count, empty-vs-blank, name length, USB versus Bluetooth, and the wire sequence are not settled. The specs lock today's twenty-four user slots, confirmation when a dumped name exists, and Bluetooth reported as unable until research says otherwise.

**Stop and amend the delta specs before later tasks when RESEARCH shows any of these:**

- User slots are not the twenty-four indices 56–79.
- A blank name is not "no confirmation", because the pedal still holds a capture.
- Bluetooth accepts the file, so the session must report that the link can accept it.
- The upload sequence cannot be written from captures and would require copying VLTN's uploader.

**Alternative:** Implement against VLTN's README (30 user slots) now. Rejected: the app already ships 24.

### 2. Conversion is the only GPL-facing module

**Choice:** `src/snaptone/` exports `inspectNam` and `convertNamToSnapTone`. Conversion runs in a Web Worker. Each ported file carries the VLTN GPL-3.0 attribution header. `README.md` lists the upstream file and commit. The module does not import the session, the transport, or React.

Controller calls the session only. The session delegates inspect and convert to that module, then writes the bytes itself. `device` stays on the convert options until RESEARCH says GP-5 and GP-50 blobs match; then drop the option.

**Why:** The port is the part we may replace. Putting the writer in the same folder would wrap GP Studio SysEx in the GPL tree. The UI rule forbids the modal from importing the module directly.

**Alternative:** The modal imports `@/snaptone` and `@/device/session`. Rejected: features import the session façade only.

### 3. Upload is a session write sibling

**Choice:** A new sibling under `src/device/session/` for this file write, same rule as other write families. It uses the existing link. It does not set `chainSync` to `syncing` (that overlay means a chain refresh). A dedicated in-progress state makes the writes that already return `busy` during chain sync return `busy` for this send too. Patch-bar controls follow that state the same way they follow chain sync.

After the write completes, call the existing Nam request once and replace `userNsNames`. Do not persist names to disk. Do not re-request on Reload or patch change.

**Why:** One façade, one link. Reusing `chainSync` would show the chain overlay for a file send.

**Alternative:** Copy VLTN's uploader into `src/snaptone/` and let it send MIDI. Rejected: more GPL, and a second MIDI path.

### 4. The modal lives on the patch bar

**Choice:** An English `SnapTones` item in the patch bar Options menu opens the modal. Factory rows come from the NS catalog and ignore drops. User rows use the snapshot labels. Placement can move later without a spec change as long as it stays on the connected patch bar.

**Why:** The user asked for a modal next to the patch actions, not a route. Options is where Rename, Duplicate, Download, and Upload already sit.

### 5. Tests do not need the pedal

**Choice:** Parser fixtures (A2, an A1 that fails, an invalid file). A golden convert test against VLTN bytes when a fixture's license allows committing it; otherwise a local fixture and a documented diff. A mock link test for sequence, chunking, and checksums once RESEARCH records them. `src/snaptone/HARDWARE_TEST.md` is the checklist Pato runs. No in-browser verification task.

## Risks / Trade-offs

- [GPL code linked from the session] → Keep the call behind the two functions. Do not move SysEx into `src/snaptone/`. Do not merge or deploy this branch while the license is open.
- [Golden bytes differ because of float or CPU] → Document the diff. Do not weaken the test silently.
- [Blank slot still holds audio] → RESEARCH gate above. Until then, only a dumped name forces the replace ask.
- [Android Bluetooth users cannot upload] → The modal explains it. The same screen is used; the send stays off.
- [Wasm size in the PWA and the Store package] → Record the binary size in RESEARCH. Do not add a second toolchain beyond what that wasm needs.

## Migration Plan

No stored data migrates. Applying the change updates `docs/architecture.md` and the `context` in `openspec/config.yaml` so A2 file upload is in scope and third-party SysEx stays forbidden. Rollback is not shipping the branch. Do not merge to main and do not publish.

## Open Questions

None that can be answered without Phase 0. The gates in Decision 1 are the list.
