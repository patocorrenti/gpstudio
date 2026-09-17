## Context

See `proposal.md` for why. Controller already draws the snapshot chain as display-only slots (`src/features/controller/ControllerPage.tsx`). Official module CCs 48–57 are named in `src/device/cc.ts` but never encoded. `encode.ts` only wraps CC 0, identity, and chain-dump requests. `liveFromPedal` is already true on Bluetooth and false on USB (`src/device/link.ts`) and unused for knobs. Inbound bytes already reach `DeviceSession.handleInbound` on both links; only identity and chain dumps are applied. USB is one-way for live controls (`docs/architecture.md`). GP-50 EXP is CC 11 (expression), not a module toggle, and the dump still appends EXP as off.

## Goals / Non-Goals

**Goals:**

- Toggle the ten effect modules from Controller through the session (official CC 48–57, on-change).
- GP-50 EXP toggles via official CC 13; Bluetooth inbound uses EXP SysEx (command `02`).
- Bluetooth applies inbound live-module SysEx to the snapshot (`liveFromPedal`).
- USB sends the same toggles and ignores inbound live-module reports.
- Same chain UI on both links; GP-5 has no EXP slot.

**Non-Goals:**

- Drag-and-drop, SysEx chain writes, or a new order encode.
- Applying inbound volume/tuner/CTL or other non-module CCs.
- Treating USB as duplex.
- Volume, tuner, GP-50 extras besides EXP.

## Decisions

### 1. Same row, capability-gated apply

**Choice:** Keep one chain UI. Writes use `commandToPedal` (already true on both links). Inbound module CC applies only when `liveFromPedal` is true. Do not fork Controller for USB vs Bluetooth.

**Why:** `docs/architecture.md` already uses capabilities instead of two UIs.

**Alternative:** Hide toggles on USB. Rejected; USB can still send CC, it just will not echo.

### 2. Optimistic snapshot, then send CC

**Choice:** Toggle updates `chain[].enabled` immediately, then sends official CC 48–57 (or CC 13 for GP-50 EXP) on the open link (BLE-MIDI wrap on Bluetooth, same as CC 0). Do not wait for an echo. Do not re-request the chain dump or send CC 0.

**Why:** USB has no echo. Bluetooth echo, if it arrives, is the same on/off. A dump round-trip would revive the busy overlay for a one-bit change.

**Alternative:** Re-dump the chain after every toggle. Rejected; slow on Bluetooth and hides the row.

### 3. `liveFromPedal` means live-module SysEx (Bluetooth)

**Choice:** On Bluetooth, decode inbound identity-family SysEx (size `0x0A`, command `09`) captured from the pedal: module id in the dump id table (0=NR … 3=AMP … 9=NS), enable at byte 22 (0 off, 1 on). Set that slot's `enabled` without changing order. Still accept CC 48–57 if it ever arrives. Ignore CC 7, 11, 58, and other live controls. USB MUST NOT apply those reports even if bytes arrive. Requested chain dumps stay a separate apply path on both links.

**Why:** Patone Bluetooth captures of AMP/NR toggles on the pedal are this SysEx, not CC 48–57. App→pedal writes stay official CC.

**Alternative:** Apply every inbound CC when `liveFromPedal` is true. Rejected; volume/tuner are later. **Alternative:** Re-dump the chain on every live report. Rejected; the SysEx already carries on/off.

### 4. GP-50 EXP is a toggle; GP-5 has no EXP slot

**Choice:** On GP-50, EXP is a chain slot like the others. Bluetooth app→pedal uses official CC 13 (on/off). CC 11 stays expression parameter and is ignored. USB does not honor CC 13 (the published list is MIDI IN, not USB). App→pedal on USB sends an identity-family *request* (`F0 00 07 … 02 01 02 04 02` plus the captured EXP payload); echoing the Bluetooth *notify* frame did not work. Bluetooth inbound still uses the 24-byte notify SysEx (size `0x07`, command `02`). The preset dump still does not decode an EXP enable bit, so `applyChain` keeps the previous EXP on/off across dumps. GP-5 never shows or sends EXP.

**Why:** The GP-50 MIDI list names CC 13 as EXP on/off and that works over BLE-MIDI. USB module CC 48–57 work; USB ignores CC 13. Notify SysEx is pedal→app; writes in this family use byte `0x02` like identity requests.

**Alternative:** Leave EXP USB-broken. Rejected; the user needs the same toggle on both links. **Alternative:** Send CC 11. Rejected; that is the EXP parameter.

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
