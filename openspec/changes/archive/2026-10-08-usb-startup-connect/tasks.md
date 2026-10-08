## 1. Preferences (USB-only startup)

- [x] 1.1 In `src/app/preferences.ts`, make `StartupPedal.link` / `parseStartup` / `setStartup` USB-only so a stored Bluetooth `startup` reads as `null`, update import-time asserts for that case, and verify those asserts pass under `npm run build`.

## 2. Connect UI

- [x] 2.1 Update `ScanPanel`: remove the “Always connect this way, don't ask again” checkbox and related props; change the USB ModeNotes line to “Super responsive — Instant, stable connection.”; verify `npm run build` and that the checkbox string is gone from Connect UI sources.
- [x] 2.2 Update `EndpointList` for USB rows: “Connect on startup” label + circular Zap toggle (on/off) with tooltip that the app tries to connect when it opens; omit that control on Bluetooth rows; keep remembered remove `(X)`; verify TypeScript props compile with `npm run build`.
- [x] 2.3 Wire `ConnectionStatus`: drop `armStartup` / checkbox handlers; Zap on sets USB `startup` (remember suggested model when present), Zap off clears; launch resolve USB-only with toast “Your startup pedal failed or is not connected.”; verify no Bluetooth branch remains in `resolveStartupEndpoint` and build passes.

## 3. Web Bluetooth one-click connect

- [x] 3.1 On web, selecting the Bluetooth tab and Scan again always runs interactive discover (remove the “already listed → skip picker” gate); when `selectedId` is returned, pick/connect immediately (known model or model ask); cancel keeps the remembered/authorized list; verify the code path in `ConnectionStatus` and `npm run build`.

## 4. Copy and docs

- [x] 4.1 Update `docs/architecture.md` Connect sentence and OpenSpec `context` Connect sentence so startup is USB-only and web Bluetooth picker connects on accept; verify those files no longer claim Bluetooth startup or “picker lists without connecting”. Do not edit About changelog (release notes land with the next version bump).
