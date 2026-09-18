## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so current-preset dump decode includes stomp assignment (1 stomp GP-5, 2 GP-50; NR…NS only, not EXP), assignment write is in scope on USB and Bluetooth, Patch/Stomp mode UI and full editor stay later, and verify the out-of-scope list still forbids copied SysEx and USB duplex knobs
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (stomp assignment read/write allowed from the existing dump; USB must not apply unsolicited assignment reports) and verify the file still parses as YAML

## 2. Decode (Patone dump capture)

- [x] 2.1 From two Patone current-preset dumps of the same patch (assignment changed on the pedal; Log; no third-party source), locate stomp assignment fields and decode GP-50 stomp 1 and stomp 2 as sets of NR…NS, and verify EXP is never included
- [x] 2.2 Decode a GP-5 dump to a single stomp set, and verify a dump with two modules on one stomp (e.g. MOD+DLY) returns both
- [x] 2.3 Verify chain order and on/off still parse after the assignment fields are read (no clobber)

## 3. Session

- [x] 3.1 Add snapshot `stomps` (length 1 on GP-5, 2 on GP-50), fill it from the existing dump apply path, and verify a missing dump leaves empty lists and sends no assignment write
- [ ] 3.2 Implement assignment edit: snapshot updates on-change, a Patone-owned write is sent on USB and on Bluetooth **and the pedal accepts it**, chain order/on/off and `chainSync` do not change, and no extra patch recall or chain dump is sent solely because of the edit. Blocked on the write spike (`spike-assignment-write.md`). Snapshot+send path exists; pedal ignored W1–W3.
- [x] 3.3 When `liveFromPedal` is false (USB), ignore unsolicited inbound assignment reports, and verify a later chain dump still refreshes assignment from that dump
- [x] 3.4 Live `0D` notify is captured (Bluetooth, DST stomp 1/2). Do **not** apply it to the snapshot until a SET is accepted (`spike-assignment-write.md`). USB ignores it. Dumps stay the source of truth.

## 4. Controller

- [x] 4.1 Show one stomp on GP-5 and two on GP-50 from the snapshot, list assigned modules, omit EXP as a target, send edits only through the session, and verify the busy overlay still appears only while `chainSync` is `syncing`

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change

## 6. Write spike (USB first, one candidate per run)

- [x] 6.1 Record dump offsets, live `0D` notifies, and failed SET candidates W1–W3 in `spike-assignment-write.md` (do not retry those frames as-is)
- [x] 6.2 Parallel candidates on Controller **Write spike**: DST on/off Stomp 1 in each block. Operator: **none moved the pedal**. Recorded in `spike-assignment-write.md` (H1–H4 and the nine rows are dead).
- [x] 6.3 H7: Patone-owned per-effect SET (CRC-8 + nibble-expand, stomp index + effect index + 0/1) on the Write spike top card. Operator: **did not move the pedal** (USB and Bluetooth). Recorded in `spike-assignment-write.md`. Do not retry as-is.
- [ ] 6.4 If a candidate is accepted, confirm dump 1006/1014 still match, then Bluetooth, then GP-5 offset 920; only then close 3.2. Blocked: no accepted SET. Write spike panel was removed on pause (2026-09-18).

## 7. Pause (2026-09-18)

- [x] 7.1 Remove assignment UI, Write spike panel, snapshot `stomps`, and assignment/write-spike encoders from product code. Keep this change folder as the lab (`spike-assignment-write.md`).
- [x] 7.2 Point architecture / protocol-references at the paused lab. Do not archive this change until a SET is accepted.
