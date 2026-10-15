# Spike: GP-5 Bluetooth footswitch press + open tuner

**Closed / paused 2026-10-14. Do not continue this bugfix without a new app→pedal capture.**

Goal: make Press Footswitch and Tuner (and, as a side path, module on/off) move the **GP-5** over **Bluetooth**, the way USB already does and the way GP-50 accepts official MIDI CC over BLE-MIDI.

Outcome: **not achieved** for GP-5 Bluetooth. Product stays on the GP-50 path (official CC + BLE-MIDI wrap). UI may flip optimistically on GP-5 BT; the pedal does not apply those writes. Temp lab UI was removed when this spike closed.

## Scope

| In scope of this spike | Out / already working |
| --- | --- |
| App→pedal stomp **press** on GP-5 BT | USB stomp CC 69 / 70 (works) |
| App→pedal **open/close tuner** on GP-5 BT | USB tuner CC 58 (works) |
| App→pedal module **on/off** on GP-5 BT (imitate press) | GP-5 BT **footswitch mode** `1115` (works) |
| | GP-5 BT global levels `1111` (works) |
| | Pedal→app live follow (`0E` stomp mask, hold-tune notify) |

GP-50 stomp / tuner / module on Bluetooth were never given a separate encode: same official CC as USB. That path is what product uses for both models. This spike only failed to find an accepted GP-5 Bluetooth substitute.

## Timeline (operator lab)

1. Physical press / hold on the pedal → GP Studio Log (live `0E`, hold-tune ~30B). Used as reverse hints.
2. Official CC over GATT (same as GP-50) → ignored on GP-5.
3. Echo / guess SysEx from those notifies (`0E`, `114e`, `1111` marker `04`) → ignored.
4. Globals lab (`1111` / `1115`) → **accepted**; removed from the temp lab.
5. Reference/Chocolate module on/off `1149` (`sendBlockStatus`) → ignored on GP-5 BT despite matching published hex.
6. Hold-tune value `0x64` as SET → ignored.
7. Restored production to official CC (GP-50 path). Spike closed; no further hex guessing.

## Locked (working on GP-5 Bluetooth)

| Write | Family | Notes |
| --- | --- | --- |
| Global levels / No CAB / screen / … | `1111` | CRC-8 + nibble-expand SET |
| Footswitch **mode** (0-99 / CTL / Tuner / …) | `1115` | Mode only — does **not** open the tuner UI |
| Patch recall | `1143` | Product |
| Model / control | `1147` / `1148` | Product |

Chocolate’s labeled “Tuner” row is `1115` mode `4`, not enter-tuner.

## Locked (pedal → app notifies only)

Operator GP Studio Log, physical footswitch on GP-5 Bluetooth:

| Action | Shape | Notes |
| --- | --- | --- |
| Stomp (CTL) | Live cmd `0E`, path `01 02 04`, enable mask | Notify; echo / `114e` SET did not press |
| Hold → tuner | ~30B, path `01 02 01 01`, effect/flag `02 02`, marker `04 00`, value `0x64` | Notify; echo and `1111` marker `04` SETs did not open tuner |

Hold-tune capture (F0-aligned):

```
F0 0D 0A 00 01 00 00 00 0A 01 02 01 01 00 02 00 02 00 04 00 00 06 04 00 00 00 00 00 00 F7
```

Reference `_reference/GP5bluetooth.html`: `sendBlockStatus` (`1149`), `sendCTL` (`114d` assign), `sendFootChange` (`1115` mode), `sendGlobalChange` / `sendGlobalVol` (`1111`). **No** press builder, **no** enter-tuner builder.

## Failed writes (do not retry as-is)

Operator: pedal did not move (LED / sound / tuner UI). Session stayed connected. Shots went through a temporary Bluetooth lab under Press Footswitch (removed on close).

### Official MIDI CC

| # | Shot | Bytes | Result |
| --- | --- | --- | --- |
| C1 | Stomp press CC 69 = 127 | `B0 45 7F` | ignored |
| C2 | Tuner on CC 58 = 127 | `B0 3A 7F` | ignored |
| C3 | Tuner off CC 58 = 0 | `B0 3A 00` | ignored |
| C4 | Module AMP off CC 52 = 0 | `B0 34 00` | ignored |
| C5 | Module AMP on CC 52 = 127 | `B0 34 7F` | ignored |
| C6 | Imitate press: CC 48–57 flip assigned / all-on | same family | ignored |

