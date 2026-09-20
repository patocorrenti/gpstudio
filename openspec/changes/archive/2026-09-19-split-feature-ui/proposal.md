## Why

Connect and Controller UI already live in `src/features/` (`docs/architecture.md`), but two screens grew into single files (`ConnectionStatus.tsx` ~527 lines, `ControllerPage.tsx` ~821) that mix session orchestration with several presentational blocks. Agents and humans will keep dumping more UI into those files—or into `src/components/`—unless the layout rule is written down before Editor and Library leave their stubs.

This is Change-lane because it is architecture (where feature UI lives), not a silent one-file tidy-up. Observable Connect / Controller / Log behavior does not change; `.openspec.yaml` sets `skip_specs: true`.

## What Changes

- Write the file-layout rule: feature UI stays under `src/features/<feature>/`; `src/components/ui/` stays shadcn primitives; `src/components/` stays shell chrome (`main-menu`, `theme-toggle`). Do not add `src/components/connection/` or other domain folders there.
- Split oversized Connect and Controller files along existing seams (dialog screens, endpoint list, patch bar, audio chain, slot panels). Public exports used by the shell (`ConnectionStatus`, `ControllerPage`) keep the same names and import paths.
- Document the rule in `docs/architecture.md`, the `context` field of `openspec/config.yaml`, and a Cursor rule so later work follows it without another change.
- Leave small files alone (`MidiInMonitor`, `RequirePedal`, Editor/Library stubs). Do not move session, MIDI, or Bluetooth code.

## Non-goals

- No change to connect, disconnect, USB vs Bluetooth tabs, patch bar, chain, knobs, Log, or any MIDI/SysEx path (`docs/architecture.md`).
- No new shared design-system components, no `src/components/connection/`.
- No Editor or Library implementation; those stay stubs until their own changes.
- No work on the paused `stomp-assignment` lab.
- No copied JavaScript from `reference/`.

## Capabilities

### New Capabilities

- None. File layout is not a user-facing capability. Specs stay in `midi-transport`, `device-connection`, `live-controller`, `bluetooth-link`, and `inbound-log`.

### Modified Capabilities

- None. Connect still opens a modal from the shell control; Controller still shows patch bar, chain, and slot panels. Implementation moves; requirements do not. `skip_specs: true` in this change's `.openspec.yaml`.

## Impact

- `src/features/connect/` and `src/features/controller/`: split presentational pieces; keep `DeviceSession` behind existing hooks.
- `src/app/AppShell.tsx` import of `ConnectionStatus` stays.
- `docs/architecture.md` repo tree and `openspec/config.yaml` context gain the placement rule.
- New Cursor rule under `.cursor/rules/` (always-on, like `reference-editor.mdc`).
- No new dependencies, transports, or routes.
