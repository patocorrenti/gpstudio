## Context

See `proposal.md` for why. Controller already draws the snapshot chain as display-only slots (`src/features/controller/ControllerPage.tsx`). Official module CCs 48–57 are named in `src/device/cc.ts` but never encoded. `encode.ts` only wraps CC 0, identity, and chain-dump requests. `liveFromPedal` is already true on Bluetooth and false on USB (`src/device/link.ts`) and unused for knobs. Inbound bytes already reach `DeviceSession.handleInbound` on both links; only identity and chain dumps are applied. USB is one-way for live controls (`docs/architecture.md`). GP-50 EXP is CC 11 (expression), not a module toggle, and the dump still appends EXP as off.

## Goals / Non-Goals

**Goals:**

- Toggle the ten effect modules from Controller through the session (official CC 48–57, on-change).
- Bluetooth applies inbound module CC 48–57 to the snapshot (`liveFromPedal`).
- USB sends the same toggles and ignores inbound module CC.
- Same chain UI on both links; EXP stays display-only.

**Non-Goals:**

- Drag-and-drop, SysEx chain writes, or a new order encode.
- Applying inbound volume/tuner/CTL or other non-module CCs.
- Treating USB as duplex.
- Volume, tuner, EXP toggle, GP-50 extras.

## Decisions

### 1. Same row, capability-gated apply

**Choice:** Keep one chain UI. Writes use `commandToPedal` (already true on both links). Inbound module CC applies only when `liveFromPedal` is true. Do not fork Controller for USB vs Bluetooth.

**Why:** `docs/architecture.md` already uses capabilities instead of two UIs.

**Alternative:** Hide toggles on USB. Rejected; USB can still send CC, it just will not echo.

### 2. Optimistic snapshot, then send CC

**Choice:** Toggle updates `chain[].enabled` immediately, then sends official CC 48–57 on the open link (BLE-MIDI wrap on Bluetooth, same as CC 0). Do not wait for an echo. Do not re-request the chain dump or send CC 0.

**Why:** USB has no echo. Bluetooth echo, if it arrives, is the same on/off. A dump round-trip would revive the busy overlay for a one-bit change.

**Alternative:** Re-dump the chain after every toggle. Rejected; slow on Bluetooth and hides the row.

### 3. `liveFromPedal` means module CC 48–57 only

**Choice:** On Bluetooth, parse inbound CC 48–57 and set the matching slot's `enabled` without changing order. Ignore CC 7, 11, 58, and other live controls. USB MUST NOT apply 48–57 even if bytes arrive. Requested chain dumps stay a separate apply path on both links.

**Why:** Matches the user's USB vs Bluetooth split. The flag already exists; this is the first feature that uses it.

**Alternative:** Apply every inbound CC when `liveFromPedal` is true. Rejected; volume/tuner are later.

### 4. EXP is not a module toggle

**Choice:** EXP remains a trailing GP-50 display slot. No session action sends CC 11 for on/off. Inbound CC 11 is ignored.

**Why:** Manual maps EXP to CC 11 (expression). The dump codec does not decode an EXP enable bit.

**Alternative:** Treat EXP like RVB. Rejected; different CC class.

### 5. CC values follow the official MIDI list

**Choice:** Encode off/on from the Valeton MIDI tables already cited for 48–57 (typically 0 vs 127; confirm in the manuals at apply). Decode inbound with the same threshold (0–63 off, 64–127 on unless the list says otherwise). Channel 1, same as patch CC 0.

**Why:** Patch recall already uses that official CC path. No SysEx.

**Alternative:** Write order/on/off as a SysEx preset edit. Rejected; out of scope and forbidden to copy third-party payloads.

### 6. NS vs AMP/CAB exclusivity is pedal-owned

**Choice:** A toggle sends only that module's CC. Do not locally turn AMP/CAB off when NS goes on. On Bluetooth, follow whatever extra module CCs the pedal sends. On USB those sibling slots can look stale until the next patch dump.

**Why:** Phase 1 already displayed the dump without rewriting. USB cannot see the pedal's side effect.

**Alternative:** Client-side exclusivity matrix. Rejected; would invent pedal policy on USB.

### 7. Architecture / context catch up

**Choice:** In the same apply, update `docs/architecture.md` and `openspec/config.yaml` so UI module on/off and Bluetooth inbound CC 48–57 are in scope. USB stays one-way for knobs. Drag-and-drop and other `liveFromPedal` knobs stay later.

**Why:** Stop the next agent from treating this as still forbidden.

## Risks / Trade-offs

- [Bluetooth echo of our own toggle] → Applying the same on/off is idempotent; do not treat it as a dump refresh.
- [NS on disables AMP/CAB on the pedal] → USB UI can disagree until the next dump; accepted.
- [CC value range differs from 0/127] → Confirm against the official MIDI list at apply; keep encode/decode in one helper.
- [No browser verification] → `tsc`; the user tests USB send and Bluetooth round-trip on a real pedal.

## Migration Plan

Additive session action and inbound CC apply. Disconnect still drops live state. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

None that fork the specs. Exact off/on CC values are an apply-time check against the official manuals already used for `cc.ts`.
