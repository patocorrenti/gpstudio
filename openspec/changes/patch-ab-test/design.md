## Context

The patch bar in `src/features/controller/PatchBar.tsx` is previous, `PatchSelect`, next, then Save and Options, then `PatchLevels` (P-Vol, and BPM on GP-50). Recall is `session.setPatch` / `session.stepPatch`. `setPatch` updates the snapshot to `chainSync: "syncing"` before it awaits, and it returns without a recall while a ready session is already syncing or the requested index is already selected. The chain overlay covers controls below the bar; the bar itself disables previous, the selector, and next while `busy`. See proposal.md for why, and the live-controller delta for the behavior.

Reload is named in the durable patch-bar requirement and is not a control in the current `PatchBar`. This change does not add it. Hiding the action cluster still satisfies "do not show Reload".

## Goals / Non-Goals

**Goals:**

- Swap the action cluster for the A/B controls without a second recall path or a session-owned timer.
- Arm the next dwell only while the chain is idle, and drop it when syncing starts, so automatic recalls cannot pile up on Bluetooth.
- Keep Stop and X usable while `chainSync` is syncing.

**Non-Goals:**

- Changing `encodePatch`, dump sequencing, or the chain overlay.
- A test runner. Verification stays typecheck, same as the rest of Controller.

## Decisions

### Timer stays in the Controller feature

The cycle is React state on the patch bar: setup open or closed, seconds, comparison index, and a playing flag. A and B and the dwell are captured when Play is pressed and held in refs so later edits cannot move a running cycle. The dwell is a `setTimeout` in an effect. Cleanup on stop, close, unmount, and when `chainSync` leaves idle clears that timeout. Disconnect unmounts `PatchBar` (`ConnectedController` returns null), so the cycle ends with the bar.

`DeviceSession` is not given a start/stop method. A session timer would keep recalling after the bar is gone and would mix UI pacing into the façade.

Alternative considered: queue the alternation inside `setPatch`. Rejected. The session already refuses a recall while syncing; the dwell is a UI wait, not a protocol step.

### One effect, re-armed only from idle

The effect arms a timeout only when the cycle is playing and `chainSync === "idle"`. When the timeout fires it calls `session.setPatch` for the other captured slot and flips which slot is next. Because `setPatch` publishes `syncing` synchronously, the effect cleans up and does not arm again until that recall's chain is idle. That is the full dwell after the dump settles, not a wall clock that overlaps the dump.

If `setPatch` returns without entering `syncing` (already on that index, or a sync that started in the same turn), the effect would otherwise stall on the same idle snapshot. After that call, if the snapshot is still idle, bump a dwell epoch so the effect arms a new full dwell. Do not bump when the call did enter `syncing`.

Play itself does not call `setPatch`. The first dwell starts on the patch already loaded, including when Play is pressed while the chain is still syncing.

Alternative considered: `setInterval` every N seconds from Play. Rejected. An interval that fires during a dump would call `setPatch` while syncing, and that call is a silent no-op, so the slot would be skipped.

### Comparison slot reuses `PatchSelect` and does not recall

The second selector is the existing `PatchSelect` with an `onSelect` that only stores the index. Opening setup sets that index to `(patch + 1) % PATCH_COUNT` once; later changes to the current patch do not move it. The seconds control is a numeric input, accessible name `Seconds`, clamped to integers 1–60, default 5 when setup opens. Empty or out-of-range typing keeps the last valid integer so Play always has a dwell in range.

The A/B button label is `A/B` with tooltip `A/B Test - Patches`. While setup is open the same button shows an X, tooltip `Close A/B test`. Play and Stop are English labels on that button. Order while setup is open: X, previous, current selector, next, seconds, comparison selector, Play or Stop.

While playing, previous, next, both selectors, and the seconds input use the same disabled treatment as `busy`, even if the chain is idle. Stop and X ignore `busy`. In setup, previous / current selector / next keep today's `busy` lock; seconds, comparison, and Play stay usable while syncing because they do not recall.

Save, Options, and `PatchLevels` are not rendered in setup, so an open Options popover closes with them. Dialogs already open (rename, duplicate, upload) can stay mounted; they are not part of the bar. Do not start a cycle from those dialogs.

### No USB / Bluetooth fork

Both links call `session.setPatch`. The session already encodes USB CC 0 and Bluetooth SET 1143. The bar does not read `linkMode` for this feature.

## Risks / Trade-offs

- [Heard time is dwell plus the dump, not dwell from the click] → Accepted. Overlapping the dump would either cut the second patch short or recall while syncing. The delta specs the idle dwell.
- [Pedal moves the index during a dwell] → The in-flight dwell is cancelled because syncing starts. The next idle period waits the full dwell, then recalls the next captured slot even if the pedal is already there. `setPatch` no-ops in that case and the epoch re-arms, so the cycle does not stick.
- [`setPatch` turns the tuner off and drops the working baseline] → Same as choosing a patch by hand. No extra confirm. The unsaved tooltip stays on previous / current selector / next in setup.
- [A timeout fires after Stop if cleanup is missed] → The effect cleanup is the only timer. Stop, X, and unmount clear `playing` or unmount the bar before any further `setPatch`.

## Migration Plan

UI only. No stored preference and no protocol change. Reverting the patch-bar change removes the control; in-flight recalls already sent are ordinary patch changes.

## Open Questions

None. Interval bounds, Stop leaving the sounding patch, and the idle dwell are fixed in the delta spec.
