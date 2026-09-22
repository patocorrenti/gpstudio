## 1. Catalog

- [ ] 1.1 Add the twenty user-IR CAB models to `src/device/catalog/cab.ts` (ids `cab-user-ir-01`…`cab-user-ir-20`, labels `User IR 01`…`User IR 20`, wires `00 00 10 0a`…`13 00 10 0a`, both pedals, same VOL control as factory cabs, a slot-index tag for name overlay) and verify `modelByWire("cab", [0x02, 0x00, 0x10, 0x0a])` is User IR 03 and factory CAB wires still resolve

## 2. Current-preset decode

- [ ] 2.1 Extend the existing preset-dump fixture so a CAB identity `00 00 10 0a` (or slot 03) with VOL 50 fills `modelId` + values instead of staying unknown, and verify an unknown AMP identity is still unwritable

## 3. IR-name codec

- [ ] 3.1 Add a Patone-owned IR-name request encoder (identity-family envelope, distinct size/command/path from name-list / current-patch / current-preset; Bluetooth wrap via `encodeLinkMidi`; do not paste `_reference/` JavaScript) and verify USB vs Bluetooth packets differ only by that wrap
- [ ] 3.2 Add a fragment assembler that concatenates indexed IR-name payloads, reads twenty nibble-packed ASCII names (offset 44, stride 32, empty → `null`), classifies IR dumps so they are not fed to `ChainDecoder`, and verify a packed fixture yields `Greenback 412` at slot 03 and `null` for a blank slot
- [ ] 3.3 Lock USB vs Bluetooth IR fragment headers from Patone Log (same class as name-list `01 05` / `06 0A`); if USB headers are missing, keep fail-open decode and record the gap in `docs/protocol-references.md`

## 4. Session

- [ ] 4.1 Add `userIrNames: (string | null)[]` (length 20) to the connected snapshot, default all `null`, drop it on disconnect, and verify a later current-preset dump does not clear loaded names
- [ ] 4.2 After sending the current-preset request on connect, request the IR-name dump without delaying `finishSync` or chain refresh, apply decoded names fail-open, do not re-request on Reload or patch change, and verify typecheck plus that identity loading does not wait for that dump
- [ ] 4.3 Keep `setSlotModel("cab", "cab-user-ir-03")` on the existing `1147` SET (no IR file bytes) and verify a Bluetooth live model notify with that wire updates CAB the same as a factory cab

## 5. Controller

- [ ] 5.1 Overlay dumped IR names on the CAB `ModelSelect` (`userIrNames[i] ?? User IR NN`, include the displayed string in search), keep all twenty slots listed, and verify typecheck plus that a blank name keeps the fallback

## 6. Docs and check

- [ ] 6.1 Update `docs/architecture.md` and `docs/protocol-references.md` so IR-name read and user-IR CAB catalog/select are in-scope SysEx, IR/NAM **upload** stays out, and verify the files still forbid copying `reference/` JavaScript
- [ ] 6.2 Mirror that in `openspec/config.yaml` context and rules, and verify the file still parses as YAML
- [ ] 6.3 Run `npx tsc -b --pretty false` and fix type errors from this change
