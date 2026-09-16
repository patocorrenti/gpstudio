## 1. Transport contract and model helpers

- [x] 1.1 Add `src/midi/types.ts` (`MidiEndpoint`, `MidiTransport`, `kind: usb-midi`) and `src/device/models.ts` (`gp5` | `gp50`, suggest-from-label matching GP-50 before GP-5). Verify `npm run build` typechecks those modules.
- [x] 1.2 Add official CC maps in `src/device/cc.ts` (data only, unused by UI). Verify GP-5 and GP-50 tables match the manuals cited in `docs/architecture.md`.

## 2. USB MIDI backends

- [x] 2.1 Implement `src/midi/web.ts` Web MIDI discover/open/send/subscribe/close without exporting `MIDIPort`. Verify TypeScript compiles and discover fails clearly when Web MIDI is missing.
- [x] 2.2 Add `@tauri-apps/api`, Rust `midir`, commands `midi_list_ports` / `midi_open` / `midi_send` / `midi_close`, inbound event, and ACL permissions. Verify `src-tauri` builds (`cargo check` in `src-tauri`).
- [x] 2.3 Implement `src/midi/tauri.ts` and `src/midi/detect.ts` (`createMidiTransport` picks Tauri vs web). Verify the factory does not import `MIDIPort` into `src/device/`.

## 3. Session and Connect UI

- [x] 3.1 Implement `DeviceSession` plus a React provider: discover, connect(endpoint, model), disconnect, snapshot. Verify React features import session APIs only (no raw MIDI).
- [x] 3.2 Fill the Connect modal: list USB devices, ask GP-5/GP-50 only when suggested model is missing (before open), no USB/Bluetooth picker, errors and empty list in English. Verify the disconnected chrome control still reads Connect.
- [x] 3.3 When connected, chrome shows the endpoint label; modal offers Disconnect; state survives Controller/Editor/Library navigation. Verify `npm run build` (web typecheck + Vite) succeeds.
