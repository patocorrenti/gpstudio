## 1. Web toolchain

- [x] 1.1 Add `package.json`, Vite + React + TypeScript configs, and `index.html` at the repo root without running `create-tauri-app` on `.`; verify `npm install` succeeds and `openspec/` is untouched
- [x] 1.2 Enable `strict` TypeScript and the `@/` → `src/` alias; verify `tsc` (or `tsc -b`) type-checks an empty-enough tree with no errors

## 2. Tauri 2 shell

- [x] 2.1 Add `src-tauri/` as Tauri 2 with window title `Patone`, identifier `com.patone.app`, size ~1280×800, and Windows bundle targets `nsis` (and `msi` if included); verify those values in `tauri.conf.json` and that no MIDI/midir crates or invoke commands exist
- [x] 2.2 Add scripts `dev` (Vite), `build` (`tsc -b && vite build`), and `tauri` (CLI wrapping `tauri dev` / `tauri build`); verify they are listed in `package.json`

## 3. App layout and placeholders

- [x] 3.1 Create `src/app/`, `src/features/{connect,controller,editor,library}/`, and `src/device/` + `src/midi/` with `.gitkeep` only in device/midi; verify the folders exist and contain no MidiTransport or DeviceSession types
- [x] 3.2 Implement `HashRouter` shell in `src/app` with English nav (Connect `/`, Controller, Editor, Library) and placeholder pages; verify Editor/Library say the feature is not available yet and Connect/Controller are reserved screens with no device controls

## 4. Tailwind and shadcn

- [x] 4.1 Install Tailwind v4 per current shadcn Vite docs; verify a utility class renders in the shell (e.g. layout spacing)
- [x] 4.2 Init shadcn and add `Button` under `src/components/ui`; verify the theme toggle (or equivalent chrome) uses that `Button`

## 5. Dark-default theme

- [x] 5.1 Add `next-themes` with `defaultTheme="dark"`, `enableSystem={false}`, `storageKey="patone-theme"`, and an `index.html` script that sets `html.dark` before paint when storage is empty; verify a first load with cleared storage is dark with no light flash
- [x] 5.2 Add an appearance control that switches light/dark without reload; verify `localStorage["patone-theme"]` updates and a reload restores the chosen scheme

## 6. Launch verification

- [x] 6.1 **Web:** run `npm run dev` and confirm localhost shows Patone, nav, placeholders, and the theme control
- [x] 6.2 **Web:** run `npm run build` and confirm a web bundle is emitted under `dist/`
- [x] 6.3 **Desktop:** run `npm run tauri dev` (install Linux WebKit/Rust deps if needed) and confirm a native window titled Patone hosts the same UI; do not require an NSIS file on this Linux host
