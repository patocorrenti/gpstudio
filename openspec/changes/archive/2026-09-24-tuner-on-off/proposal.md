## Why

Controller can already recall patches, toggle modules, and press stomps. The manuals publish Tuner On/Off as official CC 58 on both GP-5 and GP-50, and `gp5Cc.tuner` already names that controller, but the app never sends it. Users need to open and close the pedal's tuner from Controller without walking over to the unit.

## What Changes

- After the audio chain is shown, Controller MUST offer a Tuner control through the device session on USB and Bluetooth. React MUST NOT send raw MIDI.
- Entering the tuner MUST send official CC 58 with value 127. Leaving it MUST send CC 58 with value 0. The same 0–63 off / 64–127 on rule as module on/off applies when reading a value; writes use 0 and 127.
- The session MUST track whether the last app write put the tuner on or off so the control can show that state. Connect and disconnect MUST clear that state to off. The session MUST NOT apply inbound CC 58 (or any other tuner report) to the snapshot while the patch stays the same. The working patch MUST NOT become modified solely because of a tuner write. The session MUST NOT send patch recall or a chain dump solely because of a tuner write. Controller MUST NOT show the chain-refresh busy overlay solely because of a tuner write.
- This change does NOT draw a pitch / note display in the app. The pedal shows its own tuner UI.

## Non-goals

- Applying inbound tuner CC or drawing a tuner screen in Patone.
- Tap tempo, looper, drum machine, or other CCs near CC 58 in the manuals.
- Changing GP-5 footswitch mode to `Tuner` (`1115`) or GP-50 Patch|Stomp (CC 28).
- Library, IR/NAM upload, Editor route, mobile packaging.
- Copying reference-editor JavaScript into `src/`.

## Capabilities

### New Capabilities

- None. Tuner on/off is another official-CC slice of live-controller / device-connection.

### Modified Capabilities

- `live-controller`: After the chain is shown, Controller offers Tuner enter/exit through the device session on USB and Bluetooth, without a pitch display and without the chain-refresh overlay for that write alone.
- `device-connection`: A ready session sends CC 58 (127 on, 0 off), tracks the last app-written on/off for the UI, does not apply inbound CC 58, and does not mark the working patch modified or recall a patch for that write.

## Impact

- `src/device/encode.ts` and `src/device/session/`: encode and send CC 58; snapshot field for last app tuner state.
- `src/features/controller/`: Tuner control beside the existing pedal controls (feature sibling).
- `docs/architecture.md`, `docs/protocol-references.md`, `openspec/config.yaml`: tuner write (CC 58) in scope; inbound tuner still out.
