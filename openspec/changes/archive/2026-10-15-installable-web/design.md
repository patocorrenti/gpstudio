## Context

See proposal.md for why. The production site is the Vite build deployed from `dist/` (`.github/workflows/deploy.yml` rsyncs that folder to `gpstudio.patocorrenti.com`). Tauri uses the same `dist/` (`src-tauri/tauri.conf.json` `frontendDist`). The browser and the desktop window already split in `isTauriRuntime()` (`src/midi/detect.ts`): the browser uses Web MIDI and Web Bluetooth; Tauri uses midir and btleplug because WebView2 does not expose those APIs (`docs/architecture.md`). Routing is a `HashRouter` (`src/app/App.tsx`), so one `index.html` covers every section. There is no web app manifest and no service worker. `public/` has `favicon.svg` only. `src-tauri/icons/` holds the current PNG placeholders.

## Goals / Non-Goals

**Goals:**

- Emit a store-ready manifest and a precaching service worker from `npm run build`.
- Register that worker only in the browser, and ask before a new deploy replaces the running session.
- Keep the icon files swappable and the About platform sentences out of this design until they are supplied.

**Non-Goals:**

- See proposal.md. This design does not choose Partner Center fields, listing screenshots, or the final icon artwork.

## Decisions

### Manifest and precache come from the Vite production build

Use `vite-plugin-pwa` (Workbox `generateSW`) on the production build only. `devOptions.enabled` stays false, so `npm run dev` does not register a worker. The plugin writes the manifest and `sw.js` into `dist/`. The existing deploy workflow uploads them with the rest of the site.

The manifest is the install and Store contract:

- `name` and `short_name`: GP Studio
- `description`: the English product description already in `index.html`
- `start_url` and `scope`: `/`
- `id`: `/` (stable across deploys so a later Store package keeps the same app)
- `display`: `standalone`
- `lang`: `en`
- `theme_color` and `background_color`: `#010f24` (the dark first paint already used by the theme-color meta)
- `icons`: PNG 192 and 512, purpose `any`

`HashRouter` needs no navigation fallback beyond precaching `index.html`. Precache the build assets (HTML, JS, CSS, icons). Do not runtime-cache cross-origin URLs.

Alternative: a hand-written manifest and service worker. Rejected because the precache list has to track hashed Vite filenames, and the Store fields would drift from the build.

### Registration is browser-only, and updates wait

Set the plugin's `injectRegister` so `index.html` does not register a worker by itself. `src/main.tsx` registers only when `isTauriRuntime()` is false. The Tauri window then loads the same `dist/` without a controlling worker. WebView2 stays off the pedal path (`docs/architecture.md`).

Use `registerType: "prompt"`. When a waiting worker exists, show an English prompt in the shell's existing toast region with a reload action. Call `skipWaiting` only after that action. Do not activate the new worker on load.

Alternative: `autoUpdate` / `skipWaiting` immediately. Rejected because a protocol change would replace the session while a pedal is connected.

### Icons are two public files

Generate `public/pwa-192.png` and `public/pwa-512.png` from the current largest Tauri placeholder (`src-tauri/icons/128x128@2x.png`). The manifest points at those public files. Replacing the brand later is a file swap, not a manifest rewrite. Purpose stays `any` until the real artwork has a safe maskable zone. Tauri's own icon list is unchanged.

### About Install section and deferred install prompt

About includes an Install GP Studio section with English benefits, platform limits, and Install now. Browser code captures `beforeinstallprompt` (not in Tauri). Install now calls that deferred prompt when present; otherwise it shows an English toast that points at the Chrome or Edge install menu. The Microsoft Store badge stays behind a flag until a listing exists so About does not claim the Store package is already available.

### Store packaging is a check on the built manifest

PWABuilder's Windows package is an Edge-hosted app pointed at the hosted HTTPS URL. The code change is done when the production manifest and fetch handler meet that tool's required inputs (the fields above, plus the service worker). Generating the `.msix` and submitting it to Partner Center stay outside this change.

## Risks / Trade-offs

- [A waiting worker is ignored and the user keeps an old codec build] → The prompt stays available for that session; the next cold open still offers it. Do not silent-activate.
- [Tauri registers the worker because registration is injected into `index.html`] → `injectRegister` stays off, and the call site checks `isTauriRuntime()` before `register`.
- [Rollback deletes `sw.js` and the previous worker keeps controlling the origin] → A deploy that removes the PWA must publish a worker at the same URL that unregisters and clears its caches. `rsync --delete` alone is not that deploy.
- [Placeholder icons fail a maskable or screenshot recommendation in PWABuilder] → Required inputs are the 192/512 `any` icons and the fetch handler. Recommendations wait for the brand pass.
- [Android USB happens to work on one machine] → The app does not affirm it. About copy follows the same limits.

## Migration Plan

1. Land the production manifest, worker, browser-only registration, placeholder icons, and the reload prompt.
2. Add the About section when its copy is supplied, and swap the two public PNGs when the brand art is ready.
3. Packaging the hosted URL with PWABuilder and submitting it in Partner Center stays outside this change.
4. Rollback of a bad web deploy is a new `dist/` that still contains an unregistering worker if the PWA is being removed; otherwise it is the previous good build, which users pick up when they accept the reload prompt.
