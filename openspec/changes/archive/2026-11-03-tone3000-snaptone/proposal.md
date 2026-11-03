## Why

A SnapTone upload already accepts a local NAM A2 file, but the captures people actually use live on TONE3000. GP Studio should take one of those models and run the upload that already exists, without a file hop and without a server of our own (`docs/architecture.md`: no HTTP backend; A2 SnapTone upload is already in scope).

## What Changes

- While a pedal is connected over USB, the desktop nav shows a TONE3000 control immediately before Pedal. A muted dot means signed out. A lime dot and the TONE3000 username mean signed in. Bluetooth, a disconnected pedal, and the narrow-screen menu do not show it.
- Signed out, that control opens a login modal. The modal stays on the controller: a short partnership screen, then TONE3000's own sign-in. Signed in, it opens a status modal with the username and Disconnect.
- The session is the user's TONE3000 account, stored in the browser. Closing GP Studio does not sign them out. Disconnecting the pedal does not sign them out. Disconnect on the status modal does.
- Each user SnapTone row, beside the disk upload, opens a large modal for that slot. The modal shows TONE3000's catalog, then the A2 models of the chosen tone, then the same name, replace, convert, and send path a local `.nam` already uses.
- The client calls TONE3000 with the user's token and the publishable app key. There is no GP Studio server and no secret key in the app.

## Capabilities

### New Capabilities

- `tone3000`: TONE3000 sign-in, the persisted browser session, the shell control, and the catalog modal that returns one NAM A2 file for a chosen user slot.

### Modified Capabilities

- `app-shell`: With a USB pedal connected, the desktop nav shows the TONE3000 control before Pedal. It is absent otherwise and sends no MIDI.
- `live-controller`: A user SnapTone row can open the TONE3000 modal for that slot. Disk upload, delete, and rename stay as they are. A link that cannot accept a SnapTone file still explains and does not send.

## Non-goals

- A GP Studio account, a GP Studio HTTP API, or embedding the TONE3000 secret key.
- Crawling tone pages, a catalog built inside GP Studio, search, favorites, trending, or latest lists of our own.
- Pasting a tone URL. The catalog is TONE3000's select flow.
- NAM A1, IR upload, audio preview, and any new SysEx. Conversion and USB send stay the existing session path (`docs/architecture.md`).
- Showing the control on Bluetooth, when no pedal is connected, or in the narrow-screen menu.
- A Tauri redirect URI. The native window is a different origin from the PWA, so the control stays hidden there.
- Signing the user out of tone3000.com itself. Disconnect clears only the tokens GP Studio stored.
- Merging or publishing to `live`.

## Impact

- Shell: `src/app/AppShell.tsx` and the desktop nav in `src/components/main-menu.tsx`. The control lives under `src/features/tone3000/` and is imported the same way the connection-status control is.
- SnapTone modal: `src/features/controller/SnapToneDialog.tsx` gains a per-slot action that opens the TONE3000 modal. The file input stays.
- New client for TONE3000 OAuth (PKCE, publishable key) and for one tone's A2 models. Tokens live in `localStorage` on the page origin. `DeviceSession` is unchanged except that the modal calls the existing `inspectNam`, `convertNamToSnapTone`, and `uploadUserSnapTone`.
- The app uses a hash router, so the OAuth return is a path (`/t3k/callback`) the host already serves as the SPA, not a hash route.
- A publishable key and registered redirect URIs come from the TONE3000 settings of the integration owner. The key is a public build variable. Login cannot succeed until those exist.
- `docs/architecture.md` and the `context` in `openspec/config.yaml` gain this client-side TONE3000 path beside the existing A2 upload, and keep a GP Studio server out of scope.
