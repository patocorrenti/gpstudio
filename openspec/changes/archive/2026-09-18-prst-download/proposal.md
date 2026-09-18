## Why

Controller already downloads the current patch, but as a Patone-owned `.patch` wrapper that Valeton Suite cannot load (`docs/architecture.md`). Users need the same Download control to write the **Valeton `.prst`** that Suite and the reference editors already interchange. We have operator captures of the same preset as both files (`_reference/gp5_60-TOB.prst`, `_reference/gp50_60-TOB.prst`).

## What Changes

- **BREAKING:** Download no longer writes a Patone `.patch`. It writes a Valeton `.prst` for the **connected** pedal (GP-50 session → GP-50 `.prst`; GP-5 session → GP-5 `.prst`).
- Filename follows that interchange (`gp50_60-TOB.prst` / `gp5_60-TOB.prst`), not `gp50-60-TOB.patch`.
- Encoder is Patone-owned and must match those captures (header, CRC-8 ATM, name, descriptor, dump body). Do not paste `reference/` JavaScript.
- Architecture / OpenSpec context: current-patch `.prst` **export** is in-scope Controller download. Library import/reorder of `.prst` stays later.
- Same busy gate, USB/Bluetooth, and session-owned download as today. No new Tauri command.

## Non-goals

- Dropdown to download “as GP-5” or “as GP-50” and convert across models. Native file for the connected pedal only.
- Importing a `.prst` back onto the pedal (Library).
- Copying reverse-engineered JavaScript or hardcoded builder strings from `reference/` HTML into `src/`.
- Changing Save, rename, or duplicate.
- IR / NAM, Editor route, volume/tuner UI.

## Capabilities

### New Capabilities

- None. This replaces the download file format of the existing Controller patch bar.

### Modified Capabilities

- `live-controller`: Download produces a Valeton `.prst` named for the connected model, not a Patone `.patch`.
- `device-connection`: `downloadCurrentPatch` returns `.prst` bytes for the connected model’s dump. Still no extra recall; still no invented file if the dump is missing.

## Impact

- `src/device/patch-store.ts` (replace Patone magic wrapper with `.prst` encode from captures).
- `DeviceSession.downloadCurrentPatch` filename/bytes; Controller `Blob` download unchanged besides the name.
- `docs/architecture.md`, `openspec/config.yaml`, `docs/protocol-references.md`: current-patch `.prst` export in; Library import still out.
- Captures stay in `_reference/` as behavioral fixtures, not source to paste.
