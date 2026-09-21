## 1. Chrome and titles

- [x] 1.1 Change the header wordmark in `src/app/AppShell.tsx` to `GP Studio` and the footer to bold `GP Studio` plus `Independent controller for Valeton GP5/50` (drop Unoficial/Unofficial), keep version and the Pato Correnti link, and verify that file has no `Patone` string
- [x] 1.2 Set `index.html` `<title>` to `GP Studio` and verify it is the document title (leave `patone-theme` storage as-is)
- [x] 1.3 Set `src-tauri/tauri.conf.json` `productName` and window `title` to `GP Studio`, set `src-tauri/Cargo.toml` description to name Patone GP Studio, and verify `identifier` stays `com.patone.app`

## 2. Living docs

- [x] 2.1 Update `docs/architecture.md` so product references are Patone GP Studio and the chrome description says the visible name is GP Studio, and verify the MIDI/USB/Bluetooth constraints are unchanged
- [x] 2.2 Update `docs/protocol-references.md` and `openspec/config.yaml` context so product references are Patone GP Studio, chrome wordmark is GP Studio, and verify `Patone-owned` codec language and the theme `storageKey` stay
- [x] 2.3 Update `.cursor/rules/reference-editor.mdc` product mentions to Patone GP Studio without dropping the no-copy/`Patone-owned` codec rule, and verify `openspec/specs/app-shell/spec.md` Purpose already names Patone GP Studio
- [x] 2.4 Confirm `package.json` name `patone`, `com.patone.app`, and `patone-theme` were not renamed, and that `openspec/changes/archive/` and `openspec/changes/stomp-assignment/` were not rewritten
