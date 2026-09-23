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

## Hypothesis H10 (2026-09-23) — full stomp mask

Operator: B-NR on works; every other B button also lit NR; B-NR off did nothing. That matches treating the old third byte as a 0|1 flag (always bit0/NR) and ignoring effect index — not a full replace.

**Under test:** `114d` body `foot | low | high` with live-style pack of the **entire** stomp after the toggle (`low = (m0<<4)|m1`, `high = m3`). Off sends mask without that bit (or empty).

Retest B: NR on → only NR; PRE on → PRE (or NR+PRE if both); NR off → clears NR.



