## 1. Architecture

- [x] 1.1 Update `docs/architecture.md` so `BluetoothLink` is `discover` / `open` / `send` / `close`, this patch encoder is in scope, and third-party SysEx copies stay forbidden, and verify Connect / Bluetooth sections no longer say the encoder is later-only
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (`BluetoothLink` includes real `send`; this encoder is allowed; still no copied SysEx) and verify the file still parses as YAML

## 2. Desktop GATT map

- [x] 2.1 After a successful `ble_open` connect, discover GATT services and log each service/characteristic UUID plus properties (read / write / write-without-response / notify) in the desktop debug log, and verify `tauri dev` prints that map when a GP-5 or GP-50 is connected
- [x] 2.2 From that Patone log (and Valeton Suite BLE traffic only if a writable control characteristic is still unclear), add a shared control service/characteristic UUID constant used by Rust and TypeScript, and verify no UUID is taken from a third-party editor
  - Patone Chrome 2026-09-17: BLE-MIDI service + I/O characteristic `7772e5db-…` `[read, write-without-response, notify]`. Constants in `src/bluetooth/uuids.ts` and `src-tauri/src/ble.rs`.

## 3. Bluetooth send

- [x] 3.1 Add `send(bytes)` to the `BluetoothLink` contract so send with no open session fails, and verify `npx tsc -b --pretty false` typechecks callers
- [x] 3.2 Implement desktop `ble_send`, bind the control characteristic in `ble_open`, allow the command in the BLE permission list, and verify existing `midi_*` commands still compile and USB listing is unchanged
- [x] 3.3 Implement web `send` with the documented UUID in `optionalServices`, bind the characteristic on `open`, write bytes without leaking `BluetoothDevice` above the backend, and verify send fails after `close` with an English error

## 4. Session

- [x] 4.1 Add a device-layer `encodePatch(linkMode, patch)` that currently returns official CC 0 (`[0xB0, 0, patch]`) for both USB and Bluetooth, and verify USB `setPatch` still sends that frame through `MidiTransport`
- [x] 4.2 Set `commandToPedal` true for Bluetooth, route `setPatch` / `stepPatch` to `bluetooth.send` on that link, and verify connecting over Bluetooth still does not send a patch by itself

## 5. Controller

- [x] 5.1 Show the same patch previous / select / next bar on a Bluetooth session as on USB (drop the “not available over Bluetooth yet” copy), and verify the USB connected patch bar still sends through the device session

## 6. Frame fallback

- [x] 6.1 If writing CC 0 over GATT does not change the pedal patch, replace only the Bluetooth branch of `encodePatch` using Patone and/or Valeton Suite captures, and verify the USB encode path is still official CC 0
  - Patone listed BLE-MIDI I/O, so Bluetooth `encodePatch` wraps official CC 0 in an MMA BLE-MIDI packet. USB remains `[0xB0, 0, patch]`.

## 7. Check

- [x] 7.1 Run `npx tsc -b --pretty false` and fix type errors from this change
