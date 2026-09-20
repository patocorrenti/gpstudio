## Context

See `proposal.md` for why. Controller already downloads through `DeviceSession.downloadCurrentPatch` (`Blob` + `<a download>`, no Tauri command). Encode lives in `src/device/patch-store.ts` and matches `_reference/gp50_60-TOB.prst` / `_reference/gp5_60-TOB.prst` (20-byte model header, CRC-8 ATM, `FFFFFFFF`, 10-byte NUL name, model descriptor, packed dump body starting at dump offset 226 / 140). Save commits the working buffer with store SET `114a` (path `01 01 04`); it does not write a dump. Live edits already go out as chain-order SET, model `1147`, control `1148`, and module CC 48–57. The local GP-50 editor HTML only *saves* `.prst`; it has no load path and no bulk dump SET. UI never sends raw MIDI (`docs/architecture.md`). Do not paste `reference/` JavaScript into `src/`.

## Goals / Non-Goals

**Goals:**

- Inverse of the connected-model encoder: parse a `.prst`, reject mismatches, apply onto the working patch. Save (existing) stores with `114a`.
- Confirm before any write. Cancel is a no-op.
- After a successful upload, re-request the current-preset dump so the snapshot matches the working buffer.

**Non-Goals:**

- A new SysEx family or a bulk dump write.
- Cross-model conversion or a destination-slot picker.
- Volume/tuner UI, IR/NAM, Library import, or a Tauri file dialog.

## Decisions

### 1. Decode is the inverse of `encodePrstFile`

**Choice:** Add `decodePrstFile(bytes) → { model, name, dump } | null` next to the encoder. Accept only:

```
[20] ASCII `GP-50` / `GP-5` padded + `01 00`
[1]  CRC-8 ATM of (spacer + name + descriptor + body)
[4]  `FF FF FF FF`
[10] name, spaces as `00`
[N]  descriptor for that model (117 GP-50 / 74 GP-5)
[rest] dump body (400 GP-50 / 398 GP-5)
```

Expand the body onto a nibble dump at the same offsets the encoder slices (`GP50_PRST_BODY_AT` / `GP5_PRST_BODY_AT`). Copy descriptor volume/BPM into the dump word slots the encoder already maps. Null on short files, bad CRC, unknown header, or the other model’s length. Fixture: decode of each TOB capture round-trips through `encodePrstFile` to the same bytes.

**Why:** Same codec rule as download: observed files, not a source drop. Using capture bytes as fixtures is allowed; pasting the HTML builder is not.

**Alternative:** Trust filename `gp50_` / `gp5_` without parsing the header. Rejected; the header is the model. **Alternative:** Copy the reference editor’s hex concat. Forbidden.

### 2. Apply with owned writes; Save stores later

**Choice:** `DeviceSession.uploadCurrentPatch(bytes)` parses first. Wrong model or invalid → `{ ok: false, reason: "wrong-model" | "invalid" }` and no MIDI. On success, decode the reconstructed dump with `decodePresetDump`, then send on the open link (USB vs Bluetooth differ only by the existing BLE-MIDI wrap):

1. Slot model `1147` and catalog-control `1148` for every factory-known effect (flush; do not use the live 80 ms slider throttle).
2. Chain-order SET.
3. Module on/off CC 48–57 for the ten effects. Leave EXP as it is (not in the dump body).
4. Re-request the current-preset dump (same `chainSync` gate as download). No CC 0. No store `114a`.

Do not call `setSlotModel` as the public UI path: that method no-ops when the slot has no known model. Upload uses a session-private apply that always writes decoded factory slots. Unknown wire identities stay unwritable, same as dump decode today. The onboard name does not change. The existing Save control stores the working buffer with `114a`.

Apply paces SysEx (short gap after each write, longer after a model SET and before the dump refresh) because USB `send` and BLE-MIDI `writeValueWithoutResponse` both return before the pedal has applied the previous message; a burst drops trailing writes.

