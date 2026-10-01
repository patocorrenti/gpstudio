
<img src="src/assets/img/gp-studio-logo.svg" alt="GP Studio" width="120" />

<a href="https://gpstudio.patocorrenti.com">
  <img src="src/assets/img/try-gp-studio.svg" alt="Try GP Studio, it's free!" />
</a>


## What is GP Studio?

GP Studio is an independent controller for the Valeton GP-5 and GP-50 multi-effects processors.

I built it because I wanted a proper desktop workflow: every control on screen at once, with instant connection over USB or Bluetooth.

I put a lot of care and ❤️ into the small details.  

It’s open source, and I hope other people will find it useful, contribute to it, and help extend support to more models and platforms.

The app is available at [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com).

## Supported devices

- **Valeton GP-5** — USB and Bluetooth
- **Valeton GP-50** — USB and Bluetooth

## Features

- Quick connection over USB or Bluetooth, with remembered pedals and preferences
- Full control of patches and modules at once, in real time
- GP-5 ↔ GP-50 preset compatibility — export presets from one model to the other
- Control the pedal footswitches from the app
- Runs in the browser, with a desktop version in development

## Installation

### Web app

Use the official app at [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com).

Tested in **Google Chrome**. USB and Bluetooth need a Chromium-based browser with Web MIDI / Web Bluetooth support.

### Desktop

Official desktop builds are not distributed yet. A [Tauri](https://tauri.app/) shell is in this repository and can be compiled locally (see [Development](#development)). Builds for Windows, macOS, and Linux are planned.

## Screenshots

Connect — USB / Bluetooth:

![Connect](src/assets/img/screenshots/gpstudio-connect.jpg)

Controller — full desktop workflow:

![Controller](src/assets/img/screenshots/gp-studio-dashboard.jpg)

Mobile layout:

![Mobile](src/assets/img/screenshots/gp-studio-mobile.jpg)

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

### Desktop shell (optional)

The [Tauri](https://tauri.app/) shell is not an official release. To run it locally you also need a Rust toolchain and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform:

```bash
npm run tauri dev
```

## Contributing

Bug reports and contribution guidelines are in [CONTRIBUTING.md](CONTRIBUTING.md).

External code contributions are not open yet. For security vulnerabilities, see[SECURITY.md](SECURITY.md).

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 [Patricio Correnti](https://patocorrenti.com).

## Trademark notice

Valeton, GP-5, and GP-50 are trademarks of their respective owners. Use of these names is for identification only and does not imply any endorsement.

## Non-affiliation notice

GP Studio is an independent project. It is not affiliated with, endorsed by, or sponsored by Valeton.