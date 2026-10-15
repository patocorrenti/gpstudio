## 1. Production manifest and placeholder icons

- [x] 1.1 Add `vite-plugin-pwa` to the production Vite build with `devOptions.enabled` false and `registerType: "prompt"`. Verify `npm run dev` is unchanged and the plugin is not enabled for the dev server.
- [x] 1.2 Add `public/pwa-192.png` and `public/pwa-512.png` from the current Tauri placeholder `src-tauri/icons/128x128@2x.png`. Verify the files are 192 and 512 PNG and that `src-tauri` icon paths are unchanged.
- [x] 1.3 Point the manifest at those files with `name` and `short_name` GP Studio, the English description from `index.html`, `start_url` and `scope` `/`, `id` `/`, `display` `standalone`, `lang` `en`, and theme and background `#010f24`. Verify `npm run build` writes that manifest into `dist/`.

## 2. Service worker, registration, and reload prompt

- [x] 2.1 Precache the production shell (HTML, JS, CSS, and the manifest icons) and emit a fetch-handling service worker. Set `injectRegister` so `index.html` does not register a worker. Verify `dist/` contains the worker and `dist/index.html` has no unconditional `navigator.serviceWorker.register` call.
- [x] 2.2 Register the worker from `src/main.tsx` only when `isTauriRuntime()` is false. Verify the desktop path cannot register it, and that Web MIDI / Web Bluetooth versus midir / btleplug is unchanged.
- [x] 2.3 When a worker is waiting, show an English reload prompt in the existing toast region and call `skipWaiting` only from that action. Verify the prompt does not change the current section and that load does not activate the waiting worker by itself.

## 3. About notes and architecture

- [ ] 3.1 Add the installed-app section to `src/features/about/AboutPage.tsx` only after the English sentences are supplied. Do not invent them. Verify the shown copy matches those sentences, states that iPhone and iPad cannot connect to the pedal, does not affirm Linux Bluetooth or Android USB, does not say the Microsoft Store listing already exists, and does not send MIDI.
- [x] 3.2 Update the web line in `docs/architecture.md` so the hosted app is an installable PWA and the Tauri window does not register the service worker. Verify that sentence is the only plan change in that file.

## 4. Store-ready build and publish gates

- [x] 4.1 From the production `dist/` manifest and service worker, confirm the PWABuilder Windows inputs are present: GP Studio name, English description, root start URL and scope, stable id, standalone display, English language, `#010f24` theme and background, PNG icons at 192 and 512, and a fetch handler. Verify by reading those build artifacts, not by submitting a Store package.
- [x] 4.2 Replace `public/pwa-192.png` and `public/pwa-512.png` with the final brand art before merging to `live`. Leave this unchecked until that art exists. Verify the manifest paths stay the same and only the two files change.
- [ ] 4.3 Merge to `live` only after 3.1 and 4.2 are done. Verify both tasks are checked before that merge. Partner Center submission stays outside this change.
