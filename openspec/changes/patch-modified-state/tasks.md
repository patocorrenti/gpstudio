## 1. Session snapshot

- [x] 1.1 Add `modified: boolean` to the connected `SessionSnapshot` (false while disconnected paths stay unchanged), clone helpers for `AudioChain` that copy `values`, and verify `npx tsc -b --pretty false` typechecks `src/device/session.ts`
- [x] 1.2 Keep a private `baseline` plus `captureBaselineFromDump` on `DeviceSession`, null both on `dropLink` and when the selected patch changes, and verify a disconnected snapshot has no `modified` field to leak after close
- [x] 1.3 Route every connected chain write through one helper that sets `modified` from `chainSlotsEqual` against `baseline` (false when `baseline` is null or `chainSync` is syncing), and verify `npx tsc -b --pretty false` typechecks callers (toggle, reorder, model, control, live follow, dump apply)

## 2. Baseline recapture

- [x] 2.1 Arm `captureBaselineFromDump` on connect chain request, user `setPatch`, and pedal-initiated patch change; in `applyChain` when armed, clone the decoded chain into `baseline`, set `modified` false, and disarm; verify download and upload refresh paths leave that flag off
- [x] 2.2 After a successful `storePatch` of the **current** slot (Save / rename), clone the working chain into `baseline` and set `modified` false without requesting a dump; leave duplicate of another slot unchanged, and verify no extra recall or chain dump is added solely because Save ran
- [x] 2.3 After a download or upload dump `applyChain` with the flag off, re-compare against the existing baseline so a dirty download stays modified and a different uploaded file is modified, and verify `npx tsc -b --pretty false` typechecks

## 3. Controller

- [x] 3.1 Pass `snapshot.modified` into `PatchBar`, put Save before Rename, disable Save when not modified or busy, use an emerald style when Save is usable, do not show a Modified label, and verify Controller still sends no raw MIDI
- [x] 3.2 Use the same Save presentation on USB and Bluetooth (no link-mode branch in the bar), and verify `npx tsc -b --pretty false` typechecks `src/features/controller/`

## 4. Docs and check

- [x] 4.1 Update `docs/architecture.md` so the Controller patch bar includes working Modified state (baseline comparison, clears on Save / rename / restore / patch change / disconnect), and verify the file still forbids copied SysEx, Library import, and USB duplex knobs
- [x] 4.2 Mirror that in `openspec/config.yaml` context (working modified on the patch bar; not a confirm-on-navigate change), and verify the file still parses as YAML
- [x] 4.3 Run `npx tsc -b --pretty false` and fix type errors from this change
