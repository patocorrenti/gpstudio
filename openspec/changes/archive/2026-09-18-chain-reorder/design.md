**Applying.** Bluetooth inbound live chain-order is shipping. App→pedal SET is the accepted parameter-write frame (path `01 01 04`, CRC-8 ATM + nibble-expand). Do not retry W1/W2. Do not paste `reference/` JavaScript into `src/`. Notebook: `spike-chain-order-write.md`.

## Context

See `proposal.md` for why. Controller already draws snapshot slots and toggles on/off (`src/features/controller/ControllerPage.tsx`). `MOVABLE_EFFECTS` (NR, PRE, MOD, DLY, RVB) and `FIXED_EFFECTS` (DST, NS, AMP, CAB, EQ) already live in `src/device/chain.ts` but are unused. `ChainDecoder` already reads the ten-slot order from current-preset dumps (`DUMP_MODULE_IDS`, `orderAt`). Official CC 48–57 cannot write order. USB is still one-way for live controls; Bluetooth `liveFromPedal` already applies live-module/EXP SysEx (`docs/architecture.md`). Third-party editors remain behavioral references only (`docs/protocol-references.md`).

## Goals / Non-Goals

**Goals:**

- Enforce Valeton move rules in a device-layer helper, then expose drag on Controller through the session.
- Send a Patone-owned chain-order write on USB and Bluetooth (encoder wrap only).
- Apply Bluetooth live chain-order reports when they exist; ignore them on USB.
- Fill write bytes from Patone captures / Log observation of reference editors as a black box.

**Non-Goals:**

- Full preset dump writes, parameter fields, or copying third-party encoders.
- Changing MidiTransport / BluetoothLink contracts.
- Keyboard-only reorder, volume, tuner, or other live knobs.

## Decisions

### 1. Capture first; encode only order

**Choice:** Apply starts with Log captures of a chain reorder on USB and Bluetooth (reference editors as a black box, and/or the pedal’s own chain edit if it emits traffic). Derive a Patone-owned encoder from those frames. Prefer a small identity-family write that carries the new ten-slot order (`DUMP_MODULE_IDS` indices 0–9), wrapped as BLE-MIDI on Bluetooth like other SysEx. If USB and Bluetooth writes differ the way GP-50 EXP did (notify vs request), branch in `encode.ts`, not in Controller. Do not paste third-party JavaScript or payloads.

If the only observed traffic is a full current-preset rewrite, stop and report; do not send that dump. This change is order-only.

**Why:** Order is already in the dump at `orderAt`. Official CC has no order. Architecture forbids copied SysEx (`docs/architecture.md`).

**Alternative:** Rewrite the whole preset dump. Rejected; that is the editor. **Alternative:** Guess a command id without a capture. Rejected; identity and EXP already showed USB/Bluetooth frames diverge.

### 2. Pure helper owns move rules; session is optimistic

**Choice:** Add `reorderChain(chain, fromIndex, toIndex)` (or equivalent) in `src/device/chain.ts`. Valid when the source id is movable, both indexes are in the effect slots (not EXP), `fromIndex !== toIndex`, and the result keeps DST, NS, AMP, CAB, EQ as one contiguous block in that order (no module between them). Movable effects may sit only before or after that block. Each slot keeps `enabled`. EXP stays last on GP-50. Invalid input (including a drop that would split the fixed block) returns the same array. `DeviceSession.reorderChain` no-ops when not `ready`, when `chainSync` is `syncing`, or when the helper rejects; otherwise it replaces `snapshot.chain` immediately and sends the encode. Do not re-request a dump or send CC 0.

**Why:** USB has no echo. A dump round-trip would revive the busy overlay for a slot move. Same pattern as `toggleChainSlot`.

**Alternative:** Re-dump after every drag. Rejected; slow on Bluetooth. **Alternative:** Enforce move rules only in React. Rejected; session must reject invalid moves even without a drag.

### 3. Same row, capability-gated apply

**Choice:** Keep one chain UI. Writes use `commandToPedal` (already true on both links). Inbound live chain-order SysEx applies only when `liveFromPedal` is true. If no such notify is ever captured, `decodeLiveChainOrder` returns null and dumps still update order. USB MUST NOT apply live order reports. Do not fork Controller.

**Why:** `docs/architecture.md` uses capabilities instead of two UIs.

**Alternative:** Hide drag on USB until a write is proven. Rejected; USB can still send, it just will not echo.

### 4. Drag the slot body; the switch stays a switch

**Choice:** Make movable slots sortable in Controller with `@dnd-kit/core` and `@dnd-kit/sortable`. Fixed slots and EXP are not sortable. Movable slots show a three-dot grip at the top (visual cue; the slot body is still the drag surface). Fixed and EXP slots keep the same top spacer so heights stay aligned. The on/off `Switch` is not a drag handle (`stopPropagation` stays). Dropping onto EXP, into the DST–EQ block, or a no-op index never calls the session (or the helper rejects). The English busy overlay still covers the whole chain body and disables sensors. Same layout on USB and Bluetooth.

**Why:** HTML5 `draggable` fights the Switch and overlay. dnd-kit is Controller-only and does not leak into `DeviceSession`.

**Alternative:** Native HTML5 drag. Rejected as too flaky with the switch. **Alternative:** Drag handle icon. Rejected unless dnd-kit on the card body collides with the switch at apply.

### 5. Architecture / context catch up

**Choice:** In the same apply, update `docs/architecture.md` and `openspec/config.yaml` so current-patch chain-order writes (not full preset parameters) and Controller drag-and-drop are in scope on USB and Bluetooth. Bluetooth inbound live chain-order is in scope; USB stays one-way for that telemetry. Keep “preset library reorder” and full editor SysEx later. `docs/protocol-references.md` MAY note that reference editors can reorder the chain; Patone still must not copy their payloads.

**Resume (2026-09-18):** SET captured (path `01 01 04`, CRC-8 + nibble-expand). Drag and writes are back in product scope. Do not retry W1/W2.

**Why:** Stop the next agent from treating this as still forbidden, or from opening the full editor to move two slots.

## Risks / Trade-offs

- [No order-only write exists, only a full preset dump] → Stop; do not encode that dump; ask before expanding scope.
- [USB write differs from Bluetooth notify] → Encoder branches on `linkMode`, same as EXP; Controller stays shared.
- [Bluetooth echoes our own reorder] → Applying the same order is idempotent; do not treat it as a dump refresh.
- [GP-5 vs GP-50 dump `orderAt` differs] → Session still sends logical order ids; layout offsets stay in the codec if a dump-shaped write is required.
- [Keyboard users cannot reorder] → Accepted for this slice; pointer drag only.
- [No browser verification] → `tsc`; the user tests USB send and Bluetooth round-trip on a real pedal. Use documented editors only as a side-by-side capture source.

## Migration Plan

Additive session action, codec encode, and Controller sortable. Disconnect still drops live state. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

None that fork the specs. Exact chain-order write bytes (and whether a live inbound order SysEx exists) are an apply-time capture fill-in.
