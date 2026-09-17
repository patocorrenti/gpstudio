## 1. Capture

- [ ] 1.1 With Patone Log open, capture a chain reorder on USB and on Bluetooth using a reference editor as a black box (and/or the pedal chain edit if it emits traffic), keep only the order-related frames, and if the only traffic is a full current-preset rewrite stop and report without encoding it
- [ ] 1.2 Note in `docs/protocol-references.md` that reference editors can reorder the chain and that Patone’s write is capture-derived order-only SysEx, and verify the file still forbids copying third-party source or payloads

## 2. Architecture and context

- [ ] 2.1 Update `docs/architecture.md` so Controller drag-and-drop of movable modules and current-patch chain-order writes (not full preset parameters) are in scope on USB and Bluetooth, Bluetooth `liveFromPedal` may apply inbound live chain-order, USB stays one-way for that telemetry, and verify the out-of-scope list still forbids copied SysEx, full editor dumps, and USB duplex knobs
- [ ] 2.2 Mirror that in `openspec/config.yaml` context and rules (chain-order writes allowed; drag-and-drop allowed; Bluetooth inbound live chain-order allowed; USB must not apply those reports) and verify the file still parses as YAML

## 3. Move rules

- [ ] 3.1 Add `reorderChain` (or equivalent) in `src/device/chain.ts` that splices a movable effect among the ten effect slots, keeps `enabled`, keeps EXP last on GP-50, returns the same array for fixed/EXP/same-index/out-of-range moves, and verify a GP-5 default chain moving RVB before DST yields NR, PRE, RVB, DST, NS, AMP, CAB, EQ, MOD, DLY with on/off preserved

## 4. Encode

- [ ] 4.1 Add a Patone-owned chain-order encode from the capture in 1.1 that sends the new ten-slot order (`DUMP_MODULE_IDS` indices), wraps Bluetooth as BLE-MIDI like other SysEx, branches on `linkMode` if USB and Bluetooth frames differ, does not encode a full preset dump, and verify USB vs Bluetooth only differ by that wrap or the documented link branch
- [ ] 4.2 If the capture includes a Bluetooth live chain-order notify, add `decodeLiveChainOrder` that returns the new effect order and verify it does not parse name dumps, current-patch identity, live-module command `09`, or EXP command `02` as order

## 5. Session

- [ ] 5.1 Add a session reorder that applies `reorderChain` on-change when `ready` and not `chainSync` syncing, sends the encode on the open link, no-ops invalid moves, does not send a chain dump or extra patch recall, and verify `npx tsc -b --pretty false` typechecks callers
- [ ] 5.2 When `liveFromPedal` is true, apply inbound live chain-order SysEx to snapshot order (if a decoder exists) even when Log is off, and verify opening Controller does not grow the Log buffer
- [ ] 5.3 When `liveFromPedal` is false (USB), ignore inbound live chain-order reports, and verify a chain dump still updates order + on/off as before

## 6. Controller

- [ ] 6.1 Add `@dnd-kit/core` and `@dnd-kit/sortable` and verify they appear in `package.json` after install
- [ ] 6.2 When `ready` and the chain is not covered by the busy overlay, make NR, PRE, MOD, DLY, and RVB sortable through the session (same row on USB and Bluetooth), keep DST, NS, AMP, CAB, EQ, and EXP not sortable, keep the Switch toggling without starting a drag, and verify dropping RVB before DST updates the shown order without sending raw MIDI from React
- [ ] 6.3 Keep the English busy overlay over the chain body while `chainSync` is `syncing` and verify those slots cannot be dragged until the overlay clears

## 7. Check

- [ ] 7.1 Run `npx tsc -b --pretty false` and fix type errors from this change
