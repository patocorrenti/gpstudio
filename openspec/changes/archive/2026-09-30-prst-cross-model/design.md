## Context

Download and upload already share one Valeton `.prst` layout in `src/device/patch-store.ts`: a 20-byte model header (`GP-50` or `GP-5`), CRC-8 ATM, descriptor, and a packed dump body. `decodePrstFile` accepts only that file's own length. `DeviceSession.uploadCurrentPatch` then rejects the file when `parsed.model` differs from the connected pedal (`wrong-model`).

The chain the file carries is model-agnostic once decoded: ten effect slots (order, on/off, factory `modelId`, control values) plus an EXP slot that `decodePresetDump` appends only for a GP-50 dump, always off. `encodeUploadedPatchWrites` in `src/device/session/patch-io.ts` already skips a factory model whose catalog `devices` set does not include the target pedal, then writes order, module on/off, volume, and BPM. It does not write stomp assignment (`114d`) or EXP. It does write every control on the model, including controls marked for the other pedal only.

`decodeSlotModel` drops a wire the **decode** pedal's catalog does not host, so decoding a GP-50 dump as GP-5 hides C-Wah before anything can name it. The catalogs today put C-Wah, AC Sim, and CAB AC on GP-50 only. Shared models often add a GP-50-only Sync (or the same pattern). No factory model is GP-5 only. The twenty user-IR CAB wires are on both.

`PatchBar` currently compares the header model itself and errors before confirm. An unmodified working patch uploads immediately; a modified one confirms first. UI must keep importing `@/device/session` only.

See proposal.md for why. Requirements are in the delta specs.

## Goals / Non-Goals

**Goals:**

- One planner, used by preview and by upload, that decodes the file as its own model and writes only what the connected catalog hosts.
- The confirm step can name omitted factory models before any MIDI.
- Same-model upload and native download stay on the current bytes.

**Non-Goals:**

- A second `.prst` layout, a converted download, Library import, stomp or EXP writes, or a substitute model for an omitted slot. Those boundaries are in the proposal.

## Decisions

### Decode as the file, write as the connected pedal

Preview and upload call the same planner. It decodes the bytes with `decodePrstFile`, then `decodePresetDump(dump, file.model, file.model)` so a GP-50-only model stays on the chain long enough to be named. Writes use the connected model.

An omitted factory model is a slot whose `modelId` resolves in the catalog and whose `devices` set does not include the connected pedal. The planner returns those as slot kind plus label (PRE C-Wah). The slot stays on the chain, so order and on/off still go out. The model SET and that slot's control SETs do not. No default model is substituted; after the dump refresh the slot shows whatever the pedal already had.

A slot with no `modelId` (unknown wire) is not an omission. Same-model upload already skips it.

**Alternative:** decode with the connected pedal. Rejected because `decodeSlotModel` would drop C-Wah before the warning exists.

**Alternative:** rewrite the file into the other model's `.prst` and then upload that. Rejected. Download must stay native, and the pedal never needs the other header.

### Controls follow the target catalog; BPM follows both sides

`encodeUploadedPatchWrites` must emit controls from `controlsForPedal(model, target)`, not every control on the factory model. A GP-50-only Sync on a shared model is not written and is not an omission.

Patch BPM is passed through only when `file.model === session.model`. A mismatch passes `null`, so a GP-50 file does not tempo-write a GP-5 and a GP-5 file does not overwrite GP-50 BPM. Same-model BPM behavior stays as it is today. Volume always transfers when the file has a valid word. EXP and stomp assignment stay off the write plan.

### Preview is a session method; the dialog is the warning

`DeviceSession` exposes a no-MIDI preview that returns invalid, or ok plus the omission list. `uploadCurrentPatch` uses that same planner, drops `wrong-model`, and reports the same omissions on success. `PatchBar` stops comparing header models.

When the file model differs from the session, confirm always opens before writes, including when the working patch is unmodified. The dialog names omissions only when the list is non-empty. When the list is empty, the dialog is the existing load confirm with no extra warning. A same-model file keeps today's rule: confirm when the working patch is modified, otherwise upload immediately. Cancel still sends nothing. The success toast does not repeat the omission list.

**Alternative:** warn only after a successful load. Rejected. The user would already have sent MIDI.

### Docs follow the upload rule, not a new format

Apply updates `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so current-patch upload may adapt the other model's file. Download stays native. Library `.prst` import stays later. About drops the "What's next" line for this compatibility. The What's next section stays.

## Risks / Trade-offs

- [Omitted slot keeps the pedal's previous model after refresh] → The confirm dialog names that model before any write. Order and on/off from the file still apply.
- [Almost every GP-50 file has Sync knobs the GP-5 cannot host] → Those are not warnings. Warning on them would fire for ordinary patches. The shared model and its shared controls still transfer.
- [User IR 03 selects the slot, not the impulse bytes] → The `.prst` has no IR file. No warning. The sound depends on what that pedal has stored in the slot.
- [Preview and upload drift] → One planner function in `patch-io.ts`. Session checks call it for both the omission list and the writes.
- [Unmodified same-model upload still skips the dialog] → Left as the patch bar already behaves. This change adds a confirm only when the file is the other model.

## Migration Plan

No on-disk migration. Existing GP-5 and GP-50 `.prst` files stay valid. Rollback is restoring the `wrong-model` reject; files already loaded onto a pedal are ordinary working-patch edits until the user Saves.

## Open Questions

None. Omission means a factory model the target catalog does not include. Sync-style controls, BPM, EXP, and stomps are specified as silent.
