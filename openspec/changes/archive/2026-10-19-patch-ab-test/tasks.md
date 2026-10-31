## 1. A/B setup on the patch bar

- [x] 1.1 Add an `A/B` button before previous on `PatchBar`, tooltip `A/B Test - Patches`. Activating it only opens setup state. Verify the click handler does not call `setPatch` or `stepPatch`.
- [x] 1.2 While setup is open, hide Save, Options, and `PatchLevels`, and show X (tooltip `Close A/B test`), previous, the current selector, next, a seconds input defaulting to 5 (integers 1–60, accessible name `Seconds`), a second `PatchSelect` defaulting to the next slot with wrap `99` → `00`, and Play. The comparison selector and the seconds input must only update local state. Play stays disabled when both slots match. Verify those handlers do not call `setPatch` or `stepPatch`, and that changing the current patch does not move the comparison slot.
- [x] 1.3 X closes setup and restores Save, Options, and levels without a recall. Previous, the current selector, and next keep today's `busy` lock and unsaved-changes tooltip. Verify X does not call `setPatch` or `stepPatch`.

## 2. Play / Stop cycle

- [x] 2.1 On Play, capture the loaded patch, the comparison slot, and the dwell, show Stop, and do not recall A. Arm a timeout only while the cycle is playing and `chainSync` is idle; when it fires, call `session.setPatch` for the other captured slot. Clear the timeout when syncing starts, on Stop, on X, and on unmount. If that `setPatch` returns with the chain still idle, re-arm a full dwell. Verify no timeout is armed and no `setPatch` runs while `chainSync` is syncing, and that Play's own handler does not call `setPatch`.
- [x] 2.2 While the cycle is running, disable previous, next, both selectors, and the seconds input even when the chain is idle. Leave Stop and X enabled while `busy`. Stop ends the cycle, stays in setup, and shows Play without a recall. X ends the cycle and restores the normal bar without a recall. Verify Stop and X do not call `setPatch` or `stepPatch`.
- [x] 2.3 Keep a single bar for USB and Bluetooth: the cycle calls `session.setPatch` only and does not branch on `linkMode`. Verify there is no new session timer method and no raw MIDI send from the patch bar.

## 3. Validation

- [x] 3.1 Run `npx tsc -b --pretty false` and verify it passes. Do not add an in-browser pass; the user checks the bar on a pedal.
