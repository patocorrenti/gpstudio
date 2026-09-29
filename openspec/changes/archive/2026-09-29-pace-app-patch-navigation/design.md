## Context

See proposal.md — Why. Official Valeton keeps the UI free and lets the pedal catch up; Patone will not copy that. Reference editors wait for a “Command received” ACK after `1143` before one dump, but can still hang under spam. Patone keeps confirmation dumps. Overlapping GATT writes are already known to drop the Bluetooth link in this repo.

## Goals / Non-Goals

**Goals**
1. While chain syncing (dump and/or confirm): no app recall, no new dump ask from previous/select/next; UI locked.
2. Bluetooth: after allowed `1143`, wait for command-received ACK (or short timeout) before the first dump ask; then confirmation as today.
3. Pedal retarget of in-flight dumps stays.

**Non-Goals**
- Queuing rapid selects to send later (Valeton-like catch-up).
- Dropping confirmation.

## Decisions

1. **Hard gate, not a queue**  
   `setPatch` no-ops while `chainSync === "syncing"`. No deferred “latest patch wins” send after idle.  
   *Alternative:* Queue last select. Rejected; user asked for no change while a dump is in progress.

2. **ACK only on Bluetooth `1143`**  
   Defer first `sendChainRequest` until ACK/timeout. USB still dumps after CC 0 when the recall is allowed.  
   *Alternative:* Gate USB too on some MIDI ACK. Rejected; no `1143` on USB in Patone.

3. **ACK matcher from reference, unwrapped MIDI**  
   Equivalent of BLE length-18 “Command received” (reference raw indices 5/6/10/11/12/14 → MIDI 3/4/8/9/10/12). Timeout still dumps. Late ACK ignored if no wait pending.  
   *Alternative:* Any short notify. Rejected; too broad.

4. **UI closes open patch popover when busy**  
   Specs drop “selector MAY stay usable”. Trigger stays disabled; open list cannot fire `onSelect` while busy.

5. **Supersede split changes**  
   Implement here; abandon `bluetooth-patch-recall-ack` and `lock-patch-select-while-syncing`.

## Risks / Trade-offs

- [Still hangs if first recall+confirm alone is too heavy] → Separate follow-up (e.g. confirm pacing); this change only stops stacking.  
- [ACK frame mismatch] → Timeout path still dumps; refine from Patone Log.  
- [Slower navigation than Valeton] → Accepted trade for pedal stability.

## Migration Plan

Ship as one change. Delete or leave unapplied the two superseded change dirs after this is preferred. Rollback: restore immediate dump after `1143` and selector-MAY-usable / `setPatch` without syncing guard.

## Open Questions

None — ACK timeout stays a few hundred ms as an implementation detail.
