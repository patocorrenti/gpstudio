## Why

GP-50 Global settings already read and write on the open link. On GP-5 the same modal does not behave like the working reference editors (`_reference/GP5bluetooth.html`, `_reference/gp5usb.html`): settings stay unusable or wrong, while those editors sync and edit the GP-5 rows. The GP-5 Global Settings modal in those editors also has no master / Global Vol row (Global Vol sits on the main page there). Patone still lists Global volume first in the GP-5 modal and treats it like GP-50 master volume, which the pedal’s settings UI does not expose.

## What Changes

- Make GP-5 device globals actually land in the session after connect (dump classify / assemble / apply) and send immediate writes for every row the GP-5 Global settings modal exposes, matching the reference editors’ ask, offsets, and effect/flag pairs.
- **BREAKING (UI contract):** Remove Global volume / master volume from the GP-5 Global settings modal. GP-5 MUST NOT show master volume or Global volume there. GP-50 master volume (CC 1) stays unchanged.
- Keep GP-5 modal rows aligned with the reference Global Settings dialog: input level, No CAB, REC level, BT REC, monitor level, screen brightness (Bluetooth editor has it; USB editor omits the control but the dump field remains), and footswitch mode (`0-99` / `0-9` / `A-Z` / `CTL` / `Tuner`). No REC mode, no Patch|Stomp, no Global BPM.
- Update durable specs and project context so the GP-5 modal no longer requires Global volume first.

## Non-goals

- Adding a main-page Global Vol control (reference puts it outside Settings; patch-bar volume stays CC 7).
- Changing GP-50 globals, CC 1, CC 28, or REC mode.
- Global BPM, EXP calibrate, factory reset, or other GLOBAL rows with no MIDI path.
- Pasting reference editor JavaScript into `src/` (see `docs/architecture.md` and `docs/protocol-references.md`).
- Library, Editor route, IR/NAM file upload, or mobile packaging.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `device-connection`: GP-5 globals read/write stay required, but the session MUST NOT expose master volume or Global volume as a Global-settings-editable field; dump decode may still see the volume byte without driving the modal.
- `live-controller`: GP-5 Global settings modal lists only the reference Settings rows (no master / Global volume); GP-50 modal unchanged.

## Impact

- `src/device/globals.ts` — confirm GP-5 dump classify/decode and SETs against the reference; stop treating Global volume as a required modal field.
- `src/device/session/globals.ts`, `device-session.ts`, `writes.ts`, `encode.ts` — ensure GP-5 ask, apply, and writes run on USB and Bluetooth.
- `src/features/connect/GlobalSettingsModal.tsx` — drop the GP-5 Master / Global volume section.
- `openspec/specs/device-connection/spec.md`, `openspec/specs/live-controller/spec.md`, `openspec/config.yaml` context, and short notes in `docs/protocol-references.md` / `docs/architecture.md` when archiving.
- Codec self-checks / session checks as needed; no new dependencies.
