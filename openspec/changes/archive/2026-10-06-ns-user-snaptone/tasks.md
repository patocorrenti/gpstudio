## 1. Catalog

- [x] 1.1 Add the twenty-four user SnapTone NS models to `src/device/catalog/ns.ts` (ids `ns-user-01`…`ns-user-24`, labels `SnapTone 01`…`SnapTone 24`, wires `38 00 00 0f`…`4f 00 00 0f`, both pedals, same five controls as factory NS, a slot-index tag for name overlay) and verify `modelByWire("ns", [0x3a, 0x00, 0x00, 0x0f])` is SnapTone 03 and factory NS wires still resolve

## 2. Current-preset decode

- [x] 2.1 Extend the existing preset-dump fixture so an NS identity `3a 00 00 0f` (SnapTone 03) with Gain 40 fills `modelId` + values instead of staying unknown, and verify an unknown AMP identity is still unwritable

## 3. Nam / SnapTone-name codec

- [x] 3.1 Add a GP Studio-owned Nam-name request encoder (identity-family envelope `F0 03 05 … 02 01 02 02 04 F7`; Bluetooth wrap via `encodeLinkMidi`; do not paste `_reference/` JavaScript) and verify USB vs Bluetooth packets differ only by that wrap
- [x] 3.2 Add a fragment assembler that concatenates indexed Nam payloads, reads eighty nibble-packed ASCII names (offset 164, stride 32, empty → `null`), keeps indices 56–79 as the twenty-four user names, classifies Nam dumps so they are not fed to `ChainDecoder`, and verify a packed fixture yields `My Amp` at user slot 03 and `null` for a blank slot
- [x] 3.3 Lock USB vs Bluetooth Nam fragment headers from the reference editors (Bluetooth `00 0E` lengths 210 / 134; USB `04 08` lengths 48 / 36); if a GP Studio USB Log later disagrees on last-index, keep fail-open decode and record the gap in `docs/protocol-references.md`

## 4. Session

- [x] 4.1 Add `userNsNames: (string | null)[]` (length 24) to the connected snapshot, default all `null`, drop it on disconnect, and verify a later current-preset dump does not clear loaded names
- [x] 4.2 After the first current-preset dump on connect, request the Nam dump in the same secondary window as IR names / globals without delaying `finishSync` or chain refresh, apply decoded names fail-open, do not re-request on Reload or patch change, and verify typecheck plus that identity loading does not wait for that dump
- [x] 4.3 Keep `setSlotModel("ns", "ns-user-03")` on the existing `1147` SET (no SnapTone file bytes) and verify a Bluetooth live model notify with that wire updates NS the same as a factory SnapTone

## 5. Controller

- [x] 5.1 Overlay dumped SnapTone names on the NS `ModelSelect` (`userNsNames[i] ?? SnapTone NN`, include the displayed string in search), keep all twenty-four slots listed, and verify typecheck plus that a blank name keeps the fallback

## 6. Docs and check

- [x] 6.1 Update `docs/architecture.md` and `docs/protocol-references.md` so Nam-name read and user-NS catalog/select are in-scope SysEx, IR/NAM **upload** stays out, and verify the files still forbid copying `reference/` JavaScript
- [x] 6.2 Mirror that in `openspec/config.yaml` context and rules, and verify the file still parses as YAML
- [x] 6.3 Run `npx tsc -b --pretty false` and fix type errors from this change

## 7. Download warning

- [x] 7.1 When Download is activated and the working patch uses a user IR and/or user SnapTone, show an English confirmation that the `.prst` references the slot but does not include the IR / SnapTone file; Cancel must not download; factory-only patches must not show the dialog
