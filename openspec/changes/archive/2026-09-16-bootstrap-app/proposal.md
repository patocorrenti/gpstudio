## Why

The repo has OpenSpec and the agreed plan in `docs/architecture.md`, but no runnable app yet. Later phase-1 changes (`midi-transport`, `device-connection`, `live-controller`) need a Tauri 2 + Vite/React/TS shell, the planned `src/` layout, and a dark-first UI kit already in place.

## What Changes

- Scaffold a single-app repo (not a monorepo) with Tauri 2, Vite, React, and TypeScript, matching `docs/architecture.md`.
- Add Tailwind and shadcn from day one (chrome primitives: buttons, dialogs, switches). The instrument surface stays custom in later changes.
- Ship light/dark theming via shadcn tokens and the `dark` class, with **dark as the default** first paint. Light is optional.
- Create the agreed folder layout (`src/app`, `src/features/{connect,controller,editor,library}`, `src/device`, `src/midi`, `src-tauri`) with a real app shell and placeholders for later features.
- Add scripts: `dev` (Vite web), `tauri dev` (desktop WebView), and `build` / `tauri build` (web bundle + Windows NSIS/MSI path).

## Non-goals

- MIDI transport, Web MIDI, or Tauri/midir commands (`midi-transport`).
- GP-5/GP-50 detection, session state, or live controller UI.
- Preset editor/library, SysEx, IRs/NAM, Bluetooth, or mobile Tauri packaging.
- Electron, an HTTP backend, or a monorepo.

## Capabilities

### New Capabilities

- `app-shell`: Runnable web and desktop app shell with the planned layout, Tailwind + shadcn, and dark-default theming.

### Modified Capabilities

- None. This is a greenfield scaffold; `openspec/specs/` has no capabilities yet.

## Impact

- New frontend and native tree: `package.json`, Vite/TS config, `src/`, `src-tauri/`.
- New dependencies: React, Vite, TypeScript, Tailwind, shadcn/Radix, Tauri 2.
- No existing application code is modified (none exists).
- Windows installer via `tauri build` is enabled by the scaffold; shipping a signed release is out of scope.
- OpenSpec stays at the repo root next to `src/`.
