## Context

See proposal.md for why. Assignment (`114d`) and Bluetooth follow of a physical footswitch (live command `0E`) already exist. The manuals publish the press itself as MIDI CC, not SysEx: GP-5 CC 69 CTL (`_reference/` GP-5 MIDI list); GP-50 CC 69 CTRL 1 and CC 70 CTRL 2 (GP-50 MIDI list, pages 52–53). Neither chart splits 0–63 / 64–127 the way module on/off does.

`gp5Cc.ctl` is already 69. `gp50Cc` inherits it and has no CC 70. `toggleChainSlot` updates the snapshot and sends one CC through `DeviceSession`; React never sees bytes. USB does not apply live `0E`, so a press that only waited for the pedal would leave the USB chain stale.

## Goals / Non-Goals

**Goals:**

- One session action sends the published CTRL/CTL CC and flips assigned module on/off in the snapshot before the pedal answers.
- Controller shows the press next to the chain, through that action.

**Non-Goals:**

- A new write sibling under `src/device/session/`. This is one CC on click, same shape as `toggleChainSlot`, not a throttled family.
- Changing `decodeLiveStompMask` or applying USB live reports.

## Decisions

### Official CC 69 / 70, value 127, one message

GP-5 and GP-50 A send CC 69. GP-50 B sends CC 70. The value is 127, one channel message (USB raw, Bluetooth the existing BLE-MIDI wrap). `gp50Cc` gains `ctrl2: 70`. CC 69 stays the inherited `ctl`.

**Alternative:** imitate the press with CC 48–57 for each assigned module. Rejected. The pedal must apply the stomp (trails and any group rule live there).

**Alternative:** SysEx, or echo live `0E`. Rejected. The manuals already name the CC, and echoing a notify is not a SET.

**Alternative:** send 0 then 127. Not indicated. The chart has no off/on pair. If a capture shows 127 is ignored, change the constant; do not add a second message unless the pedal requires it.

### Snapshot flips each assigned effect, then the CC goes out

Same gates as `toggleChainSlot`: connected, sync ready, chain not syncing, `commandToPedal`. GP-5 accepts only index 0. GP-50 accepts 0 (A) and 1 (B). Any other index sends nothing.

Each effect in that stomp's assignment toggles `enabled`. Unassigned slots, EXP, order, models, controls, and the assignment lists stay. An empty list still sends the CC. `modified` goes through the existing working-patch check, so a second press that restores the baseline clears it. No patch recall and no chain dump.

**Why independent toggle:** a captured footswitch can turn MOD off and DLY on in one press (`decodeLiveStompMask`). That is each assigned module flipping, not a latch that forces them all on or all off.

**Alternative:** wait for command `0E`. USB never delivers it, so the chain would not move.

**Alternative:** re-request the current-preset dump. That is the busy overlay this change must not show.

Bluetooth `0E` still applies as it does today and may replace the optimistic on/off with the pedal's mask. It is not a patch change.

### Press controls are a Controller sibling

A small row beside the chain (feature file under `src/features/controller/`, not `src/components/`). English labels: `Stomp` on GP-5, `A` and `B` on GP-50. Disabled while `chainSync` is syncing. Hidden when disconnected. Assignment marks stay assign-only. The row calls the session; it does not import `encode.ts`.

## Risks / Trade-offs

- [Pedal ignores value 127] → Operator checks one press on each model. If another single value on the same CC works, change only the encoder constant.
- [Pedal latches assigned modules together instead of flipping each one] → Bluetooth `0E` corrects the chain. On USB the optimistic flip would be wrong until Reload. If a capture shows a latch, change the flip rule in the same session action; do not switch to a dump.
- [A late `0E` from press 1 arrives after press 2] → The mask is absolute, so it can undo the second flip. Accepted. No suppression window unless apply sees it on the pedal.
- [CTRL does nothing unless the unit is already in Stomp / CTL mode] → Still send. The press is not gated on CC 28 or `1115`. If the pedal ignores it, that is a manual limit, not an app mode switch.

## Migration Plan

No stored data and no transport change. Ship the encoder, the session action, and the Controller row together. Rollback is reverting that slice. Update `docs/architecture.md`, `docs/protocol-references.md`, and the `context` field in `openspec/config.yaml` so CC 69 / CC 70 are in scope on both links.

## Open Questions

None. The CC numbers are in the manuals, and the flip rule matches the stomp mask already applied on Bluetooth.
