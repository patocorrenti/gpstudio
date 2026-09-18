## Context

See `proposal.md` for why. Controller already has a three-control patch navigator (`PatchBar` in `src/features/controller/ControllerPage.tsx`): previous / select / next. Previous and next already no-op while `chainSync === "syncing"` (`DeviceSession.stepPatch`); the Select still can `setPatch`. Live edits (CC 48–57, chain-order SET, model/control `1147`/`1148`) go to the pedal’s working buffer but are not stored into a 00–99 slot. Official CC cannot save, rename, or copy a patch. Parameter-write SETs already use path `01 01 04`, CRC-8 ATM (poly `0x07`, init 0), and nibble-expand (`src/device/sysex-nibble.ts`). Live notifies stay on `01 02 04` and are not SETs. UI never sends raw MIDI (`docs/architecture.md`). `reference/` is a behavioral guide, not a source drop (`docs/protocol-references.md`). Specs: `live-controller` (bar + busy gate) and `device-connection` (store write + local file).

## Goals / Non-Goals

**Goals:**

- One store SET for Save, rename, and duplicate (slot index + 10-character name).
- Session methods gated on `ready` + idle `chainSync`, same as `stepPatch`.
- Expand `PatchBar` in place; keep the chain-refresh overlay below the bar.
- Download a Patone-owned file of the current-preset dump the session already knows how to request.

**Non-Goals:**

- Reconstructing official Valeton Suite `.prst` (that is Library interchange later).
- Importing a downloaded file back onto the pedal.
- Dirty tracking or unsaved-edit warnings on patch change.
- New Tauri file-dialog commands.

## Decisions

### 1. Store SET: family `114a`, slot + padded name

**Choice:** Encode a Patone-owned parameter-write SET whose packed family is `114a` (path `01 01 04`, CRC-8 + nibble-expand, same `framePackedSet` helper as model/control). Body carries the **destination slot** (0–99) and a **10-character ASCII name** padded with spaces. USB vs Bluetooth differ only by the existing BLE-MIDI wrap (`encodeLinkMidi`). Exact packed size and padding bytes are an apply-time fill-in from a Patone capture (Log while storing from the pedal or from the reference editor used as a black box). Do not paste `reference/` JavaScript.

**Why:** Live CC/SET already mutate the working buffer. The missing command is “commit this buffer into slot N with this name.” Behavioral editors do that with one SET, not a full preset dump. Save = current slot + current name. Rename = current slot + new name (this also commits unsaved buffer edits). Duplicate = destination slot + current name, no CC 0.

**Alternative:** Write the whole current-preset dump. Rejected; that is the editor and easy to clobber unrelated fields. **Alternative:** Separate rename vs store commands. Rejected until a capture shows a name-only SET; one family keeps the busy gate and the encoder simple.

### 2. Session API, not React MIDI

**Choice:**

```
savePatch()
renamePatch(name)
duplicatePatch(dest)
downloadCurrentPatch() → { filename, bytes } | null
```

Each no-ops when disconnected, `sync !== "ready"`, or `chainSync === "syncing"` (same as `stepPatch`). `renamePatch` sanitizes to the pedal charset (ASCII letters, digits, space, hyphen) and at most 10 characters; blank after sanitize is rejected. `duplicatePatch` rejects the current slot. After a store write, update `patchNames` for the destination immediately (optimistic). Do not send extra recall or a chain dump solely because store ran. `setPatch` still owns recall + chain refresh.

Controller calls these methods only. Add shadcn `Input` if missing; reuse `Dialog` for rename and duplicate. Save is one click (no confirm). Duplicate opens a destination picker and asks to confirm when the destination already has a known name.

**Why:** Matches `docs/architecture.md`. Confirming every Save would fight the bar; duplicate overwrite is the destructive “clobber another preset” case the spec calls out.

**Alternative:** Confirm Save. Rejected for this slice; the user asked for a Save button, not a two-step commit. **Alternative:** Inline-edit the selector label. Rejected; Select stays a 00–99 picker, rename is its own control.

### 3. Busy gate: actions wait, selector may change patch

**Choice:** Pass the existing `busy` flag (`chainSync === "syncing"`) to Save, rename, duplicate, download, previous, and next. Leave `Select` enabled. Session still ignores store methods while busy even if the UI is wrong.

**Why:** That is today’s previous/next behavior, which the user asked to reuse. Keeping the selector usable lets them bail out of a slow Bluetooth dump by picking another patch. The overlay below the bar still covers chain + panels.

**Alternative:** Disable the whole bar including Select. Rejected; it would block patch changes during the dump the user just requested.

### 4. Download is a dump file, not `.prst`

**Choice:** Keep the last assembled current-preset dump bytes on the session (today `ChainDecoder` parses and drops the blob). `downloadCurrentPatch` re-requests that dump for the current patch (no CC 0), waits with the same `chainSync` gate, then returns a Patone-owned binary: a small header (magic, connected model, slot, name) plus the dump payload. Filename is English and includes the two-digit slot and name, e.g. `gp50-05-Flow.patch`. Controller triggers a browser download (`Blob` + temporary `<a download>`). That works in Vite and the Tauri webview. No new Tauri command. If the dump never arrives, return `null` and do not invent bytes.

**Why:** The dump is already the current-patch source of truth. Reconstructing Valeton `.prst` would copy a third-party file layout (`docs/architecture.md`). A Patone wrapper can be imported later by Library without pretending to be Suite.

**Alternative:** Export decoded JSON of catalog values. Rejected; it cannot round-trip fields we do not decode. **Alternative:** Copy the reference editor’s `.prst` builder. Forbidden.

### 5. Architecture / protocol docs

**Choice:** Current-patch store (Save / rename / duplicate) and current-patch download become in-scope SysEx in `docs/architecture.md`, `openspec/config.yaml`, and `docs/protocol-references.md`. Library browse/import/reorder, `.prst`, IRs/NAM, and the Editor route stay out. Note that `114a` is a SET of the same family as `1147`/`1148`, not a live notify.

## Risks / Trade-offs

- [Destination slot in `114a` is ignored; duplicate would overwrite the current slot] → Capture Save vs duplicate-to-other-slot at apply. If the index is display-only, stop; do not encode a full dump write; ask before expanding scope.
- [Store SET is ignored, like the paused stomp-assignment lab] → Same stop rule. Keep UI behind the session method so a failed write does not fork a second protocol.
- [Re-requesting the dump on download flickers the chain overlay] → Accept; it is the same busy gate as a patch change and guarantees the file matches the working buffer rather than a stale connect dump.
- [Optimistic name list is wrong if the pedal rejected the SET] → Accept for this slice (same class as optimistic model/control). A later name-list refresh can be a follow-up.
- [Downloaded `.patch` is not Suite-compatible] → Documented non-goal. Users still get a keepable current-patch file.

## Migration Plan

Additive. Rollback is reverting the change. No stored files or snapshot fields to migrate. Disconnect still drops session state.

## Open Questions

None that block this slice. Packed `114a` offsets and the dump-file header layout are apply-time capture fill-ins, not spec changes.
