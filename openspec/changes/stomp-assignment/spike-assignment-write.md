# Spike: stomp assignment write

Lab notebook for the write SysEx. Decode is locked. Do not copy third-party payloads (`docs/protocol-references.md`). One candidate per run. USB first (no BLE-MIDI wrap). Test vector: assign/unassign DST on GP-50 stomp 1 (known bit `04`).

Encoder in `src/device/encode.ts` still emits the last failed candidate so Controller keeps a send path; the pedal ignores it. Replace that function only after a candidate is accepted.

## Locked (read)

GP-50 current-preset dump (merged payload, same patch, assignment changed on the pedal):

- Stomp 1 mask at offset **1006**, stomp 2 at **1014**, stride 8.
- Same nibble packing as module enable: byte0 CAB/EQ/MOD/DLY, byte1 NR/PRE/DST/AMP, byte3 RVB/NS. EXP is never in the mask.
- Example: stomp 1 MOD+DLY was `0C 00` at 1006/1007; adding DST became `0C 04`. Stomp 2 RVB sat at 1014–1017.
- Enable DST at dump offset 227 also flipped in that pair — side effect of the pedal UI, not the assignment field.
- GP-5 stomp 1 assumed at **920** (same 86-byte shift as enable/order). Not QA’d on hardware.

Controller decode of those dumps matches the pedal. Snapshot `stomps` fills from that dump. No extra dump is requested on edit.

## Locked (live notify, pedal → app)

GP-50 Bluetooth Log, 2026-09-17. Assigning DST on the pedal emits live command **`0D`**, 30-byte envelope (same shape as module command `09`: `00 01`, size `0x0A`, `01 02 04`). **No host marker `02`.** Bytes 1–2 are a checksum; algorithm unknown.

| Action | Bytes 1–2 | Byte 14 (stomp 1) | Byte 22 (stomp 2) |
| --- | --- | --- | --- |
| Assign DST stomp 1 | `01 0D` | `04` | `00` |
| Unassign DST stomp 1 | `05 01` | `00` | `00` |
| Assign DST stomp 2 | `00 09` | `00` | `04` |

```
F0 01 0D 00 01 00 00 00 0A 01 02 04 0D 00 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 F7
F0 05 01 00 01 00 00 00 0A 01 02 04 0D 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 F7
F0 00 09 00 01 00 00 00 0A 01 02 04 0D 00 00 00 00 00 00 00 00 00 04 00 00 00 00 00 00 F7
```

`packStompLiveBytes`: `low = (mask[0] << 4) | mask[1]`, `high = mask[3]`. DST-only `low = 0x04` matches those captures. This is a **report**, not proof of a SET command.

USB did not show these notifies (not duplex). Do not apply them on USB. Do not apply them on Bluetooth until a write is accepted (write-first).

## Failed writes (do not retry as-is)

UI moved; pedal assignment unchanged. Silence in Log (no ACK). Session stayed connected.

| # | When | Envelope | Command | Payload | Link | Result |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | 2026-09-17 | Host identity-family, size `0x09` at byte 2, host `02` at byte 8 | `05` | guessed index + 4 dump-style mask bytes | at least one of BT/USB | ignored |
| W2 | 2026-09-17 | Live 30-byte echo of the `0D` captures, checksum `00 00` | `0D` | stomp 1 at byte 14, stomp 2 at byte 22, `packStompLiveBytes` | Bluetooth (then both stomps) | ignored |
| W3 | 2026-09-17 | Host identity-family, size `0x0A` at byte 2, host `02` at byte 8, same 30-byte length; Bluetooth SysEx split into BLE-MIDI packets of 20 | `0D` | same map as W2 | **USB and Bluetooth** | ignored |

W3 rules out “BLE-MIDI MTU truncated the 32-byte packet” as the only cause: USB sends raw SysEx and also did nothing.

Working SysEx we already send (for contrast) is short host requests: `F0 00 SIZE 00 01 00 00 00 02 01 02 04 CMD F7` (name-list `0E`/`00`, current-patch `07`/`03`, current-preset `09`/`01`). Live module on/off is official CC, not a host `09`.

## Controller panel (2026-09-17) — all ignored

Temporary **Write spike** on Controller. USB and/or Bluetooth as tested by the operator. DST on/off Stomp 1 in every block: **none moved the pedal.** Do not retry these as-is.

