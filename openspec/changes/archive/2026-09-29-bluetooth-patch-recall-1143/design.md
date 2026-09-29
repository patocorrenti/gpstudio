## Context

See proposal.md — Why. Today `encodePatch` always returns official CC 0 (`B0 00 patch`), BLE-MIDI-wrapped on Bluetooth. Session checks and fixtures treat that as the recall frame. Reference editors (`_reference/GP5bluetooth.html` and siblings) send packed family `1143` instead. Other SETs (`114a`, `1142`, `1147`, `1148`) already share CRC-8 ATM + nibble-expand framing in `src/device/`.

## Goals / Non-Goals

**Goals**
- Bluetooth `setPatch` / `stepPatch` move the pedal via SET `1143`.
- USB recall stays CC 0.
- Encoder / session checks assert the split; UI unchanged.

**Non-Goals**
- Switching USB to `1143`.
- Changing inbound current-patch notify decode.
- New GATT backends or chunking rules (one write `80 80` + full SysEx remains).

## Decisions

1. **Bluetooth-only `1143`; USB stays CC 0**  
   Matches the reported bug and keeps the existing USB contract. Reference editors use `1143` on USB too; leave that for a later change if USB recall ever fails.  
   *Alternative:* Both links use `1143`. Rejected for this change to avoid widening USB risk and to keep the USB CC 0 scenario intact.

2. **Packed body locked from the reference editors**  
   `01 00 06 11 43` + patch byte (0–99) + `00 00 00`, then CRC-8 ATM + nibble-expand + `F0`…`F7`, then `encodeLinkMidi`. Same path family as store/volume. Do not paste reference JavaScript.  
   *Alternative:* Keep trying CC 0 with different BLE-MIDI timestamps. Rejected; editors never send CC 0 for list selection.

3. **Encode seam stays in `encodePatch(linkMode, patch)`**  
   Branch on `linkMode` inside the existing helper (or a tiny sysex helper called from it). `DeviceSession.setPatch` stays call-site unchanged.  
   *Alternative:* Separate `encodePatchBluetooth`. Rejected; one entry point already wraps other commands.

4. **Reuse `framePackedSet` pattern from `patch-store.ts`**  
   Either export a shared framer or add `encodePatchRecallSysex` next to the other packed SETs. Prefer the smallest edit that keeps CRC/nibble in one place.

## Risks / Trade-offs

- [GP-50 Bluetooth also needs `1143`] → Same family in all four reference editors; apply on Bluetooth for both models.  
- [USB operators expect SysEx like the web editor] → Out of scope; USB CC 0 remains until reported broken.  
- [Session checks still assert Bluetooth CC 0] → Update fixtures when changing the encoder.

## Migration Plan

Ship in one release. No data migration. Rollback is reverting `encodePatch` to CC 0 on Bluetooth.

## Open Questions

None.
