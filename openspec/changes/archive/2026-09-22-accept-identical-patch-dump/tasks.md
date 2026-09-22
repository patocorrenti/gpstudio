## 1. Apply an identical patch dump

- [x] 1.1 Remove `ignoreStaleChainDump` and the `chainSlotsEqual` early return in `DeviceSession.applyChain` (`src/device/session.ts`), including the assignments in `setPatch`, the pedal patch-change path, and `beginGeneration`. Leave `pendingPatchLoad`, `chainSlotsEqual` against the modified baseline, and `preserveExpEnabled` in place. Verify the flag no longer appears in `src/` and that an identical decoded dump falls through to the existing success path (held dump, baseline when the refresh asked for it, `chainSync` idle).

## 2. Check

- [x] 2.1 Run `npx tsc -b --pretty false` and verify it typechecks. Do not add a browser pass; the user checks a clone and a factory GP-50 patch on the pedal.
