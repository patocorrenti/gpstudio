## Why

The Connect control is a placeholder modal. Users cannot list a USB pedal, pick GP-5 vs GP-50, or see a connected device name. This change lands the USB-MIDI transport and the global session so later live controls have a pedal to talk to.

## What Changes

- Add `MidiTransport` (endpoints + bytes, `kind: usb-midi`) with Web MIDI and Tauri/`midir` backends, as specified in `docs/architecture.md`. This change includes the planned `midi-transport` work because connection cannot ship without the byte pipe.
- Add `DeviceSession`: discover USB endpoints, open/close the link, remember the chosen GP-5 or GP-50 profile.
- Fill the existing Connect modal: request MIDI access, list USB devices, ask GP-5 vs GP-50 only when the port name does not suggest a model, then connect.
- When connected, the chrome control shows the device name instead of Connect. Opening it again offers disconnect.
- Suggest model from the USB MIDI label (match GP-50 before GP-5). Port name is not hardware identity.

## Non-goals

- Bluetooth / BLE (Valeton Suite GATT). No USB vs Bluetooth picker.
- Live controller CC UI (`live-controller`).
- SysEx, preset editor/library, IRs/NAM, mobile packaging.
- Copying reverse-engineered SysEx from third-party editors.

## Capabilities

### New Capabilities

- `midi-transport`: Discover USB-MIDI endpoints and send/receive raw MIDI bytes through Web MIDI or Tauri/`midir`.
- `device-connection`: Global pedal session and Connect modal: pick a USB device, resolve GP-5 vs GP-50, connect, show the device name, disconnect.

### Modified Capabilities

- `app-shell`: The connection-status control is no longer a MIDI-inert placeholder. Disconnected it still reads Connect and opens a modal; connected it shows the device name and the modal can connect or disconnect.

## Impact

- New TypeScript: `src/midi/` (`MidiTransport`, web + Tauri backends) and `src/device/` (models, official CC maps, session).
- `src/features/connect/` implements the modal against `DeviceSession`, not raw MIDI.
- Tauri: `midir`, commands `midi_list_ports` / `open` / `send` / `close`, inbound events, ACL permissions.
- New npm dependency: `@tauri-apps/api`.
- Web: Chrome/Edge Web MIDI on localhost or HTTPS. Desktop: Tauri WebView via `midir`.
