## Context

See `proposal.md` for why. `DeviceSession.applyChain` applies the first current-preset dump of a patch change even when the chain matches the screen, then clears the refresh (`chainSync` idle, baseline captured, dump held). `refreshChain` is what shows the busy overlay and drops the held dump. UI never sends raw MIDI (`docs/architecture.md`). USB is fast; Bluetooth is slower and is where a previous-patch dump still arrives after the slot has changed.

## Goals / Non-Goals

**Goals:**

- After that first patch-change dump is shown, request one more current-preset dump and compare it to the chain on screen.
- Same chain: drop the confirmation. Different chain, and the working patch is still unmodified: replace the chain, the held dump, and the baseline.

**Non-Goals:**

- Using equality to drop the first dump.
- `chainSync: "syncing"` or the busy overlay for the confirmation.
- A confirmation after connect, Reload, download, or upload.

## Decisions

### Confirm only a patch change, once

**Choice:** Arm a one-shot confirmation when `setPatch` or a pedal patch change applies its dump (`captureBaselineFromDump` was set). After `applyChain` finishes that apply, reset the decoder and send the existing chain request. Do not call `refreshChain` / `beginChainRefresh`. Connect (`runIdentitySync`), `reloadCurrentPatch`, download, and upload leave the flag clear. Applying a mismatch does not arm it again. `beginGeneration`, a newer patch change, and Reload clear it.

**Why:** The stale dump is the one that races a patch change. Connect has no previous patch in flight. Reload is already the manual re-request. A second confirmation after a correction would loop if the pedal kept answering with alternating dumps.

**Alternative:** Hold the overlay until the confirmation arrives. Rejected; USB would flash a second busy state on every patch change for a dump that almost always matches.

### Match discards, mismatch replaces

**Choice:** Compare with `chainSlotsEqual` on the chain `preserveExpEnabled` would show. Equality drops the confirmation: no snapshot write, no baseline change, no `modified` change. A difference replaces `snapshot.chain` and `currentPatchDump`, clones that chain into `baseline`, and reports not modified. If `modified` is already true, or a control write is still queued, drop the confirmation and keep the edit.

**Why:** A clone's confirmation matches, so it is discarded and the first apply stands. A stale first dump differs from the real patch, so the confirmation corrects it and becomes the baseline. Otherwise Save would turn on for a chain the user did not edit. An edit that landed first is kept; the confirmation must not wipe it.

**Alternative:** Compare raw dump bytes. Rejected; the screen equality is the chain the user sees (order, on/off, model, values), which is what `chainSlotsEqual` already defines for `modified`.

## Risks / Trade-offs

- [USB pays one extra dump round trip and almost always discards it] → Accepted. No overlay, so the cost is the request, not a second lock of the chain.
- [The user edits, or Bluetooth live-follow marks modified, before the confirmation arrives] → The confirmation is discarded. A stale chain can remain until Reload. That is preferred to wiping the edit.
- [A patch change starts while the confirmation is in flight] → Clear the flag and reset the decoder with the new refresh. A whole confirmation message that still arrives can be applied as the new patch's first dump; that patch's own confirmation then corrects it. This is the same accepted race as a late previous-patch dump, with one more request on the wire.
- [Archive order] → `accept-identical-patch-dump` is still open and edits the same requirements. Archive that change first. This change's deltas include that behavior plus the confirmation, so archiving this one second does not drop either.

## Migration Plan

No stored data and no protocol change. Rollback is removing the confirmation request and the compare in `applyChain`.
