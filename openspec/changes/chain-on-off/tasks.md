## 1. Architecture and context

- [ ] 1.1 Update `docs/architecture.md` so Controller module on/off (official CC 48–57) is in scope on USB and Bluetooth, Bluetooth `liveFromPedal` applies inbound module CC 48–57, USB stays one-way for those controls, drag-and-drop and other live knobs stay later, and verify the out-of-scope list still forbids copied SysEx and USB duplex knobs
- [ ] 1.2 Mirror that in `openspec/config.yaml` context and rules (module on/off writes allowed; Bluetooth inbound CC 48–57 allowed; USB must not apply those CCs; drag-and-drop still later) and verify the file still parses as YAML

## 2. Encode

- [ ] 2.1 Add `encodeModule` (or equivalent) that maps NR…RVB to official CC 48–57 with the manuals' off/on values, wrap Bluetooth as BLE-MIDI like CC 0, and verify USB vs Bluetooth only differ by that wrap
- [ ] 2.2 Keep `encodePatch` as official CC 0 and verify toggling a module does not encode SysEx or CC 0

## 3. Session

- [ ] 3.1 Add a session toggle for an effect slot that flips `chain[].enabled` on-change, sends that module CC on the open link, does not change order, does not send a chain dump or extra patch recall, no-ops EXP, and verify `npx tsc -b --pretty false` typechecks callers
- [ ] 3.2 When `liveFromPedal` is true, apply inbound CC 48–57 to the matching slot's on/off without changing order, even when Log is off, and verify opening Controller does not grow the Log buffer
- [ ] 3.3 When `liveFromPedal` is false (USB), ignore inbound CC 48–57 and other non-module live CCs, and verify a chain dump still updates order + on/off as before

## 4. Controller

- [ ] 4.1 When `ready` and the chain is not covered by the busy overlay, make NR…RVB slots toggles through the session (same row on USB and Bluetooth) and verify activating DST/AMP updates the shown on/off without sending raw MIDI from React
- [ ] 4.2 Keep GP-50 EXP display-only and verify activating EXP does not send MIDI or change its on/off
- [ ] 4.3 Keep the English busy overlay over the chain body while `chainSync` is `syncing` and verify those slots cannot be used until the overlay clears

## 5. Check

- [ ] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
