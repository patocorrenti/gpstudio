## Why

Connect-on-startup (“quick connect”) and the “Always connect this way, don't ask again” checkbox confuse users, and Bluetooth startup is unreliable on the web: silent `getDevices()` discovery often cannot reopen a pedal after power cycles or permission churn without the browser picker. Startup should be USB-only with clearer per-pedal controls, and web Bluetooth should connect as soon as the user accepts the browser picker.

## What Changes

- **BREAKING (behavior):** Startup pedal is USB-only. Bluetooth can no longer be the startup pedal. A stored Bluetooth startup choice is cleared and ignored on launch.
- Remove the disconnected-scan checkbox “Always connect this way, don't ask again”.
- On the USB tab list, each pedal row offers a “Connect on startup” control with a circular Zap toggle (on/off) instead of a favorite star; tooltip explains connect on app open.
- USB mode note copy becomes “Super responsive — Instant, stable connection.”
- On the web app, selecting the Bluetooth tab (and Scan again) opens the browser Bluetooth picker; choosing a pedal there connects immediately when the model is known (or after the existing model ask), without a second pick from the modal list.
- Desktop Bluetooth stays scan-then-list; remembered Bluetooth pedals remain listable, but without startup controls.
- Architecture / OpenSpec context wording that describes optional startup for any link is updated to match. About changelog waits for the next version bump.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `device-connection`: Startup pedal is USB-only with per-row “Connect on startup” UI; web Bluetooth picker connects on accept; USB copy and remembered/startup rules updated.

## Impact

- `src/features/connect/` (`ConnectionStatus`, `ScanPanel`, `EndpointList`): startup arming UI, launch resolve (USB only), web BLE pick → connect.
- `src/app/preferences.ts`: reject or clear `startup` when `link` is not `usb`; adjust asserts.
- `docs/architecture.md`, OpenSpec `context` Connect sentence if it still claims Bluetooth startup or web picker without connect. Not About changelog.
- Specs: `openspec/specs/device-connection/spec.md` (via this change’s delta). `bluetooth-link` unchanged (interactive discover still reports `selectedId`).

## Non-goals

- Reliable Bluetooth auto-connect without a user gesture / browser picker (not available on web Web Bluetooth).
- Removing remembered Bluetooth pedals or the desktop BLE scan list.
- Changing USB discovery, model ask, or connect toasts beyond startup-failure wording if needed for “startup” vs “favorite”.
- Mobile packaging or new transports.
