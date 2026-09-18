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

## Open

The pedal accepts some app→pedal assignment SET. We have not captured that direction. Hypotheses, cheapest first:

| ID | Hypothesis | How to falsify | Status |
| --- | --- | --- | --- |
| H1 | Live `0D` is notify-only; echoing it (W2/W3) cannot SET | Send the **exact** captured DST-stomp1-on frame, checksum included, over USB. If still ignored, `0D` is not SET. | next |
| H2 | Checksum is required and `00 00` is rejected | Same as H1; if the exact frame works, solve CS from more notifies before inventing a new envelope | blocked on H1 |
| H3 | SET is a host preset-field write (dump mask at 1006/1014), not live `0D`. W1 guessed command `05` | Capture **app→pedal** while an official tool assigns DST, or watch behavior (timing, extra dumps) without copying third-party bytes | open |
| H4 | SET only while Patch/Stomp mode is Stomp (CC 28) | Put the pedal in Stomp mode, retry a candidate that is otherwise identical | open |
| H5 | SET needs a session/edit preamble we do not send | Official-tool capture of the bytes **before** the assignment frame | open |
| H6 | Send path is dropping SysEx | USB MIDI monitor / BLE sniffer while clicking a chip; CC on/off still works as control | low (CC and dumps work; session did not drop) |

## Procedure

1. Pick one row (H1 first). Change only `encodeStompAssignment` (or a throwaway USB send). Leave dump decode alone.
2. USB, GP-50, Log open. Assign DST on Stomp 1, then unassign. Look at the pedal, not only the UI.
3. Record pass/fail, link, and any inbound SysEx in the table above **before** the next candidate.
4. If a candidate is accepted: dump the current preset and confirm offsets 1006/1014 (and the other stomp) still match; then Bluetooth; then GP-5 offset 920.
5. Do not copy third-party SysEx. Official Valeton app → USB MIDI monitor is a valid Patone capture of app→pedal.

## Next

**H1 on USB.** Build the exact 30-byte DST-stomp1-on capture (checksum `01 0D`) and send it raw. Same for the unassign capture (`05 01`) on the off click.

- Ignored again → stop echoing `0D`. Need an app→pedal SET capture (H3/H5), not more live envelopes.
- Pedal follows → checksum/live envelope was the gap; solve CS from more pedal-side assigns (H2) and keep write-first before applying inbound `0D`.
