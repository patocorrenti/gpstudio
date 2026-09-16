## Why

Official MIDI CC can change a patch but cannot read which preset is loaded or what is inside it. The pedal already emits a chunked SysEx dump when a patch is loaded; without decoding that dump, Controller stays blind. This is the first slice of phase-2 SysEx (`docs/architecture.md`), not a phase-1 CC change.

## What Changes

- Decode the inbound USB SysEx dump from our own captures (header frames + 27 data chunks, nibble-encoded). Do not copy third-party editor code.
- When a complete dump arrives, `DeviceSession` updates the current preset snapshot (slot 00–99, then name and module on/off as fields are mapped).
- Controller shows that snapshot after a dump. Connecting still must not send CC 0 just to guess.
- On connect, send a dump-request SysEx once that request is identified from captures (Log page). Until then, the first hardware (or app) patch load fills the snapshot.
- Web MIDI must request SysEx so dumps are not dropped. Desktop `midir` already delivers them.
- Work in small steps: framing → slot → request-on-connect → name → modules.

## Non-goals

- Preset editor UI, write/rename/reorder, library, IRs/NAM, Bluetooth, mobile (`docs/architecture.md`).
- Copying reverse-engineered SysEx from third-party editors.
- Live USB updates when the user toggles effects on the pedal without a dump (the pedal does not send those).
- Volume / tuner / GP-50 extras (still later `live-controller` CC work).

## Capabilities

### New Capabilities

- `sysex-preset-sync`: Decode the pedal's USB SysEx preset dump, apply it to the session, optionally request a dump on connect, and show dump-derived patch state on Controller.

### Modified Capabilities

- `midi-transport`: Web MIDI must request SysEx access so inbound dump bytes reach subscribers. Desktop already forwards all bytes.

## Impact

- New `src/device/sysex/` assembler + decoder documented from Patone captures.
- `DeviceSession` consumes complete dumps; Controller reads the snapshot (no raw MIDI in React).
- Log page stays the capture tool. Web `requestMIDIAccess({ sysex: true })` (already in place for the pilot) becomes required behavior.
- No new MIDI backends, HTTP, or Tauri commands.
