## 1. Official CC encoders

- [ ] 1.1 In `src/device/cc.ts`, keep GP-5/GP-50 patch volume on CC 7. Point GP-50 absolute tempo at CC 73 and CC 74. Stop treating CC 21 as BPM (CC 19 and CC 21 stay unused step controllers). Verify `npx tsc -b --pretty false` typechecks `src/device/cc.ts`
- [ ] 1.2 Add patch-volume and patch-tempo CC encoders in `src/device/encode.ts` (USB is the CC bytes; Bluetooth is the same bytes with one BLE-MIDI wrap each). Volume is one CC 7 in 0–100. Tempo is CC 73 then CC 74 for 40–127, 128–255, and 256–260 as in the GP-50 manual, and rejects anything outside 40–260. Leave the existing family-`1142` `encodePatchVolume` / `encodePatchBpm` for `.prst` upload. Extend the module-load assert for those CC bytes and verify `npx tsc -b --pretty false` typechecks `src/device/encode.ts`

## 2. Session snapshot and writes

- [ ] 2.1 When a current-preset dump is applied, read patch volume and GP-50 patch BPM from the dump word offsets `patch-store` already uses. Put `patchVolume` and `patchBpm` on the connected snapshot (`null` when missing or out of range; GP-5 `patchBpm` stays `null`). Verify `npx tsc -b --pretty false` typechecks `src/device/session.ts`
- [ ] 2.2 Add session writes for patch volume and GP-50 patch BPM that update the snapshot on-change, coalesce with the existing 80 ms control throttle and flush on release (keys that do not collide with slot controls), and send the new CC encoders. Do not send patch recall, a chain dump, or CC 17/19/21 for those edits. A GP-5 session must not send tempo. Verify `npx tsc -b --pretty false` typechecks the new methods
- [ ] 2.3 Include patch volume, and GP-50 patch BPM, in the modified baseline next to the chain. A dump for a new patch, reload, or an unmodified confirmation sets those snapshot values and starts clean. A discarded edited dump leaves the edited values and `modified`. Returning volume or BPM to the baseline clears `modified` only when the rest of the working patch matches. Inbound CC 7, CC 73, and CC 74 must not change volume, BPM, or `modified`. Verify `npx tsc -b --pretty false` typechecks dump-apply and the baseline compare
- [ ] 2.4 On download, still re-request the dump and still do not recapture the baseline. If the working patch is modified, write the snapshot volume and GP-50 BPM into that dump before encoding the `.prst`, and leave the on-screen values in place. Verify `npx tsc -b --pretty false` typechecks `downloadCurrentPatch`

## 3. Patch bar

- [ ] 3.1 Show English `Volume` (GP-5 and GP-50, 0–100) and `BPM` (GP-50 only, 40–260) sliders in the patch bar (`src/features/controller/`, not under `src/components/`). Disable them while the value is `null` or the patch is syncing. The number follows the drag; release flushes through the session. GP-5 shows no BPM control. Controller must not send raw MIDI. Verify `npx tsc -b --pretty false` typechecks `src/features/controller/`
- [ ] 3.2 Use the same controls on USB and Bluetooth. A volume or GP-50 BPM edit that differs from the baseline enables the existing emerald Save; restoring that value disables Save when the rest of the patch matches. Verify `npx tsc -b --pretty false` typechecks `PatchBar` and `ControllerPage`

## 4. Docs and check

- [ ] 4.1 Update `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md`: patch-bar volume is CC 7, GP-50 BPM is CC 73/74, inbound volume/BPM stay unapplied, and family `1142` stays the upload path. Verify `openspec/config.yaml` still parses as YAML and the architecture file still forbids copied SysEx and USB duplex knobs
- [ ] 4.2 Run `npx tsc -b --pretty false` and fix type errors from this change
