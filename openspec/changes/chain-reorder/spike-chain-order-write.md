# Spike: chain-order write

**Paused 2026-09-18; SET shape captured the same day; encoder restored.** Pedal→app live chain-order is product. W1/W2 (identity-family echo) were ignored. Operator logged an **accepted** Bluetooth SET (PRE before NR). Patone now encodes that shape. Do not copy third-party source into `src/` (`docs/protocol-references.md`). Do not retry W1/W2.

Lab notebook for the write SysEx. Decode/apply of the live notify is locked.

## Locked (read)

Bluetooth Patone Log, 2026-09-18, chain edit **on the pedal** (not a reference-editor payload copy). Identity-family live notify, **34 bytes**, size `0x0C` at byte 8, command `0x04`, path `01 02 04`. Bytes 1–2 are a checksum (algorithm unknown; two captures used `06 00` and `0E 01`). Ten-slot order is nibble-expanded `DUMP_MODULE_IDS` indices from byte 13 (`00 <id>` pairs). Not a current-preset dump.

Move rules (manual + operator): NR, PRE, MOD, DLY, RVB may sit before or after the fixed block. DST, NS, AMP, CAB, EQ stay contiguous in that order; nothing between them. EXP stays last on GP-50.

Helper: `reorderChain` in `src/device/chain.ts` (still in tree; session does not call it). Decoder: `decodeLiveChainOrder` in `src/device/chain-codec.ts`. Session applies that notify when `liveFromPedal` is true. USB does not emit this notify and must not apply it.

```
PRE before NR:
F0 06 00 00 01 00 00 00 0C 01 02 04 04 00 01 00 00 00 02 00 09 00 03 00 04 00 05 00 06 00 07 00 08 F7
→ pre, nr, dst, ns, amp, cab, eq, mod, dly, rvb

PRE after EQ (after the fixed block):
F0 0E 01 00 01 00 00 00 0C 01 02 04 04 00 00 00 02 00 09 00 03 00 04 00 05 00 01 00 06 00 07 00 08 F7
→ nr, dst, ns, amp, cab, eq, pre, mod, dly, rvb
```

USB has no live reorder telemetry (not duplex). Do not treat missing USB Log as a missing write.

## Failed writes (do not retry as-is)

Controller drag updated the snapshot; the pedal order did not change. Silence in Log (no ACK). Same outcome as stomp SET candidates.

| # | When | Envelope | Command | Payload | Link | Result |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | 2026-09-18 | Host identity-family, size `0x0C` at byte 2, host `02` at byte 8, one BLE-MIDI wrap (~36-byte GATT write) | `04` | nibble-expanded ten `DUMP_MODULE_IDS` indices | Bluetooth | ignored (operator: drag does nothing). Packet likely exceeds ~20-byte BLE-MIDI/GATT |
| W2 | 2026-09-18 | Live notify envelope (size `0x0C` at byte 8, checksum `00 00`), BLE-MIDI split into packets of 20 then 18 | `04` | same nibble payload as the captures | Bluetooth | ignored (operator: still nothing on the pedal) |

W2 rules out “GATT truncated the notify” as the only cause: the split matches how inbound SysEx already arrives, and the pedal still ignored it. Echoing command `04` (checksum zeroed) is notify-only, like stomp `0D`.

USB host write (raw 34-byte SysEx, byte 8 = `02`) was prepared; operator did not confirm a USB drag after W2. Do not assume USB works.

Working SysEx we already send (for contrast) is short host requests: `F0 00 SIZE 00 01 00 00 00 02 01 02 04 CMD F7`. Live module on/off is official CC, not a host `09`. Chain order has no official CC.

## Accepted SET (2026-09-18, Bluetooth)

Operator moved PRE before NR in a reference editor used as a black box (Patone must not copy that page’s JavaScript). `sendSysex` logged the GATT write; the pedal accepted it.

BLE-MIDI prefix `80 80`, then 34-byte SysEx:

```
8080F0080700010000000C010104040001000000020009000300040005000600070008F7
```

Unwrapped:

```
F0 08 07 00 01 00 00 00 0C 01 01 04 04 00 01 00 00 00 02 00 09 00 03 00 04 00 05 00 06 00 07 00 08 F7
→ pre, nr, dst, ns, amp, cab, eq, mod, dly, rvb
```

Same ten-slot nibble payload as the inbound notify for that order. The SET differs in **path and checksum**:

| | Inbound notify (pedal→app) | Accepted SET (app→pedal) | W1 / W2 (ignored) |
| --- | --- | --- | --- |
| Path | `01 02 04` (identity / live) | `01 01 04` (parameter write) | `01 02 04` |
| Bytes 1–2 | live checksum (`06 00`, `0E 01`, …) | CRC-8 nibble-expanded (`08 07` here) | host size / `00 00` |
| Size `0x0C` | byte 8 | byte 8 | W1: byte 2 |

Packed body (low nibble of each MIDI byte after the checksum, i.e. undo nibble-expand) is 15 bytes:

`01 00 0C 11 44` + ten `DUMP_MODULE_IDS` indices as raw bytes (`01 00 02 09 03 04 05 06 07 08` for PRE before NR).

CRC-8 (poly `0x07`, init `0`) of those 15 bytes is `0x87` → MIDI `08 07`. Then nibble-expand every hex digit to a `0x0n` MIDI byte, wrap `F0`…`F7`, BLE-MIDI split on Bluetooth (`encodeLinkMidiPackets`). Same CRC + nibble family as stomp H7; H7 used the wrong size/command/body. Do not paste the reference editor’s functions into `src/`.

USB of this envelope is unverified (capture was Bluetooth). Patone encoder: `encodeChainOrderSysex` in `src/device/chain-codec.ts` (CRC-8 + nibble-expand in `src/device/sysex-nibble.ts`). Session send + Controller drag restored. Operator confirms the pedal still accepts Patone’s bytes.

## Resume

1. Do not retry W1/W2 as-is. Do not echo `01 02 04` command `04`.
2. SET encoder is the accepted packed body. Keep inbound `01 02 04` apply unchanged.
3. Confirm on Bluetooth (and USB if testing that link). Do not archive until the operator sees the pedal move.
