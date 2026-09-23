## 1. Document the layout rule

- [x] 1.1 Update `docs/architecture.md` so the repo tree lists `src/device/session/` (orchestrator plus `working-patch.ts`, `inbound.ts`, `writes.ts`, `patch-io.ts`, `checks.ts`) instead of a single `session.ts`, plus the extract rule from design.md (new inbound / throttled-write / file-I/O families are siblings; UI imports only `@/device/session`), and verify that section still names one `DeviceSession` for USB and Bluetooth
- [x] 1.2 Mirror that placement rule in the `context` field of `openspec/config.yaml` (DeviceSession is the façade; live inbound, throttled writes, and current-patch file I/O are siblings under `src/device/session/`; React does not import those files), and verify the file still parses (`openspec context --json`)
- [x] 1.3 Add `.cursor/rules/device-session.mdc` (`alwaysApply: true`, under 50 lines, good/bad path example) stating the same rule, and verify the file exists next to `feature-ui.mdc`

## 2. Folder façade

- [x] 2.1 Move `src/device/session.ts` to `src/device/session/device-session.ts`, add `src/device/session/index.ts` that re-exports `DeviceSession`, snapshot types, and today's chain/identity/link re-exports, delete `src/device/session.ts`, and verify Connect still imports `DeviceSession` from `@/device/session` with no leftover `src/device/session.ts`

## 3. Extract session siblings

- [x] 3.1 Move `clampPatch`, `wrapPatch`, `preserveExpEnabled`, `chainSlotsEqual`, `cloneChain`, and baseline/modified comparison into `src/device/session/working-patch.ts` with no MIDI send/receive, and verify `device-session.ts` imports those helpers and no longer defines them
- [x] 3.2 Extract the throttled slot-control and patch volume/BPM maps, timers, and ~80 ms coalesce into `src/device/session/writes.ts` as a queue `DeviceSession` constructs and feeds `sendBytes`, keep `CONTROL_WRITE_THROTTLE_MS` and the volume/BPM write keys there, and verify the class no longer holds those maps
- [x] 3.3 Move `UPLOAD_*_GAP_MS`, `encodeUploadedPatchWrites`, and download dump-word overlay into `src/device/session/patch-io.ts`, leave `uploadCurrentPatch` / `downloadCurrentPatch` / `storePatch` on `DeviceSession`, and verify upload still sequences `sendBytes` plus the same gaps with no store `114a` in the upload planner
- [x] 3.4 Move live follow (`applyLivePatchVolume`, `applyLiveModule`, `applyLiveChainOrder`, `applyLiveSlot` and their helpers) into `src/device/session/inbound.ts`, keep `handleInbound`, identity/chain/IR dump apply, and patch confirm on `DeviceSession`, and verify USB still consumes-and-ignores those live reports while Bluetooth still applies them when `liveFromPedal` is true
- [x] 3.5 Move import-time asserts (`assertUploadSessionFixtures`, `assertUploadRejectsWithoutMidi`, `assertUserIrSession` and stubs) into `src/device/session/checks.ts`, side-effect import it from `index.ts`, have checks import `DeviceSession` from `./device-session`, and verify `device-session.ts` no longer contains those asserts

## 4. Check

- [x] 4.1 Run `npx tsc -b --pretty false` and fix type errors from this change
- [x] 4.2 Verify the folder contains only the files listed in design.md decision 1, no `src/features/` or `src/components/` import of `inbound.ts` / `writes.ts` / `patch-io.ts` / `working-patch.ts` / `checks.ts`, and no extra `types.ts` unless a cycle forced it
