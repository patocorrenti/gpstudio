## Why

The Connect Bluetooth tab is a chooser with “not available yet.” Users need to scan and open a Valeton Suite GATT session the same way they pick a USB pedal (`docs/architecture.md`). Patch/CC over Bluetooth is a later encoder; this change only makes the link.

## What Changes

- **BREAKING** (Connect): drop “Bluetooth is not available yet.” The Bluetooth tab scans nearby pedals, lists them, and connects. It still MUST NOT list USB-MIDI ports.
- Bluetooth discovery and GATT open/close are a separate backend from USB `MidiTransport` (`docs/architecture.md`: not another `usb-midi` kind).
- `DeviceSession.connect` on that path sets `linkMode: "bluetooth"`. Disconnect closes the GATT link. USB-MIDI connect is unchanged.
- Until a Bluetooth control encoder exists, a Bluetooth session MUST NOT send MIDI CC or SysEx. Controller MUST NOT treat patch previous/select/next as working on that link.
- Update `docs/architecture.md` so the Bluetooth tab is connectable and GATT is in scope for this backend (still no copied third-party SysEx).

## Non-goals

- Encoding patch/volume/modules over Bluetooth (SysEx or CC). Patch selector over Bluetooth is a later change.
- Copying reverse-engineered SysEx from third-party editors (`docs/architecture.md`).
- BLE-MIDI class profile, A2DP audio, Valeton Suite clone, dump decode, preset editor/library, IRs/NAM, mobile packaging.
- Changing USB discovery, USB `connect()`, or USB patch CC 0.

## Capabilities

### New Capabilities

- `bluetooth-link`: Discover nearby GP-5/GP-50 Bluetooth peripherals, open one GATT session at a time, and close it. No control encoder.

### Modified Capabilities

- `device-connection`: Bluetooth tab scans and connects; connected session records Bluetooth link mode; outbound CC/SysEx stays USB-only until a later encoder change.

## Impact

- New Bluetooth backend beside `src/midi/` (web: Web Bluetooth; desktop: native BLE — WebView2 has no Web Bluetooth).
- `ConnectionStatus` Bluetooth tab: scan / list / model confirm / refresh / connect, parallel to USB.
- `DeviceSession` takes a Bluetooth connect path (`linkMode: "bluetooth"`) and refuses outbound CC on that path.
- Controller disables patch send while `linkMode` is Bluetooth.
- Tauri permissions/commands for BLE scan/connect; USB `midir` commands stay as they are.
- `docs/architecture.md` records the dedicated GATT backend.
