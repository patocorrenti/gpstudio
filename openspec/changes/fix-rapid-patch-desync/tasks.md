## 1. Spike: reproduce the freeze

- [ ] 1.1 Add a fake-transport session check in `src/device/session/checks.ts` that starts ready on patch 10, feeds pedal `patch-changed` plus `current-patch` 11 then 12 then 13 before the dump for 11 completes, then delivers dumps, and verify the check **fails on current code** with `snapshot.patch === 11` (hypothesis confirmed)
- [ ] 1.2 Keep that check as the regression target: after the retarget fix it MUST pass with `snapshot.patch === 13` and MUST NOT apply an abandoned intermediate dump as the selected patch; verify by running the app import path that executes `checks.ts` (or the project's usual typecheck + load of session checks)

## 2. Retarget pedal loads

- [ ] 2.1 In `DeviceSession.applyIdentity`, retarget when a newer pedal `current-patch` disagrees with an in-flight pedal load (update patch index, reset `chainDump`, re-arm patch-change confirmation for the new load, keep syncing, send one chain request) and verify check 1.2 passes for the rapid pedal sequence
- [ ] 2.2 Keep discarding a disagreeing `current-patch` while an app `setPatch` owns `pendingPatchLoad`, and verify with a check or assert that selecting patch 42 then receiving another slot's current-patch leaves the snapshot on 42
- [ ] 2.3 Ensure a dump that finishes for an abandoned intermediate load is not applied as the retargeted slot's first dump (pending-target or generation guard), and verify the rapid check still ends on 13 with the dump requested after retarget

## 3. Unify confirmation busy on USB and Bluetooth

- [ ] 3.1 Remove the Bluetooth-only `holdBusyForConfirm` fork so USB also keeps `chainSync: "syncing"` until `applyPatchConfirmation` or the chain refresh timeout, and verify a USB fake-session patch change stays syncing after the first dump until confirmation applies
- [ ] 3.2 Confirm connect / Reload / download / upload still leave confirmation off and do not hold busy for a second dump solely because of this change (existing checks or a short assert)

## 4. Close out

- [ ] 4.1 Run project typecheck / lint for touched files and fix any errors introduced by this change
