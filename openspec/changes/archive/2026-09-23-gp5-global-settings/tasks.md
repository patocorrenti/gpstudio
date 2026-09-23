## 1. GP-5 globals codec

- [x] 1.1 In `src/device/globals.ts`, classify and decode a GP-5 globals dump apart from the GP-50 dump. Bluetooth: command `00 01`, path `01 02 01`, F0 length 164, offsets in `design.md` (editor index minus 2). USB: command `00 05`, data length 48, terminator length 12, payload from byte 9, offsets minus 9. Decode global volume, input level, No CAB, REC level, BT REC, monitor level, screen brightness, and footswitch 0–4. A missing or out-of-range screen byte leaves only screen brightness unknown. An out-of-range required field does not apply the dump. Extend the module self-check and verify a GP-50 dump does not decode as GP-5, a GP-5 dump does not decode as GP-50, and a current-preset header does not classify as either
- [x] 1.2 Encode the GP-5 `1111` rows with the GP-5 effect/flag pairs in `design.md` (global volume 2/2, BT REC 5/4, monitor 2/4, screen brightness 3/2) and the footswitch body `01 00 04 11 15 00` plus the mode byte, CRC-8 + nibble-expand, path `01 01 04`. Verify a GP-5 BT REC body is not the GP-50 BT REC body (effect 2 / flag 4), global volume is not CC 1, and the footswitch body is not CC 28 and is not a 24-byte live notify
- [x] 1.3 Decode GP-5 Bluetooth live reports with the GP-5 map: the shared 24-byte notify, the length-30 global-volume notify, and the length-18 footswitch notify. Do not invent a live screen-brightness packet. Verify effect 2 / flag 4 is monitor level on GP-5 and BT REC on GP-50, and effect 5 / flag 4 is BT REC on GP-5 and not REC mode

## 2. Session

- [x] 2.1 On GP-5 connect, store an empty GP-5 globals value (fields unknown) instead of `null`, and keep the GP-50 shape unchanged. Drop globals on disconnect. Verify a later current-preset dump does not clear a loaded GP-5 input level, and a GP-5 snapshot does not expose master volume, REC mode, or Patch | Stomp
- [x] 2.2 Send the existing globals ask on GP-5 once per connect, after the first current-preset dump, not in that burst, and not on Reload or patch change. Verify the GP-5 ask bytes match the GP-50 ask and that typecheck still passes
- [x] 2.3 Write GP-5 global volume, levels, and screen brightness through the owned SETs, throttled (~80 ms, flush on release). Send No CAB and footswitch on change. Refuse a GP-50-only write on GP-5 and a GP-5-only write on GP-50. Verify a global-volume edit does not send CC 1, a footswitch edit does not send CC 28, and neither sends patch recall or marks the working patch modified
- [x] 2.4 On Bluetooth, apply a GP-5 live report with the GP-5 map and leave `modified` unchanged. On USB, ignore it. Verify a GP-5 monitor report does not change BT REC, and inbound CC 1 or CC 28 does not change GP-5 global volume or footswitch mode

## 3. Global settings modal

- [x] 3.1 When a GP-5 session exposes globals, show the existing English Global control beside the connection status, including while chain sync is up. Keep it out of the main menu, the patch bar, and any route. Verify a disconnected session still hides the control
- [x] 3.2 In `src/features/connect/GlobalSettingsModal.tsx`, list only the GP-5 rows: Global volume first, then input level, No CAB, REC level, BT REC, monitor level, screen brightness (1–100), and footswitch (`0-99`, `0-9`, `A-Z`, `CTL`, `Tuner`). No Save, no master volume, no REC mode, no Patch | Stomp, no Global BPM. A null value stays disabled and sends nothing. Edits go through the session. Disconnect closes the modal. A patch change does not clear the shown values. Verify typecheck

## 4. Docs and check

- [x] 4.1 Update `docs/architecture.md` and `docs/protocol-references.md`: GP-5 sends the shared globals ask once per connect; the rows and writes in `design.md` are in scope; REC mode, CC 1, CC 28, and Global BPM stay out on GP-5; USB does not apply live inbound globals. Verify those files still forbid pasting third-party SysEx and still treat USB and Bluetooth as different links
- [x] 4.2 Mirror that in `openspec/config.yaml` context and verify the file still parses as YAML
- [x] 4.3 Run `npx tsc -b --pretty false` and fix type errors from this change
