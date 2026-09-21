## Context

See `proposal.md` for why. Today the typed header, `index.html` title, Tauri `productName` / window `title`, and footer all say **Patone**; the footer also says **Unoficial**. Living docs (`docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml`, `.cursor/rules/`) treat that one word as the product. Chrome lives in `src/app/AppShell.tsx`. Bundle id `com.patone.app`, npm name `patone`, and `storageKey` `patone-theme` already exist.

## Goals / Non-Goals

**Goals:**

- One naming split: UI and installer display name = **GP Studio**; living product docs = **Patone GP Studio**.
- Keep technical identifiers so installs and theme prefs do not break.

**Non-Goals:**

- Do not restack MIDI/Bluetooth. Do not invent a logo asset.

## Decisions

### 1. Display name vs identifiers

**Choice:** Change user-visible names only: header, footer, `<title>`, Tauri `productName` and window `title`, Cargo `description`. Leave `identifier` `com.patone.app`, npm `"name": "patone"`, and `storageKey` `patone-theme`.

**Why:** `productName` is the Windows installer name (user-facing). Changing `identifier` would look like a different app to the OS. Changing the theme key would reset appearance. Patone stays as the brand in those ids.

**Alternative:** Rename everything to `gp-studio` / `com.gpstudio.app`. Rejected; breaks updates and prefs for no user-visible gain.

### 2. Living docs vs history

**Choice:** Update `docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml` context, `.cursor/rules/reference-editor.mdc`, and `app-shell` Purpose so product mentions are **Patone GP Studio**, and architecture chrome copy says the visible wordmark is **GP Studio**. Do not rewrite `openspec/changes/archive/` or paused `stomp-assignment`.

**Why:** Archives are a record of what was agreed then. Codec comments that say **Patone-owned** / **Patone capture** stay; that is authorship, not chrome.

**Alternative:** Global replace of Patone everywhere, including archives. Rejected; noisy and rewrites history.

### 3. Footer line

**Choice:** Keep the current footer structure. Bold **GP Studio**, then ` · Independent controller for Valeton GP5/50 · Version 0.1.0 [ Beta Testing ] · ` and the Pato Correnti link. Do not add Patone there.

**Why:** Matches the request without a layout pass.

## Risks / Trade-offs

- [Windows Start Menu / installer still named Patone until rebuild] → Expected; `productName` takes effect on the next `tauri build`.
- [Docs still say Patone in archives] → Intentional; living docs are the contract.
- [Installer display GP Studio vs identifier `com.patone.app`] → Harmless; OS identity stays the brand.

## Migration Plan

Copy and docs only. No data migration. Rollback is reverting the same strings.
