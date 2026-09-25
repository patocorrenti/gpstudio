---
name: release-version
description: >-
  Bump GP Studio to a new version: English changelog entry, version numbers in
  package, lockfiles, Tauri, footer, index.html, and README, then commit, create an
  annotated git tag, and push the tag. Use when the user asks to release, bump
  or change the version, add a changelog version, or create and push a version tag.
---

# Release version

Do not edit version files by hand. `scripts/release.mjs` updates them together so the tag points at one commit that has both the changelog and the numbers.

## Before running

1. Get the target version (`x.y.z`, greater than `package.json`) and the user-facing changes. If they were not given, ask.
2. Changelog bullets are English, one line each, in the voice of the About page. Translate Spanish notes. Do not invent changes.
3. Show the version and the exact English bullets, then stop. Do not run the release until the user explicitly confirms those texts. If they change the wording, show the revised list and wait again.
4. The working tree must be clean, and the branch must not be behind its upstream. If not, stop and say so. The check can happen before the confirmation. The release command runs only after the user accepts the texts.

## Run

From the repo root:

```bash
npm run release -- <x.y.z> --note "English bullet" --note "Another bullet"
```

That command:

- prepends a Changelog section on the About page and keeps older versions
- sets the same version in `package.json`, `package-lock.json` (root package only), `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (package `app`), `src-tauri/tauri.conf.json`, the footer version marker `{' '}vX.Y.Z` in `src/app/AppShell.tsx`, `softwareVersion` in `index.html`, and the Status line in `README.md` (`Version x.y.z. The official app`)
- commits `feat: release <version>`
- creates annotated tag `v<version>` with message `Versión <version> - <first note>`
- pushes the current branch and the tag to `origin`

Add `--no-push` only when the user wants the commit and tag to stay local. Add `--dry-run` to preview without writing. `npm run release -- --check` only verifies the current numbers match.

Do not amend the release commit, force-push, or skip hooks. If the script fails after writing files, fix the reported problem and rerun only once the working tree is back to a state the script accepts. Do not finish the release with a manual tag on a different commit.
