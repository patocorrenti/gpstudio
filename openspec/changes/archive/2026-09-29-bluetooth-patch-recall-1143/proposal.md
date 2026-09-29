## Why

Over Bluetooth, app→pedal patch change does nothing: `encodePatch` sends official CC 0 wrapped as BLE-MIDI, and the pedal ignores it. Pedal→app still works via the current-patch notify. The local GP-5 / GP-50 reference editors recall patches with parameter-write SET family `1143` on both links (`docs/architecture.md`: when BLE cannot speak a CC, the encoder is the seam).

## What Changes

- Bluetooth `encodePatch` sends a Patone-owned SET of packed family `1143` (path `01 01 04`, CRC-8 ATM + nibble-expand, one GATT write `80 80` + `F0`…`F7`), not CC 0.
- USB patch recall stays official CC 0 (unchanged wire).
- Specs stop requiring CC 0 for every patch select; Bluetooth recall is the `1143` SET through the device session.
- Protocol notes (`docs/protocol-references.md`, architecture / OpenSpec context) record that Bluetooth recall is `1143`, not CC 0.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `device-connection`: Bluetooth patch recall MUST use SET family `1143`; USB keeps official CC 0.
- `live-controller`: Patch bar select / previous / next MUST send through the device session without mandating CC 0 on every link.

## Non-goals

- Changing USB patch recall off CC 0 (even though the reference editors also use `1143` on USB).
- Changing pedal→app current-patch notify handling.
- Copying reference editor JavaScript into `src/`.
- Library, Editor, IR/NAM upload, or other SysEx families.

## Impact

- `src/device/encode.ts` (`encodePatch`), likely a small packed-SET helper next to store/volume (`patch-store.ts` or sibling), session checks that assert CC 0 for Bluetooth recall, and brief docs updates.
- Controller / Connect UI unchanged; still call `session.setPatch`.
