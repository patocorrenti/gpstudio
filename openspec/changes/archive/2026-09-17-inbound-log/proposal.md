## Why

Log today only records USB-MIDI, even though Bluetooth is the two-way link (`docs/architecture.md`). The session also keeps appending inbound events while the user is on Controller or elsewhere, which spends memory and re-renders for a screen nobody is watching. Bluetooth inbound Log is the dedicated follow-up called out in architecture; applying that traffic to the patch snapshot is not this change.

## What Changes

- `BluetoothLink` delivers inbound GATT notifications on an open session (web and desktop), same byte-pipe idea as USB `MidiTransport.subscribe`.
- BLE-MIDI framing is stripped so Log shows the same MIDI summaries as USB (CC, SysEx size, and so on). Dump *decode* (turning SysEx into preset state) stays later work.
- DeviceSession captures inbound MIDI into the Log buffer only while the Log page is mounted. Leaving Log stops capture and releases the buffer. Returning starts empty.
- The existing Log UI stays shared across USB and Bluetooth. No forked Log screens.
- USB opportunistic inbound (including patch-load dumps) still logs when Log is visible. It no longer accumulates when Log is not visible.
- Update `docs/architecture.md` and `openspec/config.yaml` so Bluetooth inbound Log is in scope; applying `liveFromPedal` to the snapshot stays out.

## Non-goals

- Applying pedal→app live state (`liveFromPedal`) to the patch snapshot, volume, or modules.
- Decoding SysEx dumps into presets, or copying reverse-engineered SysEx from third-party editors (`docs/architecture.md`).
- Folding Bluetooth into `MidiTransport`, treating the links as interchangeable, or changing USB/Bluetooth Connect tabs.
- Volume, module toggles, tuner, or other CCs over Bluetooth.
- Preset editor/library, IRs/NAM, mobile packaging.
- Changing how USB bytes are sent, or adding a persistent background log.

## Capabilities

### New Capabilities

- `inbound-log`: Log page records pedal→app MIDI only while that page is visible, for USB and Bluetooth, without applying that traffic to session state.

### Modified Capabilities

- `bluetooth-link`: An open GATT session MUST deliver inbound notification bytes to subscribers. Callers still MUST NOT see Web Bluetooth types. Open still MUST NOT send solely because the session connected.

## Impact

- `src/bluetooth/` (types, web, tauri) and `src-tauri/src/ble.rs`: notification listener, desktop `ble-inbound` event, shared BLE-MIDI unwrap.
- `DeviceSession`: capture arm/disarm from Log mount, Bluetooth subscribe, no snapshot mutation from inbound.
- `src/features/log/`: enable capture while mounted; same MIDI-in monitor for both links.
- `docs/architecture.md` and `openspec/config.yaml`: Bluetooth inbound Log in scope; snapshot apply still later.
