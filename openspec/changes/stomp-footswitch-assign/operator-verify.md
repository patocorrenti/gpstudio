# Operator verify: stomp assignment SET `114d`

Confirm Patone’s write is accepted before treating live Bluetooth `0D` as follow.

Do **not** retry envelopes in `openspec/changes/stomp-assignment/spike-assignment-write.md` (W1–W3, H1–H4, H7).

## USB — GP-50

1. Connect GP-50 over USB; open Log.
2. Assign DST on Footswitch A; clear it.
3. Log should show a SysEx SET with packed family `114d` (path `01 01 04` after CRC + nibble-expand), not live command `0D`.
4. Reload (or patch change and back); dump masks at 1006/1014 should match the UI.

- [ ] Pass
- [ ] Fail — notes:

## Bluetooth — GP-50

1. Same assign/clear on Footswitch A (and optionally B).
2. Confirm GATT write is one packet (BLE-MIDI wrap of the same SysEx).

- [ ] Pass
- [ ] Fail — notes:

## USB or Bluetooth — GP-5

1. One stomp only; assign/clear MOD (or MOD+DLY).
2. Dump offset 920 family should match.

- [ ] Pass
- [ ] Fail — notes:

## Hypothesis H9 (2026-09-23) — wire foot inverted + short body

Operator on padded `0E`: A-app wrote only to B-pedal; B-app NR lit NR on A-pedal (clean). So UI A ⇔ wire `1`, UI B ⇔ wire `0`.

Multi-module lights are from mis-parsed frames, not a full-stomp payload: each click still sends one `(foot, effect, 0|1)`.

**Under test:** short size-`05` `114d` again, with GP-50 foot map A→1 / B→0.

Retest: A-NR on/off (expect only NR on A); A-PRE; B-NR.


