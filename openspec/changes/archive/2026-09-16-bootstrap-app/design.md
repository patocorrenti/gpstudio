## Context

Greenfield: the repo has OpenSpec, `docs/architecture.md`, and Cursor commands, but no `src/`, `src-tauri/`, or `package.json`. See `proposal.md` for why, and `specs/app-shell/spec.md` for observable behavior. Stack and layout constraints come from `docs/architecture.md`. This host is Linux; Windows NSIS/MSI is the shipping target, not the current dev OS.

## Goals / Non-Goals

**Goals:**

- Land a Tauri 2 + Vite + React + TypeScript app beside the existing OpenSpec tree (single repo, not a monorepo).
- Install Tailwind + shadcn and a dark-first theme that persists, with no first-paint flash of light.
- Match the agreed `src/` layout so later changes drop into known folders.
- Scripts: `dev`, `tauri dev`, `build`, `tauri build`.

**Non-Goals:**

- MidiTransport, midir, DeviceSession, or any MIDI/device types (those belong to later changes).
- A visual design system beyond shadcn chrome + theme toggle.
- Cross-compiling a Windows installer on Linux, signing, or CI.

## Decisions

### 1. Scaffold by hand next to OpenSpec, not `create-tauri-app .`

**Choice:** Add Vite/React/TS and Tauri 2 files into the existing repo. Do not run `create-tauri-app` on `.` (it would fight OpenSpec, docs, and `.cursor/`).

**Why:** The planning home already occupies the root. A template-in-place overwrite is the main way to lose it.

**Alternative:** Scaffold in a temp dir and merge. Same outcome, more moving parts.

### 2. Tauri 2 webview now; midir later

**Choice:** `src-tauri/` is a stock Tauri 2 crate (window, bundle config). No MIDI plugins, no Rust commands beyond the default ping/hello if the template has one — prefer **no extra commands** so `midi-transport` owns that surface.

**Why:** Isolating Web MIDI / midir behind MidiTransport is a later change. Putting a stub command in now invites the UI to call native MIDI early.

**Alternative:** Add midir “empty”. Rejected; it is the next change.

### 3. Tailwind v4 + shadcn (Vite) for chrome only

**Choice:** Current shadcn Vite install (Tailwind v4, CSS variables, `src/components/ui`). Add only what the shell needs now: `Button` plus a theme control (button or dropdown). Feature screens do not compose the controller out of Cards.

**Why:** Agreed stack. shadcn is Radix + tokens; the pedal surface stays custom in `live-controller`.

**Alternative:** Unstyled Radix only. Rejected; we chose shadcn.

### 4. Dark default, no OS theme, persist in localStorage

**Choice:** `next-themes` (works with Vite) with `defaultTheme="dark"`, `enableSystem={false}`, `storageKey="patone-theme"`, attribute `class`. A small inline script in `index.html` sets `class="dark"` on `<html>` before paint when no stored value exists, or restores `light`/`dark` from storage, to avoid a light flash.

**Why:** Spec requires dark first paint and restored preference. Following `prefers-color-scheme` would show light on a light OS and violate the default.

**Alternative:** CSS-only `:root` / `.dark` without a library. Viable later; `next-themes` is the usual shadcn pairing and handles the class + storage.

### 5. Hash-based routing

**Choice:** React Router with `HashRouter`. Routes: `/` (Connect placeholder), `/controller`, `/editor`, `/library`. Shell in `src/app` with nav + theme toggle.

**Why:** Tauri production uses a custom protocol; hash routes avoid blank reloads. Four screens, no auth.

**Alternative:** `BrowserRouter` + Vite history fallback. Fine in `tauri dev` (localhost), brittle in packaged webview.

### 6. Layout vs MIDI folders

**Choice:** Create the architecture folders. `src/features/{connect,controller,editor,library}` get placeholder pages (English copy). `src/device/` and `src/midi/` get a `.gitkeep` only — **no types, no fake transport**. shadcn lives in `src/components/ui`. Alias `@/` → `src/`.

**Why:** Later changes should not invent a parallel tree. Defining MidiTransport now would freeze an API without the midi-transport design.

**Alternative:** Pre-write `MidiTransport` as `throw new Error("not implemented")`. Rejected; it is spec-level MIDI behavior in the wrong change.

### 7. Window and bundle

**Choice:** Window title `Patone`, identifier `com.patone.app`, default size ~1280×800. Bundle config includes Windows `nsis` (and `msi` if kept as a second target). On this Linux host, verify `npm run dev` / `npm run build` and `tauri dev` (Linux webview). Treat NSIS as configuration ready for a Windows build, not an artifact this machine must emit.

**Why:** Architecture’s shipping package is Windows; the spec’s “produces a Windows installer” is met by a project that is configured to emit NSIS/MSI. Forcing cross-compile on Linux is out of proportion for bootstrap.

**Alternative:** Only configure Linux bundles until a Windows CI job exists. Weaker: the Windows path would be unspecified.

### 8. TypeScript and scripts

**Choice:** `strict` TS. Scripts: `dev` → Vite, `build` → `tsc -b && vite build`, `tauri` → Tauri CLI (`tauri dev` / `tauri build`). npm as the package manager (no lockfile yet). UI strings and code comments in English.

## Risks / Trade-offs

- [create-tauri-app clobber] → Write files explicitly; never scaffold onto `.` with force.
- [Light flash before React] → Inline theme script on `<html>` plus `defaultTheme="dark"`.
- [Linux host cannot emit NSIS] → Configure Windows targets now; verify web + `tauri dev` here; produce the installer on Windows/CI later.
- [Rust/WebKit2GTK missing] → Install Tauri Linux deps if `tauri dev` fails; web `dev`/`build` still prove the UI shell.
- [shadcn/Tailwind version skew] → Follow current official Vite + shadcn install, pin what the CLI writes.

## Migration Plan

First-time scaffold. No data to migrate. Rollback is `git clean` of generated app files if the change is abandoned before archive.

## Open Questions

None. Window size, identifier, and “no MidiTransport stubs” are decided above.
