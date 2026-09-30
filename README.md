# GP Studio

## What is GP Studio?

GP Studio is an independent controller for Valeton GP-5 and GP-50 pedals.

I built it because I wanted a real desktop workflow — every control on screen at once, with instant connection over USB or Bluetooth.

The official app is at [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com).

I put a lot of care into the small details; this app was built with a lot of ❤️.
Hopefully more people will join in and we can extend support to more models and platforms.

## Supported devices

- **Valeton GP-5** — USB and Bluetooth
- **Valeton GP-50** — USB and Bluetooth

## Features

- Quick connect (remembers your pedals and preferences) over USB or Bluetooth
- Full control of patches and modules at once, in real time
- Transparent GP-5 ↔ GP-50 compatibility — export presets from one model to the other
- Control the pedal footswitches from the app
- Prepared to be compiled as a desktop application

## Status

Version 1.0.0-beta.1. The official app is [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com). A [Tauri](https://tauri.app/) shell is in the repository and can be compiled locally; official desktop builds are not distributed.

Current scope includes connecting a GP-5 or GP-50, live patch control, the current-patch audio chain (on/off, order, factory models, and knobs), save / rename / duplicate, Valeton `.prst` download and load for the connected model, global settings, stomp control, and following live pedal changes over Bluetooth.

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

The Tauri shell is optional and is not an official release. Building it locally also needs a Rust toolchain and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform:

```bash
npm run tauri dev
```

## License

[MIT](LICENSE). Copyright (c) 2026 Patricio Correnti.
