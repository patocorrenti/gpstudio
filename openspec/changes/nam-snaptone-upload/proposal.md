## Why

GP Studio can select an onboard user SnapTone and show its name, but it cannot put a capture on the pedal. NAM A2 files (TONE3000 and most new captures) have to go through Valeton Suite. This is the dedicated change for that later item in `docs/architecture.md` (IR / NAM file upload). It covers A2 only.

## What Changes

- With a pedal connected, the patch bar opens a SnapTone modal (not a route). The modal lists the device-global user slots from the name snapshot the session already keeps in memory.
- The user picks a user slot, loads a `.nam`, and the app converts NAM A2 to SnapTone bytes in an isolated module, then sends those bytes through `DeviceSession`. A1 is rejected with `A1 captures aren't supported yet`.
- An occupied slot asks for overwrite by slot number and current name. Patches that already point at that slot keep the same slot number and play the new capture. The app does not scan patches.
- After a successful upload the session re-requests the Nam name dump and replaces the in-memory snapshot. Disconnect drops names, as today.
- While an upload is in progress, other app writes to the pedal wait. If the link cannot carry the upload (expected for Bluetooth until research says otherwise), the modal explains that and does not send it.
- Conversion code ported from VLTN Tone Studio stays in one module. SysEx stays GP Studio-owned. Do not copy third-party editors (`docs/architecture.md`).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-controller`: The patch bar opens a SnapTone modal that lists user slots, accepts a `.nam`, shows convert/send progress, and confirms overwrite by slot name. React does not send MIDI.
- `device-connection`: The session accepts a converted SnapTone blob, writes it to a user slot on the open link, blocks other app writes for that upload, and refreshes the Nam name snapshot afterward. The connect-time name dump is unchanged.

## Non-goals

- NAM A1, distilling A2 to A1, cabinet IR upload, deleting slots, TONE3000 search, and audio preview.
- A new route, a menu item, or a disk cache of slot names.
- Listing which patches use a slot.
- Resolving the GPL-3 question for VLTN. The port stays isolated so it can be replaced. No merge to main and no production deploy in this change.
- Copying Valeton Suite, its binaries, or proprietary extracts. Copying VLTN's MIDI uploader. If the wire format cannot be reimplemented from captures, stop and ask.
- Editor and Library routes.

## Impact

- Working plan: `docs/nam-snaptone-upload.md`.
- UI: a modal opened from the patch bar (`src/features/controller/`). Imports `@/device/session` only.
- Conversion: new `src/snaptone/` module (Web Worker). Session and UI call `inspectNam` / `convertNamToSnapTone` only.
- Session: a new write sibling for the SnapTone file upload, next to the existing Nam name read (`src/device/nam-names.ts`, `src/device/session/`). USB and Bluetooth stay one session; Bluetooth disables the send when research shows the pedal will not take it.
- `docs/architecture.md` and `openspec/config.yaml` when this change is applied, so agents stop treating A2 file upload as forbidden. Name read and user-slot select stay as they are.
- A separate branch. Hardware checks are a written checklist for Pato, not a browser pass.
