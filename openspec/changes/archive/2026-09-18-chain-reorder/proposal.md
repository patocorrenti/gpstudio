**Status: applying.** Pedal→app Bluetooth live chain-order (command `04`, path `01 02 04`) is product. App→pedal SET is the parameter-write family (path `01 01 04`, CRC-8 + nibble-expand). W1/W2 (identity-family echo) were ignored. Operator capture: PRE before NR accepted. Do not copy `reference/` JavaScript into `src/`. Lab: `spike-chain-order-write.md`.

## Why

Controller already shows the current patch’s audio chain and lets the user toggle modules on/off (`docs/architecture.md`), but the slot order is still read-only. Valeton manuals already allow some modules to move; users need that reorder from Controller on both USB and Bluetooth.

## What Changes

- Controller lets the user drag a **movable** effect (NR, PRE, MOD, DLY, RVB) to another effect slot. **Fixed** effects (DST, NS, AMP, CAB, EQ) stay a contiguous block in that order: nothing may be inserted between them. Movable modules may occupy slots before or after that block. GP-50 EXP stays last. Invalid drops are no-ops. Movable slots show a three-dot grip at the top. On/off switches keep working and MUST NOT start a drag. The same row is used on USB and Bluetooth; React still MUST NOT send raw MIDI.
- `DeviceSession` applies a valid reorder to the snapshot on-change (optimistic) and sends a Patone-owned chain-order write on the open link (`commandToPedal` is already true on both). It MUST NOT send extra patch recall or a chain dump solely because the user reordered. It MUST NOT write full preset parameters.
- The order codec is Patone-owned, from Patone captures (and Log traffic observed while using reference editors as a black box). Exact write bytes are an apply-time capture fill-in. Third-party editors stay behavioral references only (`docs/protocol-references.md`); do not copy their source or payloads.
- When `liveFromPedal` is true (Bluetooth only), inbound live chain-order reports MUST update snapshot order without sending recall. USB MUST ignore those reports even if they arrive. Requested/opportunistic chain dumps still replace order + on/off as today.
- Architecture and OpenSpec context: UI chain reorder and the matching SysEx write (order only) become in scope on USB and Bluetooth. Full preset editor, rename, IR/NAM stay later.

## Non-goals

- Full preset parameter read/write, rename, library, or IR / SnapTone / NAM (`docs/architecture.md`).
- Writing the whole current-preset dump, not just chain order.
- Letting the user drag DST, NS, AMP, CAB, EQ, or EXP, insert anything between those five fixed effects, or insert EXP between effects.
- Applying inbound volume, tuner, CTL, or other non-module live knobs.
- Treating USB as duplex, or listening for USB live reorder telemetry.
- Volume, tuner, or GP-50 master/BPM/Patch|Stomp from Controller.
- Copying reverse-engineered SysEx or JavaScript from third-party editors.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. Chain reorder is the next live-controller slice after module on/off, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, movable effect slots can be dragged to a new effect position through the device session. Fixed modules and EXP cannot. Toggles still flip on/off without changing order. USB and Bluetooth share the same chain UI.
- `device-connection`: The session sends a Patone-owned chain-order write on a valid reorder. Bluetooth (`liveFromPedal`) applies inbound live chain-order reports to the snapshot. USB does not apply those reports.
- `inbound-log`: Log still MUST NOT apply traffic. `DeviceSession` MAY apply Bluetooth live chain-order SysEx to the snapshot independently of Log capture, same pattern as identity, chain dumps, and live module on/off.

## Impact

- `src/device/chain.ts`: enforce movable vs fixed vs EXP in a pure reorder helper used by the session (fixed DST–EQ block stays contiguous).
- `src/device/chain-codec.ts` / `src/device/encode.ts`: encode chain-order write (BLE-MIDI wrap on Bluetooth); optionally decode Bluetooth live order reports. Exact bytes filled from captures, not third-party source.
- `src/device/session.ts`: `reorderChain` (or equivalent) updates snapshot order and sends the write; Bluetooth inbound may apply live order when `liveFromPedal` is true.
- `src/features/controller/ControllerPage.tsx`: drag-and-drop on movable slots with a three-dot grip; switch still toggles; busy overlay still blocks the body.
- `docs/architecture.md` and `openspec/config.yaml`: chain-order writes in scope; drag-and-drop in scope; full editor SysEx still later; USB still not duplex.
- `docs/protocol-references.md`: note that reference editors can reorder the chain; Patone still must not copy their payloads.
- A small UI drag library MAY be added if needed (Controller only). No new Tauri commands or HTTP backend.
