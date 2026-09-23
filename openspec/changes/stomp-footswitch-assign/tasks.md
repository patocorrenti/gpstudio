## 1. Architecture and context

- [ ] 1.1 Update `docs/architecture.md` so current-preset dump decode includes stomp assignment (1 stomp GP-5, 2 GP-50; NR…NS only, not EXP), assignment write (`114d` family) is in scope on USB and Bluetooth, and the out-of-scope list no longer parks assignment as “paused only” (keep the old lab path as failed-envelope notes). Verify the file still forbids pasted reference SysEx and USB duplex knobs.
- [ ] 1.2 Update `docs/protocol-references.md` with the behavioral `114d` note (per-effect footswitch/effect/0|1; GP-5 footswitch fixed 0; dump offsets; live `0D` is notify-only) and point product work at this change. Verify it still says do not paste reference source.
- [ ] 1.3 Mirror in-scope assignment in `openspec/config.yaml` context/rules (read from existing dump; USB must not apply unsolicited assignment reports) and verify the file still parses as YAML.

## 2. Decode

- [ ] 2.1 Add dump decode for GP-50 stomps at 1006/1014 (enable-style nibbles; EXP never present) and verify a fixture or unit test: PRE on stomp 1 and MOD+DLY on stomp 2 round-trips; chain order/on/off still parse.
- [ ] 2.2 Add dump decode for GP-5 single stomp at 920 and verify a fixture or unit test includes multi-module assignment (e.g. MOD+DLY) and leaves order/on/off intact.

## 3. Encode and session

- [ ] 3.1 Implement Patone-owned `114d` SET encoder (path `01 01 04`, CRC-8 ATM + nibble-expand; CTL effect map with NS=9; GP-5 footswitch 0; GP-50 0|1). Verify encoded packed family bytes match the design body shape (no copied hex strings from reference HTML) and Bluetooth wrap uses the existing link encoder as one write.
- [ ] 3.2 Add snapshot `stomps` (length 1 / 2 by model), fill from dump apply, and verify a missing dump leaves empty lists and sends no assignment write.
- [ ] 3.3 Implement assignment edit on the session façade: optimistic snapshot update, send `114d` on USB and Bluetooth, no `chainSync` overlay / no extra recall or dump solely for the edit, and verify order/on/off are unchanged. Do not retry spike W1–W3 / H7 envelopes.
- [ ] 3.4 When `liveFromPedal` is false (USB), ignore unsolicited inbound assignment reports. Optionally decode Bluetooth live `0D` into `stomps` only after the SET is known to work; until then dumps remain source of truth. Verify USB does not apply a synthetic `0D`.

## 4. Controller

- [ ] 4.1 Add feature UI under `src/features/controller/` showing one stomp (GP-5) or two (GP-50) from the snapshot, listing NR…NS (never EXP), sending assign/clear only through the session. Verify the busy overlay still appears only while `chainSync` is `syncing`, and disconnect hides the UI.

## 5. Check and operator confirm

- [ ] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change.
- [ ] 5.2 Operator: on USB, assign/clear DST on GP-50 stomp 1; confirm Log shows the Patone `114d` frame and a subsequent dump matches 1006/1014. Then Bluetooth; then GP-5 at 920. Record pass/fail in a short note under this change folder if anything needs a follow-up refine (do not invent a new family without a capture).
