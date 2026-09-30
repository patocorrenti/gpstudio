## Why

A Valeton `.prst` downloaded from a GP-50 cannot be loaded on a GP-5, and the reverse is rejected the same way (`docs/architecture.md`: current-patch upload is same-model only). Users already move patches between those pedals; the import should apply what both catalogs share and say so only when something in the file has no home on the connected pedal.

## What Changes

- Download stays a Valeton `.prst` of the **connected** pedal (GP-50 session → GP-50 file; GP-5 session → GP-5 file). Download does not rewrite the file as the other model.
- **BREAKING** for the previous reject: Upload accepts a valid Valeton `.prst` from either model onto the current working patch. A same-model file still applies as it does today (order, on/off, factory models, shared controls, patch volume; GP-50 BPM only when the file and the session are both GP-50).
- A file from the other model is decoded as that file's model, then applied through the existing working-patch writes for whatever the connected pedal's catalog can host. Chain order, module on/off, patch volume, shared factory models (including the twenty user-IR CAB slots), and controls that exist on the target all transfer. A factory model the target catalog does not include is not written. A control the target catalog does not include on an otherwise shared model is not written.
- The user is warned in English **only** when the file contains a factory model the connected pedal's catalog does not include (today: GP-50 PRE C-Wah, PRE AC Sim, and CAB AC on a GP-5). The warning names those models. Confirm still loads the rest. If nothing is omitted, there is no extra warning. Cancel sends nothing.
- An invalid file still sends nothing. Upload still does not store (`114a`), does not change the patch index or the name list, and does not send patch recall solely because upload ran. USB and Bluetooth share this path.
- This revises the current-patch "no GP-5/GP-50 conversion" rule in `docs/architecture.md` for upload only. Library `.prst` import stays out.

## Non-goals

- Library route, library browse/import/reorder, or loading a `.prst` onto a slot the user is not on.
- Changing the on-disk `.prst` layout, or emitting the other model's file on download.
- Copying reverse-engineered JavaScript from `reference/` into `src/`.
- IR / SnapTone / NAM file upload, or warning that a user-IR slot's impulse bytes differ between pedals (the slot index transfers; the onboard IR file does not live in the `.prst`).
- Stomp-assignment writes (`114d`) and EXP writes. Current upload does not send them; this change does not add them, and it does not warn about them.
- A warning for GP-50-only knobs on a model both pedals have (Sync and the same pattern). Those control writes are omitted and the model still transfers.
- A warning for patch BPM. GP-50 BPM is not written onto a GP-5. A GP-5 file does not overwrite GP-50 BPM.
- Inventing a substitute factory model for a slot whose model cannot transfer. That slot keeps the model already on the pedal; order and on/off from the file still apply.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. This stays on the current-patch upload path, not a new spec domain.

### Modified Capabilities

- `device-connection`: Upload applies a valid Valeton `.prst` from either model onto the working patch. Same-model apply is unchanged. Cross-model apply writes only catalog entries the connected pedal hosts, and reports omitted factory models. Invalid bytes still send nothing.
- `live-controller`: Choosing the other model's `.prst` no longer shows a hard error. Controller warns in English only when factory models cannot transfer, and confirming still loads the file through the device session.

## Impact

- `src/device/patch-store.ts`: decode stays per file header. No second file format.
- Session upload: decode with the file's model, drop factory models and controls the target catalog excludes, then the existing write plan (`1147` / `1148`, order, module CC, volume CC 7, GP-50 BPM only when both sides are GP-50). UI still imports only `@/device/session`.
- `src/features/controller/PatchBar.tsx`: English warning in the confirm step when the file omits models; same-model confirm stays as it is.
- About "What's next" drops the GP-5/GP-50 `.prst` compatibility line when this ships. The What's next section itself stays.
- `docs/architecture.md`, `openspec/config.yaml`, and `docs/protocol-references.md` lose the "no cross-model conversion" line for current-patch upload at archive. Library import stays later.
