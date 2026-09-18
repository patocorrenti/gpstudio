## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so current-preset dump decode includes stomp assignment (1 stomp GP-5, 2 GP-50; NR…NS only, not EXP), assignment write is in scope on USB and Bluetooth, Patch/Stomp mode UI and full editor stay later, and verify the out-of-scope list still forbids copied SysEx and USB duplex knobs
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (stomp assignment read/write allowed from the existing dump; USB must not apply unsolicited assignment reports) and verify the file still parses as YAML

## 2. Decode (Patone dump capture)

- [x] 2.1 From two Patone current-preset dumps of the same patch (assignment changed on the pedal; Log; no third-party source), locate stomp assignment fields and decode GP-50 stomp 1 and stomp 2 as sets of NR…NS, and verify EXP is never included
- [ ] 2.2 Decode a GP-5 dump to a single stomp set, and verify a dump with two modules on one stomp (e.g. MOD+DLY) returns both
- [x] 2.3 Verify chain order and on/off still parse after the assignment fields are read (no clobber)

## 3. Session

- [x] 3.1 Add snapshot `stomps` (length 1 on GP-5, 2 on GP-50), fill it from the existing dump apply path, and verify a missing dump leaves empty lists and sends no assignment write
- [ ] 3.2 Implement assignment edit: snapshot updates on-change, a Patone-owned write is sent on USB and on Bluetooth, chain order/on/off and `chainSync` do not change, and no extra patch recall or chain dump is sent solely because of the edit
- [x] 3.3 When `liveFromPedal` is false (USB), ignore unsolicited inbound assignment reports, and verify a later chain dump still refreshes assignment from that dump
- [x] 3.4 If a Bluetooth live assignment notify is captured, apply it when `liveFromPedal` is true; if none is captured, leave dumps as the source of truth and verify `npx tsc -b --pretty false`

## 4. Controller

- [x] 4.1 Show one stomp on GP-5 and two on GP-50 from the snapshot, list assigned modules, omit EXP as a target, send edits only through the session, and verify the busy overlay still appears only while `chainSync` is `syncing`

## 5. Check

- [ ] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
