# GP Studio

Independent controller for Valeton GP-5 and GP-50 pedals. Connect over USB or Bluetooth to edit the current patch, the audio chain, and `.prst` files.

GP Studio is an independent project. It is not affiliated with, endorsed by, or sponsored by Valeton. Valeton, GP-5, and GP-50 are trademarks of their respective owners.

## Status

Version 0.3.1. The app runs in the browser and as a [Tauri](https://tauri.app/) desktop shell. The desktop installer targets today are Windows (NSIS and MSI).

Current scope includes connecting a GP-5 or GP-50, live patch control, the current-patch audio chain (on/off, order, factory models, and knobs), save / rename / duplicate, Valeton `.prst` download and load for the connected model, global settings, stomp control, and following live pedal changes over Bluetooth.

## Development

Requirements: Node.js and npm. The desktop shell also needs a Rust toolchain and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```bash
npm install
npm run dev
```

Desktop window:

```bash
npm run tauri dev
```

## License

[MIT](LICENSE). Copyright (c) 2026 Patricio Correnti.