**Why:** `114a` only commits whatever is in the working buffer. Combining apply and store in one burst stored a partial patch when writes dropped. Loading first lets the user hear the result and Save when it is right.

**Alternative:** Invent a bulk dump SET from unused families (`1149` is on/off in the HTML, not a dump). Rejected until a Patone capture shows the pedal storing a whole body from one SysEx. **Alternative:** Apply and store in one shot. Rejected after operator apply: store was the write most often lost. **Alternative:** Apply only catalog knobs and skip order/on/off. Rejected; a downloaded then re-uploaded TOB would not sound the same.

### 3. Patch volume / BPM from the descriptor, not a volume UI

**Choice:** Volume and BPM live in the descriptor (dump offsets 100 / 110 sit *before* the packed body). After the chain writes, send those two values with the same parameter-write family if a Patone capture (or a black-box run of the reference editor’s `sendPatchVol` / `sendBPM`) locks the packed `1142` body. If that SET is ignored at apply, keep the rest of the upload and do not block on it. Do not add volume/BPM controls.

**Why:** A round-trip of TOB would otherwise lose levels that Download already encodes. This is restoring file fields, not shipping volume UI.

**Alternative:** Ignore descriptor globals. Rejected unless the SET cannot be locked; then note it and ship chain+store only.

### 4. Session result, Controller file picker + Dialog

**Choice:**

```
uploadCurrentPatch(bytes) →
  { ok: true } |
  { ok: false, reason: "invalid" | "wrong-model" | "busy" | "disconnected" }
```

No-op when disconnected, `sync !== "ready"`, or `chainSync === "syncing"` (same as `stepPatch`). Upload does **not** require `canExportPatch` / a held dump.

`PatchBar` adds Upload beside Download. Hidden `<input type="file" accept=".prst">` (Vite and Tauri webview; no new command). Parse locally as soon as a file is chosen: invalid / wrong-model → English error Dialog, no confirm, no session write. Valid → confirm Dialog (“Load file into current patch?”, naming the current patch like `62 | Name`, and that unsaved changes will be overwritten). Cancel closes. Accept calls `uploadCurrentPatch`. React never sends MIDI.

**Why:** Spec requires confirm-before-replace *and* an English error for bad files. Validating first avoids confirming a file we will reject. Same Dialog primitive as rename/duplicate; keep it in `PatchBar` (feature UI rule).

**Alternative:** Confirm before the picker. Rejected; the user would confirm without knowing which file. **Alternative:** Tauri native dialog. Rejected; Download already uses the web download path.

### 5. Docs

**Choice:** Current-patch `.prst` **load into the working patch** becomes in-scope in `docs/architecture.md`, `openspec/config.yaml`, and `docs/protocol-references.md`. Store remains Save / rename / duplicate (`114a`). Library **import** of `.prst` stays out. Note decode is the inverse of the locked layout, and that upload is working-buffer writes, not a dump SET and not a store.

## Risks / Trade-offs

- [Catalog-only apply misses dump fields we do not decode] → Decode the same body Download encodes; round-trip TOB fixtures. Unknown identities stay unwritable rather than inventing models.
- [Bluetooth floods on ~10 models + many `1148`s] → Await each `sendBytes` and add a short gap at apply only (longer after a model SET). Do not insert the 80 ms slider throttle as the only pacing. Do not guess a new family.
- [Patch volume/BPM SET is ignored, like the paused stomp-assignment lab] → Capture at apply. If ignored, keep chain writes and document the leftover; do not block the change.
- [Optimistic snapshot is wrong if the pedal rejected a write] → Spec already requires a dump refresh after success; that dump is source of truth.
- [Suite `.prst` with a shorter/longer descriptor than the TOB captures] → Reject as invalid rather than guess a slice. Acceptance is files Patone can download, plus the TOB captures.

## Migration Plan

Additive. Rollback is reverting the change. No stored files to migrate. Disconnect still drops dump and store state.

## Open Questions

None that block this slice. Packed `1142` volume/BPM (if used) is an apply-time capture fill-in, not a spec change.
