## Why

GP Studio on the web is already the app people open at `gpstudio.patocorrenti.com`, but the Vite build is only a site. Installing it on Windows, Android, Mac, and Linux, and later packaging that same URL for the Microsoft Store, needs a manifest and a service worker the browser and PWABuilder accept (`docs/architecture.md` still describes the web app as Vite in Chrome/Edge on localhost or HTTPS).

## What Changes

- Make the production web build installable: web app manifest (`standalone`, name GP Studio) plus a service worker that precaches the shell.
- After that cache exists, reopening the installed app shows the UI, the stored theme, and saved preferences without a network. The pedal link stays the browser APIs already used by the tab (Web MIDI and Web Bluetooth).
- When a newer deploy is waiting, show an English prompt to reload. Do not swap the running session silently.
- Register the service worker only in the browser. The Tauri window shares `dist/` and must not register it (`docs/architecture.md`: the desktop shell is Tauri; WebView2 is not the web MIDI/Bluetooth path).
- Use the current Tauri PNG placeholders as temporary 192 and 512 icons, in files that can be replaced. Final brand art replaces those two files.
- Add an About Install section with English platform limits and an Install now control that uses the browser install prompt when available.
- Shape the manifest and service worker so PWABuilder can generate a Microsoft Store package (Edge-hosted) from the live HTTPS URL without a further code change. The Microsoft Store badge stays hidden until a listing exists.

## Non-goals

- Partner Center reservation, Store listing copy, pricing, or submitting the package. This change only leaves the production bundle ready to package.
- Final brand icons. Placeholders may be used while implementing; the brand files replace them when the art is ready.
- iPhone and iPad. The installed web app is not a pedal controller there.
- Promising USB on Android. That link is not affirmed for the installed app.
- Install instructions for Safari.
- Push notifications, background Bluetooth, the Play Store, the Mac App Store, and Flathub.
- Replacing the Tauri desktop app, or packaging a mobile Tauri app (`docs/architecture.md`).
- A new pedal transport. USB and Bluetooth stay the existing Web MIDI and Web Bluetooth backends in the browser, and midir / btleplug in Tauri.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-shell`: The hosted web shell becomes an installable app with an offline reopen, a reload prompt, store-ready manifest inputs, and an About section for the installed app. The desktop window stays a Tauri shell without a service worker.

## Impact

- Vite production build (`vite.config.ts`, `index.html`, `public/` icons) and browser-only service-worker registration next to the existing `isTauriRuntime()` split in `src/midi/detect.ts`.
- `src/features/about/AboutPage.tsx` and browser-only install-prompt capture next to service-worker registration.
- A small build dependency for the manifest and precache. `npm run build` still emits the `dist/` Tauri consumes (`src-tauri/tauri.conf.json`).
- `docs/architecture.md` web line, so the hosted app is described as installable.
- No MIDI, Bluetooth, or DeviceSession behavior changes.