| Title | Candidate | Result |
| --- | --- | --- |
| H1 live 0D exact CS | Exact DST captures (checksum included) | ignored |
| Live 0D XOR checksum | Live envelope, nibble-packed XOR of bytes 3–28 | ignored |
| Host short 0D | Host `02`, command `0D`, 18 bytes | ignored |
| Host size 09 cmd 0D | Preset-class size, command `0D`, 30-byte live map | ignored |
| Host cmd 04 | Host 30-byte live map, command `04` | ignored |
| Host cmd 0E | Host 30-byte live map, command `0E` | ignored |
| Host 0D + stomp index | Byte 13 = stomp index, 14–15 = that stomp | ignored |
| Dump offset poke | Host size `09` cmd `02`, nibble offset + dump mask | ignored |
| CC 28 Stomp + H1 | CC 28 = 127, then exact H1 DST frame | ignored |

H1 ignored ⇒ live `0D` is notify-only (checksum included still does nothing). H2 (checksum-only on that envelope) is dead. H4 (mode then H1) is dead. Offset poke without dump wire format is dead.

## Behavioral note (third-party editor, no payload copy)

[GP-50 web editor](https://rvalladares.com/gp5/gp50editor/) is a behavioral reference only (`docs/protocol-references.md`). Do **not** copy its JavaScript or SysEx into Patone.

Observed from the public UI + function names (not used as a source drop):

- **Patch Settings** has Footswitch A / Footswitch B checkboxes (NR…RVB; NS as N>S). `data-footswitch` is `0` or `1`. `data-effect` is `0`=NR … `8`=RVB, **`9`=NS** (not dump order).
- A checkbox click calls a **per-module** send (`sendCTL(footswitch, effect, 0|1)`), not a 30-byte live `0D` mask. That matches “the function moves the pedal but works badly”: one bit at a time, easy to desync.
- The same send path as other parameter knobs: BLE-MIDI prefix, SysEx, a **CRC-8 verifier**, then **nibble-expand** (each hex digit becomes a `0x0n` MIDI byte — the same 0–F packing as inbound dumps). `Save` is a **file export** of dump bytes, not that live CTL path. Patch/Stomp mode is a different parameter send (`sendFootChange`).
- Inbound, they also treat a 36-byte frame as GP-5 footswitch-mode change.

Starting point for the next Patone-owned candidate: stop echoing `0D`. Treat SET as a **checksummed, nibble-packed, per-effect parameter write** (stomp index + effect index + 0/1), same wire family as the dump, using a CRC-8 we own and addresses filled from a Patone or official-app capture — never a copied hex template.

## Open

The pedal accepts some app→pedal assignment SET. We have not captured that direction. Hypotheses, cheapest first:

| ID | Hypothesis | How to falsify | Status |
| --- | --- | --- | --- |
| H1 | Live `0D` is notify-only; echoing it (W2/W3) cannot SET | Exact DST captures including checksum | **failed** (panel) |
| H2 | Checksum is required and `00 00` is rejected | Blocked on H1; XOR-CS variant also ignored | **failed** on live `0D` |
| H3 | SET is a host preset-field write (dump mask at 1006/1014), not live `0D` | Offset-poke panel row ignored | **failed** as raw host `02`+offset |
| H4 | SET only while Patch/Stomp mode is Stomp (CC 28) | CC 28 then H1 ignored | **failed** |
| H5 | SET needs a session/edit preamble we do not send | Official-tool capture of bytes before the assignment frame | open |
| H6 | Send path is dropping SysEx | USB MIDI monitor / BLE sniffer while clicking a chip | low |
| H7 | SET is a CRC-8 + nibble-expand **per-effect** parameter write (stomp, effect, 0/1), same family as other preset knobs | Patone-owned encoder of that shape; confirm with dump 1006/1014 | **next** |

## Procedure

1. One new family at a time (now H7). Leave dump decode alone. Do not retry W1–W3 or the nine panel rows.
2. USB, GP-50, Log open. Assign DST on Stomp 1, then unassign. Look at the pedal.
3. Record pass/fail in the table **before** the next candidate.
4. If accepted: dump and confirm offsets 1006/1014; then Bluetooth; then GP-5 920.
5. Do not copy third-party SysEx. Official Valeton app → USB MIDI monitor is a valid Patone capture of app→pedal.

## Next

**H7 on Controller (top card, 2026-09-17).** Per-effect write: CRC-8 ATM (poly `0x07`) of packed body, nibble-expand, size `05`, path `01 01 04`, command `0D`, then stomp / effect / 0|1. DST Stomp 1 on/off. Previous nine rows are folded under “Previous candidates”.

- Pedal follows → lock this encoder, dump-confirm 1006/1014, then Bluetooth / GP-5.
- Ignored → stop tomorrow; need an official-app address capture, not more live `0D`.
