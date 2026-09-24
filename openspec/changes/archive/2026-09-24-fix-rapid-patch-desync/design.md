## Context

See `proposal.md` for why. Today `applyIdentity` freezes `pendingPatchLoad` on the first changed current-patch index and returns early on any other index until `applyChain` clears it. Pedal `patch-changed` only asks for current-patch identity (no slot in that notify). Chain dumps carry no patch index, so a late dump is attributed to whatever index is still selected.

USB and Bluetooth both arm `patchConfirm` after a patch-change dump. The only link fork is `holdBusyForConfirm` (Bluetooth only): USB clears `chainSync` after the first dump while the quiet confirmation still runs. This change removes that fork and retargets pedal loads.

## Goals / Non-Goals

**Goals:**

- Retarget an in-flight pedal patch load when a newer current-patch index arrives.
- Preserve the stale-index guard for app `setPatch`.
- Hold busy / `chainSync: "syncing"` through confirmation on USB and Bluetooth the same way.
- Prove the rapid-pedal race with a fake-transport check before relying on hardware feel.

**Non-Goals:**

- Encoding a patch index into dumps or inventing dump↔slot binding beyond identity reports.
- Removing confirmation or adding a second confirmation after a mismatch.
- Changing USB live-from-pedal policy.

## Decisions

### Distinguish app recall from pedal load for the pending gate

**Choice:** Keep a pending target for in-flight loads, but retarget when the disagreeing `current-patch` is pedal-driven (arrived after `patch-changed` / pedal identity path with no matching `setPatch` target). When `setPatch` owns the pending target, keep discarding other indices until that recall completes or is replaced by another `setPatch`.

**Why:** The freeze exists to stop a stale identity report from undoing an app recall. The same gate is wrong for a burst of pedal steps: each newer index is authoritative.

**Alternative:** Drop `pendingPatchLoad` entirely. Rejected; app recall still needs protection against delayed identity replies.

**Alternative:** Queue every current-patch and only dump the last after a quiet window. Possible later; retarget-on-report is enough for the hypothesized desync and keeps latency low.

### Retarget resets decoder and confirmation, requests one dump

**Choice:** On pedal retarget: update `snapshot.patch`, set `pendingPatchLoad` to the new index, clear/re-arm `patchConfirm` for the new load (`after-apply` once a dump applies), `chainDump.reset()`, keep or re-enter `chainSync: "syncing"`, and send one chain request. Do not apply a dump that completed for an abandoned intermediate load after retarget (generation or pending-target check).

**Why:** Fragments from the abandoned dump must not finish as the new slot's first dump. Confirmation must belong to the load that actually applied.

### Unify hold-busy through confirmation on both links

**Choice:** Remove the `linkMode === "bluetooth"` condition on `holdBusyForConfirm`. After the first patch-change dump on either link, keep `chainSync: "syncing"` until `applyPatchConfirmation` finishes or the chain refresh timer fires. Confirmation still does not call `beginChainRefresh` again.

**Why:** Specs and UX stay one path. USB is fast, so the extra overlay time is short; the cost of a second quiet dump was already paid. The old design rejected holding USB busy to avoid a flash; the rapid-desync work needs the overlay to mean "index and chain are not settled yet" on both links.

**Alternative:** Keep USB clearing busy after the first dump. Rejected for this change; the user asked to unify.

### Spike as a session check, then fix

**Choice:** Add a fake-transport sequence (ready on patch 10 → patch-changed burst → current-patch 11/12/13 before dump completion → dumps) that fails on today's gate (lands on 11) and passes after retarget (lands on 13). Run the same shape conceptually for USB and Bluetooth session link modes where the fake transport allows.

**Why:** Confirms the hypothesis without needing a pedal, and locks the regression.

## Risks / Trade-offs

- [A dump already in flight for slot N finishes after retarget to N+1] → Discard via pending-target / generation; do not apply as N+1's first dump without a fresh request completion for N+1.
- [USB overlay lasts through confirmation] → Short on USB; accepted for parity.
- [App and pedal change interleave] → `setPatch` ownership of pending wins until that recall completes; document in tasks with a check if easy.
- [Confirmation still attributes dump without slot] → Retarget reduces wrong attribution; confirmation remains a chain equality check for the selected index, not a slot decoder.

## Migration Plan

No protocol or stored-data change. Rollback: restore the discard-on-mismatch pending gate and Bluetooth-only `holdBusyForConfirm`.

## Open Questions

None. Pedal vs app ownership of `pendingPatchLoad` is decided above.
