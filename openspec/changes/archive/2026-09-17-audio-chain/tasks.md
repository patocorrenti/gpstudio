## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so the in-scope SysEx subset is patch identity plus the current-patch audio chain (order + on/off) on USB and Bluetooth, full preset/IR/NAM dumps stay later, and verify the out-of-scope list still forbids liveFromPedal module CC and third-party SysEx copies
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (chain dump codec allowed; snapshot apply for chain order/on/off allowed; still no copied SysEx; USB not duplex for knobs) and verify the file still parses as YAML
- [x] 1.3 Note in `docs/protocol-references.md` that working editors dump the current preset after names, that Patone now takes order + on/off from that class of dump, and verify the file still forbids copying their source or payloads

## 2. Chain profile

- [x] 2.1 Add a device-layer chain profile (default order NR → PRE → DST → NS → AMP → CAB → EQ → MOD → DLY → RVB, EXP last on GP-50 only, movable NR/PRE/MOD/DLY/RVB, fixed DST/NS/AMP/CAB/EQ) and verify `defaultChain("gp5")` has 10 slots all off and `defaultChain("gp50")` has 11 ending in EXP
- [x] 2.2 Export English short labels for those ids and verify Controller can label slots without importing MIDI types

## 3. Chain codec

- [x] 3.1 Add a Patone-owned codec that encodes a `current-chain` request from captures (no third-party source drop) and verify USB vs Bluetooth only differ by the existing BLE-MIDI wrap
- [x] 3.2 Decode inbound chain dumps into ordered `{ id, enabled }` slots (ignore other preset fields; branch on model if frames differ) and verify a captured dump yields the expected order and on/off without applying CC 48–57
- [x] 3.3 Extend `encode.ts` so chain requests go out as raw MIDI on USB and BLE-MIDI-wrapped on Bluetooth, and verify `encodePatch` still returns official CC 0

## 4. Session snapshot and initial sync

- [x] 4.1 Add `chain` to the connected snapshot (default chain for the model, all off), set it on connect without sending CC 0, drop it on disconnect, and verify `npx tsc -b --pretty false` still typechecks callers
- [x] 4.2 After names and current-patch, request the chain dump with a generation token and per-step timeout (Bluetooth MAY wait longer), keep `sync` as `syncing` until that step finishes or times out, skip requests if USB SysEx was denied, and verify connect / timeout / missing dump never send CC 0
- [x] 4.3 Apply decoded chain dumps to the snapshot even when Log is off, keep Log append gated on capture, and verify opening Controller does not grow the Log buffer

## 5. Patch-change refresh

- [x] 5.1 After `ready`, `setPatch` still sends only CC 0 then requests `current-chain`, apply opportunistic patch-load dumps when they decode, keep the previous chain until a new dump arrives, and verify no extra CC 0 is sent solely to obtain the dump
- [x] 5.2 On inbound `patch-changed` after `ready`, re-request current patch and the chain without sending CC 0, and verify a late dump cannot mutate a newer session generation

## 6. Controller

- [x] 6.1 Keep the English loading state until `ready` (identity plus chain), hide the chain while disconnected or syncing, and verify the patch bar still appears only when `ready`
- [x] 6.2 When `ready`, draw display-only slots under the patch bar from the snapshot (10 on GP-5, 11 on GP-50 with EXP last), show on vs off, use the same row on USB and Bluetooth, and verify activating a slot does not send MIDI
- [x] 6.3 If the initial dump is missing, show the default-order slots all not-on, and verify previous / select / next still send CC 0 through the session

## 7. Check

- [x] 7.1 Run `npx tsc -b --pretty false` and fix type errors from this change
