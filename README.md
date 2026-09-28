# GP Studio

Independent controller for Valeton GP-5 and GP-50 pedals. Connect over USB or Bluetooth to edit the current patch, the audio chain, and `.prst` files.

The official app is at [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com).

GP Studio is an independent project. It is not affiliated with, endorsed by, or sponsored by Valeton. Valeton, GP-5, and GP-50 are trademarks of their respective owners.

## Status

Version 0.4.0. The official app is [gpstudio.patocorrenti.com](https://gpstudio.patocorrenti.com). A [Tauri](https://tauri.app/) shell is in the repository and can be compiled locally; official desktop builds are not distributed.

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
