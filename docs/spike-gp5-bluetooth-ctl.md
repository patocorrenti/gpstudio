# Spike: GP-5 Bluetooth CTL press and tuner

**Blocked 2026-11-11.** GP-5 over Bluetooth ignores the official CTL (CC 69) and tuner (CC 58) CCs. No tested write changes the pedal's own CTL state (footswitch LED green → red). Product code keeps the footswitch and tuner hidden on GP-5 Bluetooth (`src/features/connect/PedalFootControls.tsx`) until one does. This file is the lab notebook. Resume here; do not retry the failed writes below as-is.

Debug code for these runs lives on branch `claude/quirky-albattani-cjbv4s` (not merged): one press button per candidate on GP-5 Bluetooth, and `[GP Studio stomp debug]` console logs of the bytes sent and of the raw `0E` notify. Use it to resume instead of rewriting the harness.

## Context

| Pedal / link | CC 69 / CC 70 press | CC 58 tuner |
| --- | --- | --- |
| GP-5 USB | works (`B0 45 7F`) | works |
| GP-50 USB | works | works |
| GP-50 Bluetooth | works, the CTL LED follows | works |
| **GP-5 Bluetooth** | **ignored** | **ignored** |

On GP-5 Bluetooth, other official CCs do work with the same BLE-MIDI wrap and channel: module on/off CC 48–57 and patch volume CC 7 (operator, 2026-11-11). So the BLE-MIDI framing is fine. Like patch recall (CC 0 → SET `1143`), the GP-5 Bluetooth firmware ignores some official CCs.

There are two separate problems:

1. **Flip the modules assigned to CTL.** Solved; see "Accepted writes".
2. **Make the pedal itself enter the CTL state** (LED red; and, separately, enter the tuner). Not solved.

## Locked (live notify, pedal → app)

Physical CTL press on GP-5 Bluetooth, GP Studio debug log, 2026-11-11. Each press emits identity-family command `0E`, 22 bytes, path `01 02 04` (packed family `12 4e`). Decoded today by `decodeLiveStompMask` (`src/device/chain-codec.ts`).

```
F0 07 00 00 01 00 00 00 06 01 02 04 0E 0A 0D 00 0A 00 01 00 00 F7   CTL → red
F0 00 05 00 01 00 00 00 06 01 02 04 0E 02 0D 00 02 00 00 00 00 F7   CTL → green
```

Packed body (four bytes, nibble pairs at 13, 15, 17, 19):

| State | Mask low | Mask high | Byte 3 | Byte 4 |
| --- | --- | --- | --- | --- |
| red | `AD` (NR, DST, AMP, EQ, **DLY**) | `0A` (NS + **`08`**) | **`01`** | `00` |
| green | `2D` (NR, DST, AMP, EQ) | `02` (NS) | **`00`** | `00` |

- Mask bits follow `DUMP_MODULE_IDS`: low bit0 NR … bit7 DLY; high bit0 RVB, bit1 NS.
- **Byte 3 is the CTL state** (`01` red, `00` green).
- **High-mask bit `0x08` follows the CTL state.** `decodeLiveStompMask` ignores it today ("extra high bits").
- Byte 4 stayed `00`.

## Accepted writes (problem 1 only)

The CTL LED stays green for both.

| # | Write | Result |
| --- | --- | --- |
| A1 | Module CC 48–57 for each assigned module, new on/off (`80 80 B0 31 7F`, `80 80 B0 38 7F`), 30 ms apart | modules flip on the pedal; LED stays green |
| A2 | Guessed SET `114e`: `01 00 06 11 4e` + mask low + mask high + byte 3 + byte 4, CRC-8 + nibble-expand, path `01 01 04`, one GATT write | the pedal applies the **whole** ten-module mask; LED stays green |

`114e` comes from the pattern that each known notify `12 4x` has a SET `11 4x` with the same body (chain order `44`, model `47`, control `48`, assignment `4d`). It is **accepted but writes only the module mask**. It sets all ten modules, so a stale app chain also overwrites modules that are not on CTL. Prefer A1 if a module-only emulation ships.

A1/A2 mark the working patch `modified` (Save enables), because they change the patch's module on/off. A real CTL press is a footswitch state, so that is a product difference to resolve before shipping an emulation.

## Failed writes (do not retry as-is)

GP-5 Bluetooth. The CTL LED did not change in any of these.

| # | Write | Bytes (after BLE-MIDI `80 80`) | Result |
| --- | --- | --- | --- |
| F1 | CC 69 = 127 | `B0 45 7F` | ignored |
| F2 | CC 69 = 0, then 127 (30 ms) | `B0 45 00`, `B0 45 7F` | ignored |
| F3 | `114e` with byte 3 flipped (00 → 01), extra high bits kept | mask + `01 00` | mask applied; LED green |
| F4 | `114e` with byte 3 flipped and high bit `08` set: **byte-identical body to the red notify** (`AD 0A 01 00`) | `F0 00 0B 00 01 00 00 00 06 01 01 04 0E 0A 0D 00 0A 00 01 00 00 F7` | mask applied; LED green |
| F5 | CC 58 tuner | `B0 3A 7F` | ignored (pre-existing finding) |

The GP-5 footswitch mode during F1/F2 was not recorded. CTL-mode gating (`1115` = `CTL` before the press) is not ruled out. Re-check it first on resume.

## Next steps (not done)

- Read the GP-5 Bluetooth reference editor (`_reference/GP5bluetooth.html`; online copy in `docs/protocol-references.md`) for a CTL or tuner control. Do not paste its source.
- If the official Valeton app has CTL or tuner controls, capture it: Android "Bluetooth HCI snoop log" → Wireshark, filter writes to characteristic `7772e5db-…`.
- If neither has them, the GP-5 Bluetooth firmware probably does not expose the CTL state or the tuner. Keep them hidden.

## Docs and spec drift

`openspec/specs/device-connection/spec.md` (stomp press) still says GP-5 sends CC 69 on "a USB or Bluetooth session". Product code hides that press on GP-5 Bluetooth. Fix the spec in the change that resolves this spike.
