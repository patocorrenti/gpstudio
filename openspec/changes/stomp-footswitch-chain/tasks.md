## 1. Architecture and context

- [x] 1.1 Update `docs/architecture.md` so Bluetooth Stomp-mode footswitch module on/off is in scope as `liveFromPedal` (same class as live-module SysEx), USB stays one-way for those controls, Patch/Stomp UI and other knobs stay later, and verify the out-of-scope list still forbids copied SysEx and USB duplex knobs
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (Bluetooth stomp-originated chain on/off allowed; USB must not apply those reports; Patch/Stomp control still later) and verify the file still parses as YAML

## 2. Decode

- [x] 2.1 Keep or extend `decodeLiveModule` / `decodeLiveExp` from a Patone Bluetooth stomp capture (Log; no third-party source) so a Stomp footswitch that changes module on/off decodes to the matching slot(s), and verify command `09` / `02` still decode if that is what the capture is
- [x] 2.2 Tighten `IdentityDecoder` so a live-module or stomp on/off frame does not emit `patch-changed`, and verify a real pedal-initiated patch report still does
- [x] 2.3 If one captured stomp SysEx carries more than one module, decode every reported on/off from that message, and verify sequential single-module reports still apply one slot each

## 3. Session

- [x] 3.1 In `handleInbound`, apply live-module/EXP before identity and skip identity for that message when a module or EXP on/off was applied, and verify `npx tsc -b --pretty false` typechecks callers
- [x] 3.2 When `liveFromPedal` is true, a Stomp footswitch report updates matching `chain[].enabled` without changing order, without changing `patch`, without `refreshChain` / `chainSync: "syncing"`, and without sending MIDI, even when Log is off
- [x] 3.3 When `liveFromPedal` is false (USB), ignore stomp and live-module reports, and verify a chain dump and a pedal patch-changed report still refresh the chain as before
- [x] 3.4 Apply every inbound stomp/live-module report in a burst (several modules from one press) and verify no extra patch recall or chain dump is sent solely because those reports arrived

## 4. Controller

- [x] 4.1 Leave the chain row bound to the snapshot (no Patch/Stomp control, no new MIDI from React) and verify the busy overlay still appears only while `chainSync` is `syncing`, not solely because a Bluetooth stomp updated on/off

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
