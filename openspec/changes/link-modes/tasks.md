## 1. Architecture

- [ ] 1.1 Replace the “no USB/Bluetooth radio / BLE is the same contract” guidance in `docs/architecture.md` with asymmetric links (USB one-way fast, Bluetooth two-way slower, shared session, tabs in Connect) and verify the Connect and MidiTransport sections no longer forbid the tabs
- [ ] 1.2 Mirror that link model in `openspec/config.yaml` context/rules so later proposals are not told to skip Bluetooth UI and verify the file still parses as YAML

## 2. Session seam

- [ ] 2.1 Add `linkMode: "usb" | "bluetooth"` to the connected `SessionSnapshot` and set it to `"usb"` on the existing MIDI `connect()` path; verify callers typecheck with `npx tsc -b --pretty false`
- [ ] 2.2 Add a device-layer helper that maps `linkMode` to capabilities (`liveFromPedal` false on USB, true on Bluetooth) and verify TypeScript exports it for later UI without wiring new Controller controls

## 3. Connect modal

- [ ] 3.1 Add shadcn `Tabs` under `src/components/ui` and verify `src/components/ui/tabs.tsx` exists
- [ ] 3.2 Open Connect with USB and Bluetooth tabs, default USB, USB copy “one-way connection” and “super fast”, Bluetooth copy “two-way connection” and “slower”, and verify the old “Bluetooth is not supported yet” USB-only description is gone
- [ ] 3.3 Keep USB-MIDI discover / list / model confirm / refresh on the USB tab only and verify switching to Bluetooth does not call `discover` and does not list MIDI ports
- [ ] 3.4 On the Bluetooth tab show English “Bluetooth is not available yet” with no connect action and verify the session stays disconnected
- [ ] 3.5 When connected over USB, show the device as a USB link in the Connect modal (still with Disconnect) and verify inbound MIDI still appends to the session log with no dump decoder

## 4. Check

- [ ] 4.1 Run `npx tsc -b --pretty false` and fix type errors from this change
