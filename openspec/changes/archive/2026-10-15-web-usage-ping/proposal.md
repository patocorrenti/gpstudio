## Why

The production web app is an installable PWA. After the first visit the shell is served from the service worker cache, so later opens often never reach the static host and disappear from its access log. A best-effort same-origin ping on each cold start keeps those online opens visible. An offline open still renders; a failed ping is ignored.

## What Changes

- On each cold start of the production web app, send one `GET /usage` to the same origin after the shell has started.
- The query carries the package version (`v`) and whether the app is installed (`mode=standalone`) or running in a browser tab (`mode=browser`). No body, no client id, no pedal or patch data.
- Ignore failure, including offline. Do not retry, queue, or surface an error.
- Do not send the request from the native desktop window or from the web development server.
- Leave `/usage` out of the service worker cache so an online open reaches the origin.
- Nginx on the static host answers that path with `204` and `Cache-Control: no-store`. That vhost edit is outside this repo; the handoff is in `design.md`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-shell`: the production web shell reports one online open per cold start and still renders when that request fails.

## Impact

- `src/main.tsx` (or a sibling under `src/app/`): one fire-and-forget request after render, production web only.
- `vite.config.ts`: `/usage` stays a network request, not a precached URL.
- `docs/architecture.md` and the OpenSpec context: one sentence that this ping is not an application backend. `docs/architecture.md` still says the app has no HTTP backend and talks to the pedal directly.
- The static host (`gpstudio.patocorrenti.com`) needs the Nginx location in `design.md`. This change does not edit that server.
- No new dependency. No pedal, MIDI, or session change.

## Non-goals

- Configuring Nginx, deploying the site, or merging to `live`.
- Counting offline opens, retrying later, or queueing with Background Sync.
- Product events (pedal connected, section visited, patch edited).
- A client id, cookies, or any pedal, patch, or MIDI payload.
- Third-party analytics.
- An application HTTP backend. The ping is one GET that the existing static vhost may answer; the shell still starts with no network, as in `docs/architecture.md`.
- Reporting from the Tauri window.
- Unifying the hardcoded version strings in the footer, welcome, and About. `v` reads `package.json`, which the release flow already keeps aligned with those strings.
