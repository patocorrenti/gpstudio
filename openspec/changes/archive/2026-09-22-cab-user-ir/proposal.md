## Why

Controller already decodes factory CAB models from the current-preset dump (`docs/architecture.md`), but a patch that loads one of the pedal’s twenty user IR slots is treated as an unknown wire identity: no CAB panel, no name, no way to select that slot. GP-5 and GP-50 store those IRs on the device (manual: up to 20 third-party cabinet IR files); this is the dedicated later IR **read** slice that `chain-slot-controls` deferred.

## What Changes

- Catalog the twenty onboard user IR CAB slots (same VOL control as factory cabs) so a current-preset dump or live model notify that points at one of them is a known CAB model, not an unwritable unknown.
- After connect, request the pedal’s IR-name dump (Patone-owned codec; `docs/protocol-references.md`). When names arrive, the CAB model select shows those names; empty or missing names keep the English fallback `User IR 01`…`User IR 20`.
- The IR-name dump is device-global, not per patch. It MUST NOT block Controller identity or chain loading. Reload and patch change keep requesting the current-preset dump only.
- Selecting a user IR slot in the CAB panel uses the existing model SET (`1147`, path `01 01 04`). VOL still uses the existing control SET (`1148`).
- `docs/architecture.md` and `openspec/config.yaml`: IR **name read** and user-IR CAB select become in-scope SysEx. IR / SnapTone / NAM **file upload** stays later.

## Non-goals

- Uploading `.wav` / IR files, replacing an IR slot’s audio, or deleting IRs (`docs/architecture.md`).
- NAM / SnapTone user-file dumps or names (NS catalog stays factory-only).
- Globals dump, preset-status dump, or matching the reference editor’s full post-connect sequence.
- Editor / Library routes, IR library UI, or a new spec domain.
- Copying JavaScript from `reference/` / `_reference/` into `src/`.
- Mobile packaging. Treating USB and Bluetooth as interchangeable.

## Capabilities

### New Capabilities

- None. User IRs are CAB models plus one extra requested dump on the existing session, not a new spec domain.

### Modified Capabilities

- `live-controller`: The CAB panel’s model select includes the twenty user IR slots. Labels use dumped names when known, otherwise `User IR 01`…`User IR 20`. Same presentation on USB and Bluetooth. Identity loading and chain refresh MUST NOT wait for the IR-name dump.
- `device-connection`: The catalog and dump decoder treat user-IR wire identities as writable CAB models. After connect, the session requests the IR-name dump on the open link without blocking readiness. The snapshot carries up to twenty IR names; disconnect drops them. Selecting a user IR slot sends the existing model SET.

## Impact

- `src/device/catalog/cab.ts` (+ types if a user-IR slot flag is needed): twenty catalog entries with locked wire identities.
- New Patone IR-name request/decoder in `src/device/` (sibling of identity / chain codecs). `DeviceSession` requests once per session after identity+chain, applies names fail-open, and must not feed IR fragments into `ChainDecoder`.
- `src/features/controller/` CAB `ModelSelect`: overlay dumped names; search matches those names.
- `docs/architecture.md`, `openspec/config.yaml`, `docs/protocol-references.md`: IR-name read in; file upload still out.
- No new Tauri commands, HTTP backend, or transport contract. USB vs Bluetooth fragment headers are locked from Patone Log at apply, not pasted from the reference editor.
