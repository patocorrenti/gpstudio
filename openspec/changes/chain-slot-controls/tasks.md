## 1. Catalog

- [x] 1.1 Add `src/device/catalog/` types (`FxModel`, control `display` kinds, `default` / min / max / step) plus helpers to list models for a kind+pedal and to look up a model by id or wire identity, and verify `npx tsc -b --pretty false` typechecks those files
- [x] 1.2 Transcribe factory models for NR, PRE, and DST into typed catalog objects (English labels, wire identities, visible controls only) by reading `reference/` without pasting that JavaScript, default `devices` to both pedals, and verify each model has a unique id and a wire identity for its kind
- [x] 1.3 Transcribe factory models for AMP, CAB, EQ, MOD, DLY, RVB, and NS the same way (factory CAB/NS only; unnamed NS wire ids use `SnapTone NN`; omit user IR slots), and verify AMP includes Tweedy and Bellman 59N with distinct control sets

## 2. Slot state

- [x] 2.1 Extend `AudioChainSlot` with optional `modelId` and `values`, keep EXP without those fields, leave `defaultChain` unknown, and verify `reorderChain` copies `modelId`/`values` with the moved slot
- [x] 2.2 Keep `modelId`/`values` when toggling on/off in the session, and verify turning DST off then on still has the same model and values on the snapshot

## 3. Decode

- [x] 3.1 Extend the current-preset dump parser (existing GP-5 vs GP-50 layouts) to read each effect kind's wire identity and float32 LE values from Patone captures guided by `reference/` offsets, map known identities to catalog `modelId`, snap numbers to that model's steps, leave unknown identities unset, and verify a GP-50 dump fixture for Tweedy + Gain 30 fills AMP without treating an unknown AMP identity as writable
- [x] 3.2 Preserve `modelId`/`values` when applying Bluetooth live on/off and live chain-order, replace them on a later current-preset dump, ignore those live reports on USB, and verify a Bluetooth AMP-off report does not clear Tweedy/Gain

## 4. Encode and session writes

- [x] 4.1 Add Patone-owned model-write and control-write encoders (parameter-write SET path `01 01 04`, CRC-8 + nibble-expand, packed `1147` / `1148` families from captures, `DUMP_MODULE_IDS` kind index), wrap Bluetooth like other SysEx, and verify USB vs Bluetooth only differ by that wrap
- [x] 4.2 Add `DeviceSession.setSlotModel` and `setSlotControl` that update the snapshot on-change when ready and not chain-syncing, no-op unknown/EXP/wrong-pedal/busy, reset values to catalog defaults on model swap, clamp/snap control values, send the matching SET without extra recall or dump, do not change order/on/off, and verify `npx tsc -b --pretty false` typechecks callers
- [x] 4.3 Coalesce slider control SETs in the session (throttle ~80 ms, flush on pointer-up; toggles flush immediately), skip an unchanged snapped value, drop pending writes on patch change / model swap / disconnect, and verify typecheck

## 5. Controller

- [x] 5.1 Add a shadcn Slider (or equivalent existing control) if missing, and verify it typechecks with the other UI primitives
- [x] 5.2 Below the audio chain, render a panel per enabled effect slot with known model/values (chain order, English kind + model label, model select only when that kind has more than one factory model for the pedal, sliders/toggles from the catalog), omit EXP and off slots, still show enabled AMP/CAB when NS-bypassed, call session methods (no raw MIDI), keep the existing busy overlay covering those panels, and verify typecheck plus that a dump-missing chain shows no editable panels

## 6. Docs and check

- [x] 6.1 Update `docs/architecture.md` and `docs/protocol-references.md` so current-patch model + control read/write for the ten effect slots is in-scope SysEx (same dump, SET family), Editor/IRs/NAM/live knob follow stay out, and verify the files still forbid copying `reference/` JavaScript
- [x] 6.2 Mirror that in `openspec/config.yaml` context and rules, and verify the file still parses as YAML
- [x] 6.3 Run `npx tsc -b --pretty false` and fix type errors from this change
