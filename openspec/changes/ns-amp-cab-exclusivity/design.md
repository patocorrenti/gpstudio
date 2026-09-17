## Context

See `proposal.md` for why. Controller already draws `snapshot.chain` as labeled slots with an on/off switch (`src/features/controller/ControllerPage.tsx`). `toggleChainSlot` flips only that slot's `enabled` and sends that module's official CC (`src/device/session.ts`). `chain.ts` already names NS, AMP, and CAB as separate ids; there is no bypass flag. `chain-on-off` left NS vs AMP/CAB exclusivity pedal-owned and refused to rewrite sibling `enabled` on USB. That MIDI choice stays; this change adds the pedal's prohibition mark as a derived UI state. USB is still one-way for knobs (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- Derive AMP/CAB bypass from NS on, without a new snapshot field or extra MIDI.
- Overlay AMP and CAB with a prohibition mark while leaving `enabled` and the switch alone.
- Keep `toggleChainSlot` one-slot so toggling NS never sends AMP/CAB CCs.

**Non-Goals:**

- Client-side on/off matrix (turning AMP/CAB off when NS goes on, or NS off when AMP/CAB go on).
- Changing dumps, live-module apply, or encode.
- Forking USB vs Bluetooth UI.

## Decisions

### 1. Bypass is derived, not stored

**Choice:** Add a pure helper on the chain (e.g. `chainSlotBypassed(chain, id)`): true only for `amp` and `cab` when the NS slot exists and is on. Controller reads it per slot. Do not add `bypassed` to `AudioChainSlot` or the snapshot.

**Why:** The dump already stores AMP/CAB on/off independently of NS. A stored flag would drift from NS on USB (no echo) and on dump refresh.

**Alternative:** Set `enabled: false` on AMP/CAB when NS turns on. Rejected; that is turning them off, which the pedal does not do for this mark.

### 2. Overlay, not a disabled switch

**Choice:** When the helper is true, draw a prohibition icon over the AMP/CAB slot (lucide `Ban`, already in the project via `lucide-react`). Keep the slot's on/off styling from `enabled`. The switch stays enabled and still calls `toggleChainSlot`. The overlay MUST NOT capture pointer events on the switch.

**Why:** Specs require the stored on/off to stay visible and togglable. Disabling the switch would hide that state.

**Alternative:** Grey out and disable the AMP/CAB switches while NS is on. Rejected; that looks like off and blocks setting state for when NS is later off.

### 3. Session stays one-slot (do not reverse chain-on-off MIDI)

**Choice:** Leave `toggleChainSlot` as it is: flip one id, send one CC. Do not send AMP/CAB CCs when NS changes. Bluetooth inbound live-module SysEx MAY still change AMP/CAB `enabled` if the pedal reports it; that is existing `liveFromPedal` apply, not this overlay. USB still ignores those reports.

**Why:** `chain-on-off` already refused a client exclusivity matrix because USB cannot see the pedal's side effects. The overlay does not need those side effects: it keys off NS on.

**Alternative:** When NS turns on, also send AMP/CAB off. Rejected; that rewrites on/off.

### 4. Architecture / context catch up

**Choice:** In the same apply, note in `docs/architecture.md` and `openspec/config.yaml` that NS on bypasses AMP/CAB visually (prohibition mark) without rewriting their on/off. IR / SnapTone upload stays later.

**Why:** Stop the next agent from treating the mark as an on/off rewrite or as still out of scope.

## Risks / Trade-offs

- [Bluetooth pedal also reports AMP/CAB off when NS turns on] → Overlay still follows NS; inbound `enabled` apply stays as today. Do not hide the switch state.
- [User thinks the mark means AMP is off] → Keep on/off styling under the overlay; switch remains the on/off control.
- [chain-reorder / stomp changes also touch the chain row] → Helper lives in `chain.ts` so those UIs can reuse it; do not fold their work into this change.
- [No browser verification] → `tsc`; the user tests the overlay on a real pedal.

## Migration Plan

Additive helper and overlay. Disconnect still drops chain state. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

None that fork the specs.
