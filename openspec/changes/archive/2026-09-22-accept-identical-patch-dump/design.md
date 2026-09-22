## Context

See `proposal.md` for why. After `setPatch` or a pedal-initiated patch change, `DeviceSession.applyChain` returns early when `ignoreStaleChainDump` is set and `chainSlotsEqual` says the decoded chain matches the snapshot. That return skips the success path: held dump, baseline capture, `chainSync` idle, and chain waiters. `ChainDecoder.reset()` already runs at the start of the refresh, before the new chain request. UI never sends raw MIDI (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- The first complete current-preset dump after a patch-change refresh is applied even when the decoded chain matches the chain on screen.
- That apply uses the existing success path. No second request and no content comparison.

**Non-Goals:**

- Delaying the chain request until the pedal confirms the new slot.
- Skipping one inbound dump, or tagging dumps with a request id.
- Changing `pendingPatchLoad` (stale current-patch index reports) or `chainSlotsEqual` against the modified baseline.
- Changing `preserveExpEnabled` (EXP on/off copied from the chain already shown onto the decoded dump).

## Decisions

### Drop the equality discard

**Choice:** Remove `ignoreStaleChainDump` and the `chainSlotsEqual` early return in `applyChain`. Delete the flag from `setPatch`, the pedal patch-change path, and `beginGeneration`. An identical dump then falls through to the existing success path: clear `pendingPatchLoad`, store `currentPatchDump`, capture `baseline` when `captureBaselineFromDump` is set, set `chainSync` idle and `canExportPatch` true, release chain waiters.

**Why:** A clone and an untouched factory patch decode to the same chain as the one on screen. Content equality cannot tell that dump from a stale previous-patch dump, and no second dump arrives. The refresh timeout does not apply the discarded dump or capture the baseline.

**Alternative:** Request the dump only after the current-patch identity matches `pendingPatchLoad`. Rejected for this change; the request stays where it is (CC 0, then the chain request).

**Alternative:** Ignore the first complete dump after the refresh and accept the next one. Rejected; a pedal that answers once would leave the session syncing until timeout, which is the bug.

### Leave the other guards

**Choice:** Keep `pendingPatchLoad` so a current-patch report for a different slot cannot revert an in-flight recall. Keep `chainSlotsEqual` for `modified` versus `baseline`. Keep `preserveExpEnabled`.

**Why:** Those are not the discard. Download, upload, and connect refreshes already apply whatever dump arrives; they do not set the flag.

## Risks / Trade-offs

- [A complete previous-patch dump arrives after `ChainDecoder.reset()` and is applied as the new patch] → Accepted. No replacement guard. A later dump for the selected patch replaces the chain; if that later dump is the real one and `captureBaselineFromDump` was already consumed, `modified` can read true until the next patch change. Operator testing on a clone and on a factory GP-50 patch is the check that the common case is fixed.
- [The refresh timeout still fires when no dump arrives] → Unchanged. It only matters when the pedal does not answer.

## Migration Plan

No stored data and no protocol change. Rollback is restoring the equality discard in `applyChain`.
