## 1. Document the layout rule

- [x] 1.1 Update `docs/architecture.md` so the repo tree lists `src/components/ui/` (shadcn only), `src/components/` (shell chrome only), and feature UI under `src/features/<feature>/`, plus the extract/promote rule from design.md, and verify that section forbids `src/components/connection/` (or other domain folders under `src/components/`)
- [x] 1.2 Mirror that placement rule in the `context` field of `openspec/config.yaml` (feature UI stays in `src/features/`; do not invent domain folders under `src/components/`), and verify the file still parses (`openspec context --json`)
- [x] 1.3 Add `.cursor/rules/feature-ui.mdc` (`alwaysApply: true`, under 50 lines, good/bad path example) stating the same rule, and verify the file exists next to `reference-editor.mdc`

## 2. Split Connect

- [x] 2.1 Extract `PedalThumb.tsx`, `ConnectedPanel.tsx`, `SelectModelPanel.tsx`, `ScanPanel.tsx`, and `EndpointList.tsx` as siblings of `ConnectionStatus.tsx` in `src/features/connect/`, move JSX as-is (one `EndpointList` for USB and Bluetooth), and verify those files exist and there is no `src/components/connection/`
- [x] 2.2 Keep `ConnectionStatus` as the orchestrator (state, scan, connect/disconnect, which panel) exporting the same name from `@/features/connect/ConnectionStatus`, leave `DeviceSessionProvider` and `RequirePedal` in place, and verify `AppShell` still imports that path with no new barrel file

## 3. Split Controller

- [x] 3.1 Extract `PatchBar.tsx`, `AudioChain.tsx`, `SlotControls.tsx`, and `chain-slot-icons.ts` as siblings of `ControllerPage.tsx` in `src/features/controller/` along the inner functions already in that file, keep session hooks in the pieces that already call them, and verify those files exist and `ControllerPage` still exports from `@/features/controller/ControllerPage`
- [x] 3.2 Leave `MidiInMonitor`, `RequirePedal`, and Editor/Library stubs unsplit, and verify this change did not add a `components/` subfolder under `src/features/connect/` or `src/features/controller/`

## 4. Check

- [x] 4.1 Run `npx tsc -b --pretty false` and fix type errors from this change
