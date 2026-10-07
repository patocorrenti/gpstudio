## Why

Controller already lists factory SnapTone (NS) models from the static catalog, but a patch that loads one of the pedal’s twenty-four user SnapTone / NAM slots is treated as an unknown wire identity: no NS panel, and those slots never appear in the model select. The reference editors request a separate Nam dump after IR names and fill eighty NS options (factory plus user). `cab-user-ir` already solved the sibling CAB case; NS stays factory-only until this slice.

## What Changes

- Catalog the twenty-four onboard user SnapTone NS slots (same Gain / VOL / Bass / Middle / Treble controls as factory NS) so a current-preset dump or live model notify that points at one of them is a known NS model, not an unwritable unknown.
- After connect, request the pedal’s SnapTone / Nam name dump (GP Studio-owned codec; `docs/protocol-references.md`). When names arrive, the NS model select shows those names for user slots; empty or missing names keep the English fallback `SnapTone 01`…`SnapTone 24`.
- The Nam dump is device-global, not per patch. It MUST NOT block Controller identity or chain loading. Reload and patch change keep requesting the current-preset dump only and MUST NOT re-request Nam names.
- Selecting a user SnapTone slot in the NS panel uses the existing model SET (`1147`, path `01 01 04`). Knobs still use the existing control SET (`1148`).
- `docs/architecture.md` and `openspec/config.yaml`: SnapTone / Nam **name read** and user-NS catalog/select become in-scope SysEx. IR / SnapTone / NAM **file upload** stays later.

## Non-goals

- Uploading `.nam` / SnapTone files, replacing a user slot’s audio, or deleting SnapTones (`docs/architecture.md`).
- Retagging or rewriting the factory NS list (indices `0`–`55` / wires `00`–`37` stay as today).
- Preset-status dump, or matching the reference editor’s full post-connect sequence order beyond the Nam ask after IR names (or after the first current-preset dump alongside IR / globals).
- Editor / Library routes, SnapTone library UI, or a new spec domain.
- Copying JavaScript from `reference/` / `_reference/` into `src/`.
- Mobile packaging. Treating USB and Bluetooth as interchangeable.

## Capabilities

### New Capabilities

- None. User SnapTones are NS models plus one extra requested dump on the existing session, not a new spec domain.

### Modified Capabilities

- `live-controller`: The NS panel’s model select includes the twenty-four user SnapTone slots. Labels use dumped names when known, otherwise `SnapTone 01`…`SnapTone 24`. Same presentation on USB and Bluetooth. Identity loading and chain refresh MUST NOT wait for the Nam dump.
- `device-connection`: The catalog and dump decoder treat user-NS wire identities as writable NS models. After connect, the session requests the Nam dump on the open link without blocking readiness. The snapshot carries up to twenty-four SnapTone names; disconnect drops them. Selecting a user SnapTone slot sends the existing model SET.

## Impact

- `src/device/catalog/ns.ts` (+ types if a user-SnapTone slot flag is needed): twenty-four catalog entries with locked wire identities (`38 00 00 0f`…`4f 00 00 0f`).
- New GP Studio Nam / SnapTone-name request/decoder in `src/device/` (sibling of `ir-names.ts`). `DeviceSession` requests once per session after identity+chain (with IR / globals), applies names fail-open, and must not feed Nam fragments into `ChainDecoder`.
- `src/features/controller/` NS `ModelSelect`: overlay dumped names; search matches those names.
- `docs/architecture.md`, `openspec/config.yaml`, `docs/protocol-references.md`: Nam-name read in; file upload still out.
- No new Tauri commands, HTTP backend, or transport contract. USB vs Bluetooth fragment headers are locked from reference editors / GP Studio Log at apply, not pasted from the reference editor.