### Stomp / mask SysEx guesses

| # | Shot | Packed / shape | Result |
| --- | --- | --- | --- |
| S1 | Live `0E` echo / host `0E` | identity-family ~30B | ignored |
| S2 | Family `114e` mask SET | `01 00 06 11 4E` + low/high | ignored |
| S3 | `1149` abused as “press” (not block-status body) | guessed | ignored |

### Module on/off SysEx (reference `sendBlockStatus`)

Byte-identical to Chocolate EFFECTS ON/OFF / reference `1149`. Same GATT size class as working `1111` levels (~30B MIDI / ~32B GATT) — **MTU truncation ruled out**.

| # | Shot | Packed | Result |
| --- | --- | --- | --- |
| M1 | `1149` AMP off (effect 3) | `01 00 0A 11 49 03 00 00 00 00 00 00 00` | ignored |
| M2 | `1149` AMP on | `01 00 0A 11 49 03 00 00 00 01 00 00 00` | ignored |
| M3 | `1149` flip currently-on effects | same family | ignored |

### Tuner SysEx guesses

| # | Shot | Packed | Result |
| --- | --- | --- | --- |
| T1 | Echo hold-tune notify | capture above | ignored |
| T2 | `1111` marker `04` @ `0x7F` | `01 00 0A 11 11 02 02 04 00 7F 00 00 00` | ignored |
| T3 | `1111` marker `04` @ `0x64` (capture value) | `01 00 0A 11 11 02 02 04 00 64 00 00 00` | ignored |
| T4 | `1111` marker `04` @ `0x00` (off) | `… 04 00 00 …` | ignored (no enter) |
| T5 | `1115` mode Tuner (`4`) | mode SET (works as **mode**) | does **not** open tuner UI |

Contrast that **does** work (same `1111` size, marker `00 00` = global volume):

`01 00 0A 11 11 02 02 00 00 VV 00 00 00`

So `02 02` is writable for volume; marker `04` from the hold-tune notify is almost certainly telemetry, not a SET address.

## Ruled out

- **BLE-MIDI 20B split as root cause:** working `1111` levels are the same ~32B GATT write; product keeps one GATT write per SET (`80 80` + F0…F7).
- **Lab double-wrap:** temp lab and `encodeModule` both applied `encodeLinkMidi` once.
- **A second “press” / “enter tuner” opcode in the reference editors:** none beyond mode `1115` and block `1149`.
- **“Do what GP-50 does” as a GP-5 fix:** GP-50 uses the same CC path; GP-5 BT ignores those CCs. No separate GP-50 SysEx for press/tuner was ever locked.

## Product at close

| Action | Encode (both models, both links) |
| --- | --- |
| Stomp press | CC 69 / 70 (+ BLE-MIDI wrap on BT) |
| Tuner | CC 58 |
| Module on/off | CC 48–57 |

Do **not** reintroduce production `1149` module writes or `1111` marker `04` tuner SETs without an accepted capture. Dead helpers may still exist for asserts (`encodeBlockStatusSysex`, `encodeTunerSysex`, `encodeStompMaskSysex`); they are not wired to the session for this feature.

## Resume only if

1. An app→pedal GATT Log from the reference GP-5 Bluetooth editor, Chocolate, or Valeton Suite shows a write the pedal accepts for block toggle and/or enter-tuner, **or**
2. Firmware / host evidence explains why published `1149` / CC are ignored on this unit.

Until then: **no more guessed hex**, no temp lab, no further work on this bugfix.

## Do not retry checklist

- CC 48–57, 58, 69/70 as GP-5 Bluetooth foot / tuner / module control (already failed)
- Echo of live `0E` / hold-tune notify
- `114e` mask SET as press
- `1149` AMP on/off as listed above (unless a new capture differs)
- `1111` marker `04` at `0x7F` or `0x64`
- Expecting `1115` mode Tuner alone to open the tuner UI
