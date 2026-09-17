## Why

USB MIDI and the pedal's Bluetooth are not the same link. USB is fast and mostly outbound (the pedal dumps SysEx on patch load, not when knobs or module switches move); Bluetooth looks capable of a two-way session. Users need to pick the method and see those tradeoffs. The current Connect modal is USB-only and `docs/architecture.md` forbids a USB vs Bluetooth choice, treating both as one contract.

## What Changes

- **BREAKING** (product/architecture): drop “USB and Bluetooth are interchangeable; no radio in the modal.” Connect opens with USB and Bluetooth tabs. The user chooses the method first.
- USB tab keeps today’s USB-MIDI discover / connect / model confirm. Copy presents it as one-way and super fast.
- Bluetooth tab is selectable and explains two-way and slower. It does not scan or connect yet; it states that Bluetooth is not available yet.
- `DeviceSession` records the chosen link mode. Controller, Editor, and Library stay on one session. Later features that need pedal→app state disable themselves on USB instead of forking the UI.
- USB inbound MIDI (including patch-load dumps) stays on the existing pipe and Log. This change does not decode dumps or request them.
- Update `docs/architecture.md` so the three axes stay (model / protocol / link) but link is no longer “same backend later.”

## Non-goals

- Valeton Suite GATT / BLE scan, pair, or a throwing BLE transport stub (`docs/architecture.md`).
- Decoding USB SysEx dumps, dump-request on connect, or applying dumps to the Controller snapshot (later change).
- Preset editor, library, IRs/NAM, mobile packaging.
- Copying reverse-engineered SysEx from third-party editors.
- Hiding USB-only or Bluetooth-only controls that do not exist yet (volume, modules, names). This change adds the link-mode seam those features will use.

## Capabilities

### New Capabilities

- None. Link mode is part of connection, not a fourth spec domain.

### Modified Capabilities

- `device-connection`: Connect modal offers USB vs Bluetooth tabs with capability copy; USB discover stays on the USB tab; Bluetooth tab is not available yet; connected session exposes the chosen link mode.
- `app-shell`: The connection modal is a link-method chooser, not USB-MIDI-only copy.

## Impact

- `src/features/connect/ConnectionStatus.tsx` gains tabs and per-method copy; USB flow stays the current MIDI list.
- `src/device/session.ts` snapshot includes link mode (`usb` now; `bluetooth` when that backend exists).
- `src/midi/types.ts` may name the link on the endpoint; no new MIDI backend, Tauri command, or BLE crate.
- `docs/architecture.md` records the asymmetric links.
