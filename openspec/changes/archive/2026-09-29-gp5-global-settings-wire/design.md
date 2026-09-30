## Context

See `proposal.md` for why. Specs: `device-connection` (GP-5 read/write without exposing volume) and `live-controller` (modal rows match the reference Settings dialog).

GP-5 globals codecs and session paths already exist from `openspec/changes/archive/2026-09-23-gp5-global-settings/`: shared ask `F0 0B 09 00 01 00 00 00 02 01 02 01 00 F7`, Bluetooth dump command `00 01` / length 164 / path `01 02 01`, USB fragments command `00 05` / lengths 48 and 12, GP-5 effect/flag pairs, footswitch family `1115`, and `Gp5GlobalSettingsForm` in `src/features/connect/GlobalSettingsModal.tsx`. GP-50 behavior stays. The gap is that GP-5 settings do not behave like `_reference/GP5bluetooth.html` / `_reference/gp5usb.html` in practice, and that modal still shows a Master / Global volume section those Settings dialogs omit (Global Vol sits on the editors’ main page).

Do not paste reference JavaScript into `src/`. Match observed wire bytes and editor offsets (editor index − 2; USB payload − 9).

## Goals / Non-Goals

**Goals:**

- GP-5 dump applies into the snapshot on USB and Bluetooth so modal rows become known.
- GP-5 modal edits send the correct SETs immediately without dirtying the patch.
- Modal rows match the reference Global Settings dialog (no master / Global volume).
- Keep GP-50 modal and writes unchanged.

**Non-Goals:**

- A main-page Global Vol control.
- New session siblings or a second globals orchestrator.
- Changing the shared globals ask bytes.
- Applying USB inbound live globals.

## Decisions

### 1. Fix the existing GP-5 path; do not re-scaffold

The archived design’s offsets and pairs still match both reference editors. Prefer finding why decode/apply or writes fail on a live GP-5 (classify collision with other `00 05` traffic, dump rejected when a required field is out of range, post-chain ask not firing, or modal branching) over inventing a second codec.

**Choice:** Keep `src/device/globals.ts` + `session/globals.ts` + `writes.ts` as the home. Add or extend codec/session checks that push a GP-5 Bluetooth dump and USB fragment set through `DeviceSession` and assert snapshot fields plus an input-level / footswitch write.

**Alternative:** Rewrite GP-5 globals from scratch. Rejected: the table already matches the editors; the failure is wiring or over-strict apply.

### 2. Volume byte stays in the dump table; it is not a reachable setting

Reference Settings modals do not include Global Vol. The dump still carries volume nibbles at BT 53 / USB 44. Keep decoding that byte for codec fidelity if useful, but:

- Do not render Master / Global volume in `Gp5GlobalSettingsForm`.
- Do not expose a Global-settings write API path for GP-5 volume (no CC 1, no modal SET).
- Make apply resilient: an out-of-range or unused volume byte MUST NOT block applying the Settings rows (input, No CAB, REC, BT, monitor, screen, foot).

**Choice:** Drop volume from the modal and from “reachable” exposure; relax `parseGp5Table` so required Settings fields alone gate apply.

**Alternative:** Keep Global volume first in the modal to mirror GP-50 master. Rejected: user and reference Settings disagree.

### 3. Screen brightness stays on both links

Bluetooth Settings includes Screen Brightness (effect 3 / flag 2). USB Settings omits the control but the payload offset (BT 79 − 9 = 70) is the same shift as the other fields. Keep the slider; if the USB payload is short or out of range, leave brightness unknown and disabled.

### 4. Docs and context on archive

When archiving, update `openspec/config.yaml` context and the short globals bullets in `docs/protocol-references.md` / `docs/architecture.md` so they no longer say GP-5 Global settings lists Global volume first.

## Risks / Trade-offs

- [Dump still fails to apply on a real pedal] → Prefer operator Log / reference lengths over guessing; extend fixtures from those packets; do not invent a second body.
- [Removing volume from the modal with no main-page control] → Accepted for this change; patch-bar volume remains CC 7 (patch, not device global).
- [Bluetooth `00 05` preset traffic vs USB globals classify] → Keep length 48/12 + command `00 05` for USB globals only; BT preset stays long fragments / different terminator rules; do not let a misclassified fragment starve the chain assembler.
- [USB has no live globals] → Same as GP-50; command-out only.

## Migration Plan

No stored data. Ship codec/session fix + modal trim; archive syncs the two modified specs and the context/docs notes above.

## Open Questions

None that block implementation. If a Patone capture later disagrees with an editor offset, stop and correct that field only.
