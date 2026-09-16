## 1. Architecture

- [ ] 1.1 Replace “Bluetooth tab is not available yet / no GATT” in `docs/architecture.md` with a connectable Valeton Suite GATT backend (not `MidiTransport`), control encoding later, no copied third-party SysEx, and verify the Connect and MIDI sections no longer forbid the scan
- [ ] 1.2 Mirror that in `openspec/config.yaml` context/rules (GATT backend is in scope here; still no copied SysEx) and verify the file still parses as YAML

## 2. Bluetooth link

- [ ] 2.1 Add a `BluetoothLink` contract (`discover` / `open` / `close`, no `send`) and widen session endpoints with `kind: "bluetooth"` beside `src/midi/`, and verify `MidiTransport` / `EndpointKind` for USB stay `usb-midi` only
- [ ] 2.2 Implement the web backend with Web Bluetooth, filter advertised names (GP-50 before GP-5, plus Valeton-looking names), English error when the API is missing, and verify no `BluetoothDevice` type leaks above that backend
- [ ] 2.3 Implement the desktop backend with native BLE (`btleplug`) behind new Tauri commands (scan / open / close) and a permission allow-list separate from `allow-midi`, and verify existing `midi_*` commands and USB listing are unchanged

## 3. Session

- [ ] 3.1 Branch `DeviceSession.connect` on endpoint kind so Bluetooth opens GATT, sets `linkMode: "bluetooth"`, and does not open USB-MIDI, and verify the USB `connect()` path still sets `linkMode: "usb"`
- [ ] 3.2 Add `commandToPedal` to `capabilitiesForLink` (true on USB, false on Bluetooth) and refuse `setPatch` / `stepPatch` when it is false, and verify USB `setPatch` still sends official CC 0

## 4. Connect modal

- [ ] 4.1 On the Bluetooth tab, scan / list / refresh / empty / English error, drop “Bluetooth is not available yet”, keep two-way/slower copy, and verify that tab never lists USB-MIDI ports
- [ ] 4.2 Reuse model confirm for Bluetooth, connect with `linkMode: "bluetooth"`, show Bluetooth link + Disconnect when connected, and verify Disconnect closes the GATT link and the chrome reads Connect again

## 5. Controller

- [ ] 5.1 When `linkMode` is Bluetooth, do not offer working patch previous / select / next, and verify the USB connected patch bar still sends CC 0 through the session

## 6. Check

- [ ] 6.1 Run `npx tsc -b --pretty false` and fix type errors from this change
