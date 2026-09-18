## Context

See `proposal.md` for why. Controller already downloads through `DeviceSession.downloadCurrentPatch` (`Blob` + `<a download>`, no Tauri command). Today that returns a Patone wrapper (`PATO` magic + model + slot + name + dump) named `gp50-05-Flow.patch` (`src/device/patch-store.ts`). Operator captures of the same preset: `_reference/gp50_60-TOB.prst` (552 bytes) and `_reference/gp5_60-TOB.prst` (507 bytes). CRC-8 ATM (poly `0x07`, init 0) of `FFFFFFFF` + 10-byte NUL-padded name + descriptor + dump body matches byte 20 of both files. Do not paste `reference/` HTML into `src/`. Match those file bytes. UI never sends raw MIDI (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- Replace the Patone wrapper with a Valeton `.prst` for the connected model.
- Filename `gp50_60-TOB.prst` / `gp5_60-TOB.prst` (model underscore, two-digit slot, hyphen, name).
- Keep the existing dump re-request + `chainSync` gate.

**Non-Goals:**

- Cross-model conversion (GP-50 dump → GP-5 `.prst` or the reverse).
- Library import of `.prst`.
- Changing store SET `114a`.

## Decisions

### 1. Connected-model `.prst` only

**Choice:** GP-50 session encodes a GP-50 file; GP-5 session encodes a GP-5 file. No dropdown.

**Why:** First slice the user asked for. The two TOB captures share a dump body (`2d 02 00 00 02 30 0a…`) and differ by 20-byte ASCII header (`GP-50` vs `GP-5`), checksum, and a model-specific descriptor (GP-5: 74 bytes; GP-50: 117 bytes, then 400-byte body vs GP-5’s 398). Conversion is that descriptor + slice, and is a later change.

**Alternative:** Always GP-50 `.prst`. Rejected; a GP-5 session must not emit a GP-50 file. **Alternative:** Copy the reference editor’s `savePresetFile`. Forbidden.

### 2. Layout from captures, not HTML strings

**Choice:** Encode:

```
[20] ASCII model padded + `01 00`
[1]  CRC-8 ATM of (spacer + name + descriptor + body)
[4]  `FF FF FF FF`
[10] name, spaces as `00`
[N]  descriptor for that model
[rest] dump body
```

Lock header, spacer, name packing, and CRC against the TOB files. At apply, lock the dump-body **slice** against a Patone-assembled current-preset dump of the same patch (the HTML starts pairing at dump index 120; Patone’s concatenated payload is not that index 1:1). The GP-50 descriptor in the capture is **not** the truncated HTML constant (extra TLVs; one field `28` vs HTML `78`). Take descriptor **structure** from the capture; fill fields that vary from the dump when that mapping is found; otherwise keep capture defaults and note it. Do not invent bytes if the dump is too short to slice.

**Why:** Same codec rule as `114a`: observed files, not a source drop. Using capture bytes as fixtures is allowed; pasting the builder is not.

**Alternative:** Ship the HTML descriptor blobs as constants. Rejected; they already disagree with `gp50_60-TOB.prst`.

### 3. Same session method

**Choice:** Keep `downloadCurrentPatch() → { filename, bytes } | null`. Only the encoder and filename change. Controller keeps `Blob` download.

**Why:** Spec already routes download through the session. No new Tauri command.

### 4. Docs

**Choice:** Current-patch `.prst` **export** becomes in-scope in `docs/architecture.md`, `openspec/config.yaml`, and `docs/protocol-references.md`. Library **import** of `.prst` stays out. Note the file layout from the TOB captures and that CRC-8 ATM matched.

## Risks / Trade-offs

- [Patone dump offset ≠ capture body] → Compare a live dump of patch 60 TOB to `_reference/gp50_60-TOB.prst` at apply. If they do not overlap, stop and ask; do not guess a slice.
- [GP-50 descriptor embeds live globals] → Prefer dump-sourced fields; freeze capture defaults only where the dump has no mapping.
- [Suite rejects a file that CRC-matches TOB but uses a shorter descriptor] → Acceptance is Suite/reference loading a Patone-exported `.prst`, not CRC-only.
- [Users still have `.patch` files from the previous slice] → No migration. New downloads are `.prst` only.

## Migration Plan

Replace the wrapper in place. Rollback is reverting the change. Disconnect still drops dump state.

## Open Questions

None that block this slice. Dump-body offset and descriptor field mapping are apply-time fill-ins from the TOB captures plus a Patone dump of that patch.
