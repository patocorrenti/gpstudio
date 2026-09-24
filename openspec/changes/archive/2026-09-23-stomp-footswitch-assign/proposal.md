## Why

Controller already follows Stomp-mode footswitch on/off (Bluetooth) and edits the chain, but users still cannot see or change **which modules** each footswitch toggles. GP-5 has one stomp; GP-50 has two. A prior change (`stomp-assignment`) locked GP-50 dump decode and then stalled on guessed SET envelopes that the pedal ignored. Local GP-5 / GP-50 reference editors now show a working per-effect assignment write (parameter family `114d`); Patone can own that codec the same way as `1147` / `1148` / `114a`, then refine with operator logs if needed.

## What Changes

- After the audio chain is shown, Controller MUST show and edit per-patch stomp assignment: **one** stomp on GP-5, **two** on GP-50 (Footswitch A / B). Each stomp MAY list zero or more of NR…NS. EXP MUST NOT be assignable.
- `DeviceSession` MUST decode those assignments from the **same** current-preset dump already requested after connect and patch change, and keep them on the snapshot. Missing dump → empty lists, not invented defaults that write to the pedal.
- Editing an assignment MUST update the snapshot and send a Patone-owned parameter-write SET (family `114d`, path `01 01 04`, CRC-8 ATM + nibble-expand) on USB and Bluetooth. One effect bit per edit (assign or clear), not a full-mask live `0D` echo. MUST NOT send extra patch recall or a chain dump solely because assignment changed. MUST NOT write a full preset blob.
- Dump field layout and the `114d` body shape are taken from Patone dump diffs (lab) plus the local reference editors as behavioral wire notes (`docs/protocol-references.md`). Do **not** paste reference JavaScript or raw hex strings into `src/`. Do **not** retry the failed envelopes recorded in `openspec/changes/stomp-assignment/spike-assignment-write.md` (W1–W3, panel H1–H4, H7 guessed `0D`).
- USB MUST NOT apply unsolicited live assignment reports. Bluetooth MAY apply the captured live command `0D` notify once a SET is accepted; until then, dumps remain the source of truth.
- Architecture / OpenSpec context: stomp assignment read/write moves in scope. The paused `stomp-assignment` folder stays a lab of what not to send. Full editor, Patch/Stomp mode gating of the UI, and Library stay separate.

## Non-goals

- Full preset parameter library, rename-as-store beyond existing Save, IR / NAM file upload, or the Editor route (`docs/architecture.md`).
- Writing the whole current-preset dump.
- Assigning EXP to a stomp.
- Gating assignment UI on Patch vs Stomp mode (CC 28 / GP-5 footswitch modes); count is by model only.
- Drag-and-drop chain reorder (already shipped).
- Copying reverse-engineered SysEx or JavaScript from third-party editors into `src/`.
- Retrying failed spike SET frames as-is.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. Stomp assignment is the next live-controller / session slice after footswitch follow and parameter SETs, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, Controller shows and edits per-patch stomp assignment (1 slot GP-5, 2 GP-50) through the device session. USB and Bluetooth share that UI. EXP is not assignable.
- `device-connection`: The session decodes stomp assignment from the current-preset dump already in the sync pipeline, stores it on the snapshot, and sends a Patone-owned `114d` assignment write on edit. USB ignores unsolicited live assignment reports.

## Impact

- `src/device/chain-codec.ts`: decode assignment masks from the existing dump (GP-50 1006/1014 stride; GP-5 920); encode `114d` SET (footswitch index, effect index 0–9 with NS=9, 0|1).
- `src/device/session/`: snapshot `stomps`; dump apply fills it; `setStompAssignment` (or equivalent) updates snapshot and sends the write via the existing throttled/command-out path; optional Bluetooth apply of live `0D` after SET works.
- `src/features/controller/`: assignment UI next to the chain (feature sibling, not under `src/components/`); React still MUST NOT send raw MIDI.
- `docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml`: assignment slice in scope; point at this change instead of “paused only”.
- No new Tauri commands or HTTP backend. Prior change `stomp-assignment` is not archived by this proposal; it remains the failed-SET notebook.
