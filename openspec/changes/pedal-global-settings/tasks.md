## 1. Globals codec

- [ ] 1.1 Add a Patone-owned GP-50 globals request in `src/device/globals.ts` (identity-family envelope, size `0x0B`, path `01 02 01 00`, distinct from the name-list, current-patch, current-preset, and IR asks; USB bytes unwrapped, Bluetooth via the existing link wrap) and verify the two packets differ only by that wrap and that the source does not contain pasted `_reference/` JavaScript
- [ ] 1.2 Decode a globals dump into input level, No CAB, REC level, BT REC, monitor level, REC mode left/right, footswitch mode, and master volume. Lock offsets against a Patone log before any value becomes editable. If no log is available, fail open (every value unknown) and record that gap in `docs/protocol-references.md`. Verify a non-globals header is not treated as a chain dump
- [ ] 1.3 Encode the seven SysEx rows (input, No CAB, REC, BT REC, monitor, REC mode L, REC mode R) as packed `01 00 0a 11 11` plus the effect/flag table in `design.md`, CRC-8 ATM + nibble-expand, path `01 01 04`. Verify one packed body matches that table and is not a live-notify `01 02 04` message

## 2. Session

- [ ] 2.1 Add the globals snapshot on the session façade (unknown until a dump decodes), drop it on disconnect, and verify a later current-preset dump does not clear a loaded input level
- [ ] 2.2 After the current-preset ask on a GP-50 connect, send the globals request once without delaying identity or chain readiness. Do not send it on GP-5. Do not re-request it on Reload or patch change. Verify typecheck and that a GP-5 connect path has no GP-50 globals ask
- [ ] 2.3 Write master volume as official CC 1 (0–100) and footswitch mode as official CC 28 (Patch 0, Stomp 127). Write the SysEx rows through the owned SET. Throttle the level and master sliders (~80 ms, flush on release); send toggles and selects on change. Verify a master edit does not send CC 17, does not send patch recall, and does not mark the working patch modified
- [ ] 2.4 On Bluetooth, apply an inbound global report for an exposed field and leave `modified` unchanged. On USB, ignore that report. Verify a USB inbound master-volume report leaves the snapshot value as it was

## 3. Controller modal

- [ ] 3.1 Add an English Global settings control and modal under `src/features/controller/` (not `src/components/`). Show it with the patch bar on GP-50 only, including while the chain overlay is up. GP-5 shows no control while the session exposes no globals. The empty and identity-loading states show no control. Verify the modal is not a route and the main menu is unchanged
- [ ] 3.2 List only exposed GP-50 rows, in English, with no Save control. Disable a row whose value is unknown and do not send a write for it. Edits go through the session. Disconnect closes the modal. A patch change does not clear the shown globals. Verify typecheck

## 4. Docs and check

- [ ] 4.1 Update `docs/architecture.md` and `docs/protocol-references.md`: GP-50 master volume (CC 1), Patch | Stomp (CC 28), and the globals subset are in scope; omitted GLOBAL rows stay out; the globals ask is once per GP-50 connect and does not block sync; USB does not apply live inbound globals. Verify those files still forbid copying third-party SysEx and still treat USB and Bluetooth as different links
- [ ] 4.2 Mirror that in `openspec/config.yaml` context and verify the file still parses as YAML
- [ ] 4.3 Run `npx tsc -b --pretty false` and fix type errors from this change
