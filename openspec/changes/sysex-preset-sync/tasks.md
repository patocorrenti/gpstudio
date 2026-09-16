## 1. SysEx on the wire

- [ ] 1.1 Make web MIDI require SysEx (no silent `sysex: false` fallback) and show an English error if denied; verify `src/midi/web.ts` calls `requestMIDIAccess({ sysex: true })` and `npx tsc -b --pretty false` passes
- [ ] 1.2 Confirm desktop still forwards SysEx (`Ignore::None` in `src-tauri/src/midi.rs`) so dump bytes reach `midi-inbound`

## 2. Dump assembler

- [ ] 2.1 Store the 2026-09-16 inbound dump as a hex fixture under `src/device/sysex/` and verify the file lists the 22-byte, 18-byte, and 27 × 48-byte frames
- [ ] 2.2 Implement nibble-decode + indexed chunk reassembly from that framing and verify a unit test (node:test or vitest) reports a complete dump from the fixture
- [ ] 2.3 Reject truncated input and verify a unit test with a missing chunk does not yield a complete dump
- [ ] 2.4 Raise the MIDI Log ring buffer above one full dump (at least 64 events) and verify `INBOUND_LIMIT` in `src/device/session.ts`

## 3. Unread snapshot

- [ ] 3.1 Put connected session preset in `unread` on connect (still no CC 0) and verify `connect()` does not call `transport.send`
- [ ] 3.2 Show an unread patch state on Controller instead of fake `00` and verify the selector is not labeled `00` until a dump is applied

## 4. Slot from dump

- [ ] 4.1 Capture two different patch loads in Log, diff them, and record the slot offset in `src/device/sysex/` protocol notes
- [ ] 4.2 Decode the slot into the session and show it on Controller; verify the fixture test maps a known slot and `npx tsc -b --pretty false` passes

## 5. Dump request on connect

- [ ] 5.1 Using Log only (no third-party source), identify a dump-request SysEx or record that none was found
- [ ] 5.2 If a request is known, send it on connect and verify `connect()` sends those bytes; if none, leave unread until the next dump and do not send CC 0

## 6. Name and modules

- [ ] 6.1 Diff dumps for the preset name, map the field, and show it in the Controller selector; verify a fixture test plus `tsc`
- [ ] 6.2 Diff dumps for module on/off, map the fields, and show those states on Controller (read-only until later CC toggles); verify a fixture test plus `tsc`

## 7. Check

- [ ] 7.1 Run `npx tsc -b --pretty false` and fix type errors from this change
