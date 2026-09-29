## Context

See proposal.md — Why. Bluetooth app recall already sends SET `1143` (`bluetooth-patch-recall-1143`). `setPatch` then calls `refreshChain(true, true)`, which immediately `sendChainRequest`s and later arms a confirmation dump. Reference editors (`_reference/GP5bluetooth.html`, GP-50 Bluetooth editor) set `userChangedPatch`, send `1143`, and only request the preset dump when a length-18 BLE “Command received” notify arrives. Overlapping GATT writes on the notify path are already known to drop the link in this codebase.

## Goals / Non-Goals

**Goals**
- Bluetooth GP-5 and GP-50: after app `1143`, wait for command-received ACK (or timeout) before the first dump ask.
- Keep confirmation dump behavior.
- USB unchanged.

**Non-Goals**
- Dropping confirmation; changing USB timing; pasting reference JS.

## Decisions

1. **Bluetooth-only ACK gate**  
   Only the `1143` path waits. USB still dumps right after CC 0.  
   *Alternative:* Gate every dump refresh. Rejected; pedal-initiated and Reload have no `1143` ACK.

2. **Match reference ACK shape on unwrapped MIDI**  
   Reference inspects raw BLE-MIDI (header `80 80` + SysEx), length 18, with checks at indices 5/6/10/11/12/14. Patone inbound is unwrapped, so decode the equivalent F0-aligned 16-byte SysEx (same fields at MIDI indices 3/4/8/9/10/12). Do not paste editor source; lock comments to that capture.  
   *Alternative:* Treat any short notify as ACK. Rejected; too broad.

3. **Defer `refreshChain` dump send, not the syncing overlay**  
   `setPatch` still marks `chainSync: syncing` and arms confirmation intent, but the first `sendChainRequest` runs only after ACK/timeout. Rapid re-select cancels the previous ACK wait and starts a new `1143` + wait.  
   *Alternative:* Block UI until ACK only. Rejected; overlay already covers controls.

4. **Short ACK timeout then dump anyway**  
   If the ACK is missed, still request the dump so the session cannot soft-lock. Pick a modest timeout in implementation (~300–500 ms); document the value in code. Confirmation still runs after the first dump.  
   *Alternative:* No timeout (reference behavior). Rejected; worse UX if ACK framing differs.

## Risks / Trade-offs

- [ACK frame differs on some firmware] → Timeout still dumps; refine matcher from Patone Log if needed.  
- [ACK arrives after timeout and a dump is already in flight] → Ignore late ACK when no wait is pending.  
- [Confirmation still doubles traffic] → Accepted for this trial; separate change if hangs remain.

## Migration Plan

Ship with Bluetooth recall. No data migration. Rollback: restore immediate `refreshChain` send after `1143`.

## Open Questions

None — timeout duration is an implementation detail within a few hundred ms.
