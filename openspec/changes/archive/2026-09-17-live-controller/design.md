## Context

See `proposal.md` for why. Controller is still placeholder copy in `src/features/controller/ControllerPage.tsx`. `DeviceSession` can connect and disconnect but does not send CC or track a patch. Official maps already live in `src/device/cc.ts` (`patch: 0`). GP-5/GP-50 recall patches with CC 0 values 0–99 on MIDI channel 1, not Program Change.

## Goals / Non-Goals

**Goals:**

- Session snapshot carries `patch` (0–99) when connected.
- Session methods `setPatch` / `stepPatch` encode CC 0 and `transport.send`.
- ControllerPage branches on snapshot: empty state vs patch bar.

**Non-Goals:**

- Inbound MIDI sync of the current patch (pedal-side changes stay out of this slice).
- New shadcn primitives unless a Select/Popover is needed for the 00–99 list.
- Changing MidiTransport or Tauri commands.

## Decisions

### 1. Absolute CC 0 for select, previous, and next

**Choice:** Compute the next index in session (`(n ± 1 + 100) % 100`) and send CC 0 with that value. Do not send CC 24/25 (patch ±) or CC 22/23 (bank ±).

**Why:** Manual bank ± is the tens digit; patch ± is the ones digit. Absolute CC 0 is the official 00–99 recall and keeps the UI and pedal on the same number.

**Alternative:** Fire CC 25 for next. Rejected; it would not walk 09 → 10 as a single 00–99 list.

### 2. Channel 1; two-digit labels; no names

**Choice:** Status byte `0xB0` (channel 1). Label is `00`–`99`. No onboard preset names.

**Why:** GP-5 listens on channel 1. Names need SysEx, which this phase forbids.

**Alternative:** Show `Patch 00`. The two-digit id matches the pedal and leaves room for a name later.

### 3. Optimistic 00, no CC on connect

**Choice:** Connected snapshot starts at patch 0. Do not send CC 0 until the user selects or steps. Disconnect drops patch state.

**Why:** Sending 00 on connect would stomp whatever the pedal is already on. We cannot read the current patch with official CC.

**Alternative:** Query on connect. Not available without SysEx.

### 4. Encode in DeviceSession, not React

**Choice:** `setPatch(n)` clamps 0–99, updates snapshot, sends `[0xB0, gp5Cc.patch, n]`. Controller calls session methods only.

**Why:** Matches `docs/architecture.md`: UI never talks raw MIDI.

**Alternative:** Feature code builds CC bytes. Rejected; the CC map would leak out of `src/device/`.

## Risks / Trade-offs

- [Displayed 00 may not match the pedal until the user changes patch] → Accept for this slice; do not send on connect.
- [Pedal ignores channel ≠ 1] → Hard-code channel 1 per the published MIDI notes.
- [No browser verification in this change] → `tsc`; the user tests the patch bar on a real GP-5/GP-50.

## Migration Plan

Additive. Rollback is reverting the change. No stored patch to migrate.

## Open Questions

None for this slice.
