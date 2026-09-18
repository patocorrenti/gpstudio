## 1. Capture

- [x] 1.1 With Patone Log open, capture a chain reorder on USB and on Bluetooth using a reference editor as a black box (and/or the pedal chain edit if it emits traffic), keep only the order-related frames, and if the only traffic is a full current-preset rewrite stop and report without encoding it
- [x] 1.2 Note in `docs/protocol-references.md` that reference editors can reorder the chain and that Patone’s write is capture-derived order-only SysEx, and verify the file still forbids copying third-party source or payloads

## 2. Architecture and context

- [x] 2.1 Update `docs/architecture.md` so Controller drag-and-drop of movable modules and current-patch chain-order writes (not full preset parameters) are in scope on USB and Bluetooth, Bluetooth `liveFromPedal` may apply inbound live chain-order, USB stays one-way for that telemetry, and verify the out-of-scope list still forbids copied SysEx, full editor dumps, and USB duplex knobs
- [x] 2.2 Mirror that in `openspec/config.yaml` context and rules (chain-order writes allowed; drag-and-drop allowed; Bluetooth inbound live chain-order allowed; USB must not apply those reports) and verify the file still parses as YAML

## 3. Move rules

- [x] 3.1 Add `reorderChain` (or equivalent) in `src/device/chain.ts` that splices a movable effect among the ten effect slots, keeps `enabled`, keeps DST–NS–AMP–CAB–EQ contiguous in that order (no insert between them), keeps EXP last on GP-50, returns the same array for fixed/EXP/same-index/out-of-range/split-block moves, and verify a GP-5 default chain moving RVB before DST yields NR, PRE, RVB, DST, NS, AMP, CAB, EQ, MOD, DLY with on/off preserved while moving PRE after AMP is a no-op

## 4. Encode

- [x] 4.1 Add a Patone-owned chain-order encode from the capture in 1.1 that sends the new ten-slot order (`DUMP_MODULE_IDS` indices), wraps Bluetooth as BLE-MIDI like other SysEx, branches on `linkMode` if USB and Bluetooth frames differ, does not encode a full preset dump, and verify USB vs Bluetooth only differ by that wrap or the documented link branch
- [x] 4.2 If the capture includes a Bluetooth live chain-order notify, add `decodeLiveChainOrder` that returns the new effect order and verify it does not parse name dumps, current-patch identity, live-module command `09`, or EXP command `02` as order

## 5. Session

- [x] 5.1 Add a session reorder that applies `reorderChain` on-change when `ready` and not `chainSync` syncing, sends the encode on the open link **and the pedal accepts it**, no-ops invalid moves, does not send a chain dump or extra patch recall, and verify `npx tsc -b --pretty false` typechecks callers. Encoder matches the accepted PRE-before-NR capture (`spike-chain-order-write.md`). Operator confirms on the pedal.
- [x] 5.2 When `liveFromPedal` is true, apply inbound live chain-order SysEx to snapshot order (if a decoder exists) even when Log is off, and verify opening Controller does not grow the Log buffer
- [x] 5.3 When `liveFromPedal` is false (USB), ignore inbound live chain-order reports, and verify a chain dump still updates order + on/off as before

## 6. Controller

- [x] 6.1 Add `@dnd-kit/core` and `@dnd-kit/sortable` and verify they appear in `package.json` after install
- [x] 6.2 When `ready` and the chain is not covered by the busy overlay, make NR, PRE, MOD, DLY, and RVB sortable through the session (same row on USB and Bluetooth), keep DST, NS, AMP, CAB, EQ, and EXP not sortable, show a three-dot grip at the top of movable slots only, keep the Switch toggling without starting a drag, and verify dropping RVB before DST updates the shown order without sending raw MIDI from React
- [x] 6.3 Keep the English busy overlay over the chain body while `chainSync` is `syncing` and verify those slots cannot be dragged until the overlay clears

## 7. Check

- [x] 7.1 Run `npx tsc -b --pretty false` and fix type errors from this change

## 8. Pause (2026-09-18)

- [x] 8.1 Record that Bluetooth pedal→app live chain-order works, that app→pedal SET does not, and that W1 (host envelope) and W2 (notify echo, BLE-MIDI split) were ignored, in `spike-chain-order-write.md`. Do not retry those frames as-is.
- [x] 8.2 Remove Controller drag, `@dnd-kit/*`, and `DeviceSession.reorderChain` send from product. Keep inbound `decodeLiveChainOrder` apply, `reorderChain` helper, and unused order encoders as the lab. Point architecture / protocol-references at this paused change. Do not archive until a SET is accepted.

## 9. Resume SET (2026-09-18)

- [x] 9.1 Replace the failed host/notify encoders with the accepted parameter-write SET (packed `01 00 0C 11 44` + ten dump indices, CRC-8 ATM poly `0x07` init 0, nibble-expand), re-attach session send + Controller drag, and verify the PRE-before-NR vector matches the operator capture. Do not paste `reference/` JavaScript into `src/`.
