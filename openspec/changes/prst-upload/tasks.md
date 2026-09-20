## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so current-patch `.prst` import onto the selected slot is in-scope Controller upload (GP-50 file → GP-50 session, GP-5 file → GP-5 session; working-buffer writes plus store `114a`; no extra recall), Library import of `.prst` stays later, and verify the out-of-scope list still forbids copied SysEx, IRs/NAM, USB duplex knobs, and cross-model conversion
- [x] 1.2 Mirror that in `openspec/config.yaml` (current-patch `.prst` import onto the selected slot allowed; still no Library import and no copied SysEx), and verify the file still parses as YAML
- [x] 1.3 Note in `docs/protocol-references.md` that upload is the inverse of the locked `.prst` layout (header, CRC-8 ATM, name, descriptor, dump body) applied with owned writes then `114a` onto the current slot, not a dump SET, and verify the file still forbids copying `reference/` source

## 2. Decoder

- [x] 2.1 Add `decodePrstFile` in `src/device/patch-store.ts` as the inverse of `encodePrstFile` (connected-model header, CRC-8 ATM, spacer, NUL name, descriptor, dump body expanded at the encode offsets) without pasting `reference/` JavaScript, and verify decode of `_reference/gp50_60-TOB.prst` / `_reference/gp5_60-TOB.prst` round-trips through encode to those same bytes
- [x] 2.2 Reject short files, bad CRC, unknown headers, and the other model's length as `null`, and verify a GP-50 capture does not decode as GP-5 and a truncated buffer does not invent a dump
- [x] 2.3 Copy descriptor volume/BPM into the dump word slots the encoder already maps, and verify the TOB round-trip still matches those capture fields

## 3. Session

- [x] 3.1 Add `uploadCurrentPatch(bytes)` on `DeviceSession` that returns `{ ok: true }` or `{ ok: false, reason }`, no-ops when disconnected / not ready / `chainSync` is syncing, does not require a held dump, and verify wrong-model and invalid bytes return without sending MIDI
- [x] 3.2 Apply a valid file with a session-private path (not public `setSlotModel`): factory-known model `1147` and flushed catalog-control `1148`, chain-order SET, module CC 48–57, no store `114a`, USB vs Bluetooth differing only by the existing BLE-MIDI wrap, and verify no extra patch recall is sent solely because upload ran
- [x] 3.3 After those writes, re-request the current-preset dump with the existing `chainSync` gate, leave EXP unchanged, and verify `npx tsc -b --pretty false` typechecks
- [x] 3.4 If a Patone capture (or a black-box reference `sendPatchVol` / `sendBPM`) locks packed family `1142`, send descriptor volume/BPM as part of apply; if that SET is ignored, keep chain+store, note it in `docs/protocol-references.md`, and verify the rest of upload still typechecks

## 4. Controller

- [x] 4.1 Add an English Upload control on `PatchBar` beside Download, gated on the same busy flag as Save (not on `canExportPatch`), hidden `<input type="file" accept=".prst">` with no new Tauri command, and verify Controller still sends no raw MIDI
- [x] 4.2 After a valid file is chosen, show a confirmation Dialog that this will load into the current working patch (name the current slot; Save stores later); Cancel sends nothing; confirm calls `uploadCurrentPatch`, and verify the Dialog copy is English
- [x] 4.3 After an invalid or wrong-model file is chosen, show an English error Dialog and do not confirm or call upload, and verify `npx tsc -b --pretty false` typechecks

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
