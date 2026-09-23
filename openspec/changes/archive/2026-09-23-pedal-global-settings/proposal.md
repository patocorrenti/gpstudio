## Why

Global settings change the whole pedal and stay put when the patch changes. The GP-5 and GP-50 manuals do not list the same menu, and the published MIDI CC charts cover almost none of it. Controller can edit the current patch, but it has no place for the device-wide values that the pedal stores on their own, without Save.

## What Changes

- Record the manual menus and the MIDI reachability cut in this change’s design. A control appears in the modal only when that model’s manual lists it and a read plus a write path is locked. Items with no MIDI path are documented and omitted.
- When a pedal is connected, Controller offers an English control that opens a **Global settings** modal. It is not a route and not a main-menu item. Disconnect closes it. The modal lists only the connected model’s reachable settings. There is no Save: each edit is sent immediately through `DeviceSession` and does not mark the working patch `modified`. React does not send raw MIDI.
- **GP-50** (reachable): input level, No CAB, REC level, BT REC, monitor level, REC mode left/right, footswitch mode (Patch | Stomp), and master volume. Master volume is the panel knob (official CC 1), not a row in the pedal’s GLOBAL menu; `docs/architecture.md` already keeps it off the patch bar. Footswitch mode is the GLOBAL menu’s Patch | Stomp (official CC 28). The level, No CAB, and REC-mode values are not in the CC chart; they use a Patone-owned parameter-write of the same SET family the session already sends (path `01 01 04`, CRC-8 + nibble-expand). Read them from a globals dump requested once per connect. Do not paste the third-party editor.
- **GP-5**: the manual’s shared rows (input level, No CAB, REC level, BT REC, monitor level) use the same ranges, but the GP-5 MIDI list publishes none of them and the local reference editor is the GP-50 build. Do not send the GP-50 global payload to a GP-5. Show a GP-5 control only after that model accepts the same read and write. Until then the GP-5 session has no Global settings control.
- Writes go out on USB and Bluetooth. USB stays one-way for live knobs: do not apply inbound global reports on USB. On Bluetooth, apply inbound reports for the in-scope fields so the open modal follows the pedal. The connect loading state does not wait for the globals dump.

## Non-goals

- Pedal GLOBAL rows with no published CC and no locked read/write: GP-50 expression-pedal calibration, analog/DSP bypass, EXP/FS jack mode and external footswitch assign, display sleep and brightness, MIDI input source and channels, Auto CAB match, factory reset, and firmware About; GP-5 footswitch modes `0-99` / `0-9` / `A-Z` / `CTL` / `Tuner` (not Patch | Stomp), language, factory reset, and firmware About.
- Tuner, looper, drum machine, and the unused relative step CCs (17, 19, 21).
- Patch volume, patch BPM, chain edits, and stomp-module assignment. Those stay on the patch and still use Save. The paused stomp-assignment lab is unchanged.
- Library browse/import, IR/NAM file upload, the Editor route, copied third-party SysEx, or mobile packaging (`docs/architecture.md`).

## Capabilities

### New Capabilities

- None. This extends the connected session and Controller. It does not add a spec domain.

### Modified Capabilities

- `live-controller`: Connected Controller can open a model-specific Global settings modal. Edits apply immediately and do not use patch Save. GP-5 shows the control only for settings whose wire is confirmed on a GP-5.
- `device-connection`: The session requests a globals snapshot once per connect, exposes the reachable values, and sends their writes without setting patch `modified` or recalling a patch. Bluetooth may apply inbound reports for those fields; USB must not.

## Impact

- `src/features/controller/`: English opener and modal. No raw MIDI.
- `src/device/session/` and a small owned globals codec next to the existing parameter-write codecs: dump request/decode, immediate writes, snapshot fields that stay outside the patch baseline.
- `src/device/cc.ts`: GP-50 master volume (CC 1) and Patch | Stomp (CC 28) become live writes. Relative steps stay unused.
- `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md`: global settings that MIDI can reach are in scope; the omitted menu rows stay out; USB still does not apply live inbound globals.
