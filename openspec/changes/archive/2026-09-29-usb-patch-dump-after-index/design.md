## Context

See proposal.md — Why. Today `DeviceSession.setPatch` sends USB CC 0 then calls `refreshChain(..., deferFirstDump = false)`, so `sendChainRequest` runs immediately. Bluetooth sets `deferFirstDump` and waits for the `1143` command-received ACK (`RECALL_ACK_TIMEOUT_MS`, 400 ms) before the first dump. Confirmation after the first apply is already shared. Reference USB editors ask for preset info after a current-patch identity notify (or after a SET command-received ACK when using `1143`); Patone keeps CC 0, so the usable gate is the matching current-patch identity, not the Bluetooth ACK.

When a refresh times out, `armChainRefreshTimer` clears syncing and re-asks current-patch identity but leaves `pendingPatchLoad` / `pendingPatchSource` set. App-owned pending then discards mismatched pedal indices — the “stops following the pedal until I change from the app” symptom.

## Goals / Non-Goals

**Goals:**

- On USB app recall, defer the first dump ask until a matching current-patch identity arrives or a short timeout fires.
- Keep confirmation dumps and busy-through-confirm on USB and Bluetooth.
- Clear the in-flight patch-load gate on chain-refresh timeout so pedal follow recovers.

**Non-Goals:**

- Switching USB recall to `1143` or prev/next to CC `0x18`/`0x19`.
- Waiting for the Bluetooth command-received ACK on USB (CC 0 may never emit that packet).
- Removing confirmation or unlocking the UI before confirmation on USB.
- Changing Bluetooth ACK pacing.

## Decisions

### Wait for matching current-patch identity on USB, not Command received

**Choice:** After USB CC 0, arm a wait analogous to `armRecallAckWait`, but finish it when `applyIdentity` sees `current-patch` with `next === pendingPatchLoad` (app source), or when a short timeout elapses — then `sendChainRequest`. Do not treat `isCommandReceivedAck` as the USB gate.

**Why:** Reference list recall uses `1143` + Command received; Patone USB stays on CC 0. The shared observable is the identity-family current-patch notify. Reusing the Bluetooth ACK detector on USB would hang until timeout whenever the pedal never sends that SET ACK.

**Alternative:** Switch USB to `1143` to reuse ACK. Rejected for this change (separate proposal if wanted).

**Alternative:** After CC 0, actively ask current-patch identity, then dump on the reply. Possible fallback if unsolicited notifies are flaky; start with wait-for-unsolicited + timeout-then-dump (mirror Bluetooth). If captures show silence after CC 0, add an identity ask on timeout before the dump in a follow-up.

### Pedal-initiated USB loads still dump after the index is known

**Choice:** Pedal `current-patch` / retarget paths keep calling `refreshChain` without the USB identity wait (the index already arrived). Only app→pedal USB recall defers the first dump.

**Why:** The race is “CC 0 then dump before the pedal finishes switching.” Pedal reports already carry the new index.

### Keep confirmation

**Choice:** `confirmPatch = true` and `holdBusyForConfirm` stay on USB and Bluetooth after the first dump applies.

**Why:** Agreed in proposal; Bluetooth is fine with it; USB still benefits from correcting a stale first dump.

### Clear pending on refresh timeout

**Choice:** In the chain-refresh timeout handler, clear `pendingPatchLoad` and `pendingPatchSource` (and cancel any USB identity wait) when forcing `chainSync` idle.

**Why:** Without this, a failed dump leaves app pending and swallows later pedal indices. Spec requires the gate to clear so pedal follow recovers.

**Alternative:** Only clear when `pendingPatchSource === "app"`. Prefer clearing both so a stuck pedal load cannot freeze either.

### Timeout duration

**Choice:** Reuse the same short timeout constant as Bluetooth ACK wait (`RECALL_ACK_TIMEOUT_MS`, ~400 ms), or a shared rename if the name is too Bluetooth-specific. Do not use the full chain dump timeout (6 s) for this gate.

**Why:** Navigation must not stick if the notify never arrives; dump still runs and confirmation still follows.

## Risks / Trade-offs

- [After CC 0 the pedal is slow to emit current-patch identity] → Short timeout still requests the dump; worst case similar to today plus ≤400 ms.
- [Notify arrives for the right index but dump still races hardware] → Confirmation dump remains; timeout clears pending if both dumps fail.
- [Matching identity while waiting also runs the normal applyIdentity path] → Finishing the wait must request the dump once; avoid double `sendChainRequest` if identity handling also refreshes.
- [GP-50 USB already felt fast] → Extra wait is short; behavior stays correct.

## Migration Plan

No stored data. Rollback: USB `setPatch` dumps immediately after CC 0 again; remove identity wait; restore timeout without clearing pending if needed.

## Open Questions

None for this change. If operator captures show no unsolicited current-patch after CC 0 on a given firmware, follow up with an explicit current-patch ask on timeout before the dump.
