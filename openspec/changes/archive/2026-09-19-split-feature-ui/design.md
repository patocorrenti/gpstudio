## Context

See `proposal.md` for why. `docs/architecture.md` already puts Connect under `src/features/connect/` and Controller under `src/features/controller/`. Today those features are almost one file each: `ConnectionStatus.tsx` owns the trigger plus three dialog screens (connected, select-model, USB/Bluetooth scan) with duplicated endpoint lists; `ControllerPage.tsx` already has named inner components (`PatchBar`, `AudioChainRow`, `SlotControlPanel`, …) but they all live in one ~821-line module. `src/components/` is shadcn (`ui/`) plus shell chrome (`main-menu.tsx`, `theme-toggle.tsx`). UI still talks only to `DeviceSession` via existing hooks.

## Goals / Non-Goals

**Goals:**

- Colocate split UI next to the feature, not under `src/components/`.
- Cut Connect and Controller along seams that already exist in the JSX.
- Encode the placement rule in architecture docs, agent `context`, and a Cursor rule.

**Non-Goals:**

- Changing session, MIDI, Bluetooth, or observable UI.
- A nested `components/` folder per feature unless a later split actually needs it.
- Barrel `index.ts` files, shared hooks extraction, or splitting Log / Editor / Library.

## Decisions

### 1. Feature folder, not `src/components/<domain>/`

**Choice:** New files stay as siblings in `src/features/connect/` and `src/features/controller/`. `src/components/ui/` remains shadcn. `src/components/` remains shell chrome. Promote a widget to `src/components/` only when a second feature imports it.

**Why:** Matches the tree in `docs/architecture.md`. A `src/components/connection/` tree would duplicate `features/connect/` and invite dumping pedal UI next to Button/Dialog.

**Alternative:** `src/features/connect/components/`. Rejected for this pass; the feature folders are still small enough for flat files. **Alternative:** domain folders under `src/components/`. Rejected; that was the path we agreed not to take.

### 2. When to split (the durable rule)

Extract when at least one is true:

- One module mixes an orchestrator with two or more distinct screens or blocks.
- The same JSX is pasted twice (Connect USB vs Bluetooth lists).
- Named inner functions already read as components and the parent is hard to navigate.

Do not extract a lone button, a file that is still one cohesive screen, or “just in case” design-system pieces.

### 3. Connect file seams

**Choice:** Keep `ConnectionStatus` as the exported orchestrator (state, scan, connect/disconnect, which panel). Move presentational blocks:

```
src/features/connect/
  ConnectionStatus.tsx     # trigger + Dialog shell + state
  ConnectedPanel.tsx
  SelectModelPanel.tsx
  ScanPanel.tsx            # USB | Bluetooth tabs, notes, refresh
  EndpointList.tsx         # one list for both links
  PedalThumb.tsx
```

`ModeNotes` can live in `ScanPanel.tsx` (only used there). `DeviceSessionProvider` and `RequirePedal` stay as they are. `AppShell` keeps importing `@/features/connect/ConnectionStatus`.

**Why:** Three dialog bodies are already separate trees. USB and Bluetooth lists differ only in copy and the endpoint type; one `EndpointList` removes the paste.

**Alternative:** One file per tiny helper (`ModeNotes`, empty-state banner). Rejected; that is over-splitting.

### 4. Controller file seams

**Choice:** Lift the inner functions that already exist:

```
src/features/controller/
  ControllerPage.tsx       # RequirePedal + ConnectedController + SyncingController + PatchBody
  PatchBar.tsx
  AudioChain.tsx           # row + slot + dnd
  SlotControls.tsx         # panel grid + knob/toggle
  chain-slot-icons.ts      # CHAIN_SLOT_ICONS (+ cable offset if both need it)
```

Keep `useDeviceSession` / `useSessionSnapshot` in the pieces that already call them (`PatchBar`, slot toggle, knobs). Do not funnel every action through `ControllerPage` as props.

**Why:** The functions are already the right grain; the problem is the single file. Slot icons are shared by the chain and the panels, so they leave both as a tiny module.

**Alternative:** One file per inner function (`SlotControl.tsx`, `AudioChainSlotView.tsx`, …). Rejected; that explodes the tree without a second consumer. **Alternative:** Extract custom hooks first. Rejected; this change is file layout, not a hook rewrite.

### 5. Leave small features alone

**Choice:** `MidiInMonitor.tsx`, Editor/Library stubs, and `RequirePedal` are not split.

**Why:** They are already one screen. The rule applies when they grow, including Editor/Library later.

### 6. Where the rule lives

**Choice:** Three durable places, same text in spirit:

- `docs/architecture.md` — repo tree plus the extract/promote rule.
- `openspec/config.yaml` `context` — so propose/apply agents do not invent `src/components/connection/`.
- `.cursor/rules/feature-ui.mdc` — `alwaysApply: true`, under ~50 lines, with a good/bad path example (same pattern as `reference-editor.mdc`).

**Why:** Architecture is the agreed plan; `context` is the agent constraint; the Cursor rule fires even when those docs are not open. Do not add a capability spec: folder names are not observable behavior.

## Risks / Trade-offs

- [Split changes markup by accident] → Move JSX as-is; no class or copy edits in the same pass. Typecheck (`npx tsc -b --pretty false`) is the gate; the user tests the UI.
- [Too many tiny files] → Stop at the lists in decisions 3–4. Do not add a `components/` subfolder in this change.
- [Later features ignore the rule] → Cursor rule + `context` are the mitigation; a later oversized Editor file is Direct-lane split, not another architecture change unless the rule itself changes.
- [Import churn in AppShell] → Keep public entry files and paths.

## Migration Plan

Split Connect first (smaller, duplicated list). Split Controller second. Write docs and the Cursor rule with the code so apply does not leave an undocumented tree. Rollback is reverting the change; no data or protocol migration.

## Open Questions

None. Grain of the file lists is fixed above; apply should not invent extra files.
