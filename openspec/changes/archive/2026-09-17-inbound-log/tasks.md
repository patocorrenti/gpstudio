## 1. Architecture

- [x] 1.1 Update `docs/architecture.md` so Bluetooth inbound Log is in scope, `BluetoothLink` is `discover` / `open` / `send` / `subscribe` / `close`, and applying `liveFromPedal` to the snapshot stays later, and verify those sections no longer list inbound Log as out of scope
- [x] 1.2 Mirror that in `openspec/config.yaml` context and rules (`BluetoothLink` includes `subscribe`; inbound Log is allowed; snapshot apply still forbidden) and verify the file still parses as YAML

## 2. Bluetooth inbound pipe

- [x] 2.1 Add an MMA BLE-MIDI unwrap in `src/bluetooth/` that strips timestamps, handles running status, and reassembles SysEx across packets from the public packet format (not a third-party editor), and verify a wrapped CC 0 packet (`80 80 B0 00 nn`) yields the same MIDI bytes USB already logs
- [x] 2.2 Add `subscribe` to the `BluetoothLink` contract, have web listen to control-characteristic notifications, unwrap, and deliver MIDI bytes without leaking `BluetoothDevice` above the backend, and verify `npx tsc -b --pretty false` typechecks callers
- [x] 2.3 After desktop `ble_open` notify subscribe, emit `ble-inbound` from the notifications stream, abort that task on `ble_close`, listen and unwrap in `TauriBluetoothLink`, and verify `cargo check` in `src-tauri` still builds and USB `midi-inbound` is unchanged

## 3. Session capture

- [x] 3.1 Subscribe `DeviceSession` to Bluetooth inbound as well as USB, append to the log only while capture is on, never mutate `snapshot.patch` from inbound, and verify capture defaults to off so Controller does not grow the log
- [x] 3.2 Split snapshot listeners from log listeners so inbound log updates do not notify Connect chrome, and verify `useSessionSnapshot` still updates on connect, disconnect, and patch send
- [x] 3.3 Add `setInboundCapture`; disabling MUST clear the buffer and reset BLE-MIDI assembly; `useInboundLog` MUST subscribe to log listeners only; and verify `clearInboundLog` still empties the list while capture stays on

## 4. Log page

- [x] 4.1 Arm capture when `MidiInMonitor` mounts and disarm on unmount (still inside `RequirePedal`), keep the same USB/Bluetooth Log UI, and verify leaving `/log` leaves an empty log on return until new inbound arrives

## 5. Check

- [x] 5.1 Run `npx tsc -b --pretty false` and fix type errors from this change
