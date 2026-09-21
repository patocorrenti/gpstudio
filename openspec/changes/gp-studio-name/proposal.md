## Why

The chrome still types **Patone** as the product, and living docs treat that one word as the whole name. Patone is the brand; the application is **GP Studio**, full name **Patone GP Studio**. Users should see GP Studio (and Independent, not Unofficial) while internal docs name the product in full.

## What Changes

- Header wordmark, document title, and native window / installer display name show **GP Studio**. **Patone** MUST NOT appear in the UI.
- Footer shows **GP Studio** and **Independent** (replacing Unofficial / Unoficial). The rest of the footer line stays (Valeton GP5/50, version, Pato Correnti).
- Living documentation and agent context that name the product say **Patone GP Studio** (`docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml` context, `.cursor/rules/`, Cargo crate description). Architecture chrome copy matches the UI: the visible name is GP Studio.
- `app-shell` requirements for window title and chrome product name change from Patone to GP Studio; footer copy is specified.

## Non-goals

- MIDI, SysEx, Connect, Controller, Editor, Library, IRs/NAM, or mobile packaging (`docs/architecture.md`).
- Changing the Tauri bundle identifier `com.patone.app`, npm package name `patone`, theme `storageKey` `patone-theme`, or the on-disk repo folder. Those stay as brand/technical ids so existing installs and prefs keep working.
- Rewriting archived OpenSpec changes or paused `stomp-assignment` lab notes.
- A new graphic logo. The wordmark stays typed text, now **GP Studio**.
- Renaming code modules, console prefixes (`[patone]`), or the authorship phrase **Patone-owned** in codecs.

## Capabilities

### New Capabilities

- None. Naming is chrome of the existing shell.

### Modified Capabilities

- `app-shell`: Visible product name, page/window titles, and footer copy. Desktop window titled GP Studio; chrome wordmark GP Studio; footer GP Studio and Independent.

## Impact

- `src/app/AppShell.tsx`: header wordmark and footer.
- `index.html` `<title>`, `src-tauri/tauri.conf.json` `productName` / window `title`, `src-tauri/Cargo.toml` description.
- `docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml` context, `.cursor/rules/reference-editor.mdc`.
- No new dependencies, MIDI, or SysEx.
