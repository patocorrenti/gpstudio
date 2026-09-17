## Why

A Bluetooth session can open Valeton Suite GATT but cannot change patches. Controller shows “not available yet” while USB already has previous / select / next 00–99 (`docs/architecture.md`). Users who connect over Bluetooth need that same patch bar now.

## What Changes

- Map the pedal’s control GATT channel from **our own captures**: Patone’s session (enumerate services/characteristics, trial writes) and, if needed, Bluetooth traffic from **Valeton Suite** (official app). Do not copy reverse-engineered SysEx from third-party editors (`docs/architecture.md`).
- First encoding attempt is the same official patch message USB already sends (MIDI CC 0, value 0–99, channel 1). If that does not move the pedal, iterate with frames from those captures. The encoder seam stays in `DeviceSession`; `BluetoothLink` stays a byte pipe (`docs/architecture.md`: if BLE cannot speak CC, CC vs SysEx is that seam).
- `BluetoothLink` gains outbound send on an open GATT session (web and desktop). Open discovers/selects the control characteristic; it is no longer connect-only.
- `commandToPedal` becomes true for Bluetooth. Controller shows the same patch bar as USB. `setPatch` / `stepPatch` write through the Bluetooth link instead of refusing.
- Update `docs/architecture.md` and `openspec/config.yaml` so this encoder is in scope (still no copied third-party SysEx). USB patch CC is unchanged.

## Non-goals

- Volume, module toggles, tuner, GP-50 extras, or any control beyond patch 00–99.
- Applying pedal→app live patch state (`liveFromPedal`). Snapshot stays optimistic `00` until the user selects or steps, same as USB.
- Copying SysEx or GATT framing from third-party editors.
- BLE-MIDI class profile, folding GATT into `MidiTransport`, A2DP, preset editor/library, IRs/NAM, mobile packaging.
- A permanent GATT browser UI. Capture dumps are for this change’s spike, not a product surface.
- Changing USB discovery, USB `connect()`, or USB patch CC 0.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `bluetooth-link`: An open GATT session can send control bytes to the pedal. Open still MUST NOT send solely because the session connected. Callers still MUST NOT see Web Bluetooth types.
- `device-connection`: A Bluetooth session MAY send patch recall through the device session. Controller MUST offer working patch previous / select / next over Bluetooth, matching USB. USB patch CC 0 is unchanged.

## Impact

- `src/bluetooth/` (types, web, tauri) and `src-tauri/src/ble.rs`: GATT service discovery, characteristic write, optional notify subscribe for captures; Web Bluetooth `optionalServices` once UUIDs are known.
- `DeviceSession.setPatch` / `stepPatch` route by `linkMode`; `capabilitiesForLink` sets `commandToPedal: true` on Bluetooth.
- `ControllerPage` drops the Bluetooth-disabled empty copy and shows the patch bar whenever `commandToPedal` is true.
- `docs/architecture.md` and `openspec/config.yaml`: encoder in scope; still forbid copied third-party SysEx.
