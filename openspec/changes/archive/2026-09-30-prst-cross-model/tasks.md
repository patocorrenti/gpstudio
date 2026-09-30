## 1. Upload planner

- [x] 1.1 Add one planner in `src/device/session/patch-io.ts` that decodes a `.prst` as its own model (`decodePrstFile`, then `decodePresetDump` with that model for both dump class and catalog), lists omitted factory models (slot kind + label) when `devices` does not include the target pedal, and leaves unknown wires off that list. Verify a GP-50 chain with PRE C-Wah against GP-5 reports PRE C-Wah, and the GP-50 TOB fixture against GP-5 does not report Sync.
- [x] 1.2 Teach `encodeUploadedPatchWrites` to emit controls from `controlsForPedal` for the target pedal, to skip a factory model the target catalog does not include without dropping that slot's order or on/off, and to send patch BPM only when the file model and the session model are the same. Verify a GP-50 file planned for GP-5 sends no C-Wah model SET, no Sync control SET, and no BPM write, and still sends chain order and module on/off. Verify a GP-5 file planned for GP-50 does not include a BPM write.

## 2. Session

- [x] 2.1 Add a no-MIDI preview on `DeviceSession` (exported from `@/device/session`) that returns invalid or ok plus the omission list, and make `uploadCurrentPatch` use the same planner. Drop the `wrong-model` reject. On success, report the same omissions. Verify `assertUploadRejectsWithoutMidi` no longer treats `GP5_TOB_PRST_HEX` on a GP-50 session as `wrong-model`: that upload applies, reports no omission, sends no store `114a` and no extra patch recall, and does not change the patch index.
- [x] 2.2 Cover the GP-5 session cases in `src/device/session/checks.ts`: a GP-50 file whose factory models the GP-5 catalog includes applies with no omission and no BPM write; a file with PRE C-Wah reports that omission, sends no C-Wah model bytes, and still writes the other slots plus PRE order and on/off; User IR 03 is a model write with no CAB omission; a shared model with Sync writes the model and not Sync, with no Sync omission. Invalid bytes still send nothing. USB and Bluetooth both use this planner (existing link wrap only). Verify the check module still self-runs on import of `@/device/session`.

## 3. Controller

- [x] 3.1 Point `PatchBar` upload at the session preview. A file from the other model always opens the English confirm dialog before writes, including when the working patch is unmodified. When the omission list is non-empty, the dialog names those models and confirm still loads. When it is empty, the dialog has no omission warning. Cancel sends nothing. A same-model file keeps today's rule (confirm only when modified, otherwise upload immediately) and does not warn. An invalid file still shows the English error and does not upload. Verify Controller still sends no raw MIDI and the new copy is English.

## 4. Copy and plan

- [x] 4.1 Remove the About "What's next" line for GP-5/GP-50 `.prst` compatibility. Leave the What's next section. Verify the page still lists the other upcoming items.
- [x] 4.2 Update `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so current-patch upload may apply the other model's `.prst` (native download unchanged; Library `.prst` import still later). Verify `openspec/config.yaml` still parses as YAML.

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change. Do not add an in-browser pass.
