## Context

See proposal.md — Why. Specs today say the 00–99 selector MAY stay usable during chain refresh; previous/next/Reload/Save already wait through confirmation. UI already passes `disabled={busy}` into `PatchSelect`, but an open popover can still accept a second choice, and `setPatch` does not no-op when `chainSync === "syncing"` (unlike `stepPatch`). Confirmation dumps stay in scope; this change only stops stacking app recalls.

## Goals / Non-Goals

**Goals**
- No app recall or new dump ask from previous/next/select while syncing/confirm in flight.
- Selector stays locked in UI for the whole busy period; session enforces the same gate.
- Pedal rapid reports still retarget.

**Non-Goals**
- ACK-before-dump; removing confirmation; changing dump wire format.

## Decisions

1. **Session gate in `setPatch`**  
   If `chainSync === "syncing"` (and session ready), return without sending recall or calling `refreshChain`. `stepPatch` already returns early; keep that and rely on `setPatch` as the shared gate.  
   *Alternative:* Queue the latest select and send after idle. Rejected for this change; user asked to keep loading until finished, not to auto-fire the next recall.

2. **UI: close or ignore select while busy**  
   Keep `disabled={busy}` on the trigger; when `busy` becomes true, force the popover closed and ignore `onSelect` if somehow invoked. Align live-controller text so “MAY stay usable” is removed.  
   *Alternative:* Spec-only change assuming UI already works. Rejected; open-popover race is real.

3. **Pedal path unchanged**  
   `retargetPedalPatch` / inbound current-patch stay able to move the shown index and re-request one dump for the latest slot without app `1143`/CC 0.

## Risks / Trade-offs

- [User wants to skip ahead while loading] → Must wait for confirm/timeout; accepted to protect the pedal.  
- [Busy clears before confirm on a bug] → Existing specs already require hold through confirmation; this change depends on that remaining true.

## Migration Plan

One release. Rollback restores selector-MAY-usable wording and removes the `setPatch` syncing guard.

## Open Questions

None.
