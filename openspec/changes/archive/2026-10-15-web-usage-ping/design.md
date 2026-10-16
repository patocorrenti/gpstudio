## Context

See proposal.md for why. The production site is static files rsynced to `gpstudio.patocorrenti.com`. `docs/architecture.md` says there is no HTTP backend and the app talks to the pedal directly. `vite-plugin-pwa` precaches the shell (`globPatterns` for js, css, html, svg, png, and fonts). `src/main.tsx` registers that worker only outside Tauri. `src/app/pwa-install.ts` already knows when the app is displayed standalone. The footer version is a literal kept in sync with `package.json` by the release flow; `tsconfig` does not enable `resolveJsonModule`.

## Goals / Non-Goals

**Goals:**

- One production-web GET per document load, ignored on failure, not cached by the service worker.
- A copy-paste Nginx handoff for the existing vhost. This repo does not change that server.

**Non-Goals:**

- A new process, route handler, or file under `dist/` for `/usage`.
- Editing the release skill or the hardcoded footer, welcome, and About version strings.

## Decisions

### Call site

Add `src/app/usage-ping.ts` and call it from the existing non-Tauri branch in `src/main.tsx`, after `createRoot` has been called. The function returns immediately unless `import.meta.env.PROD`. The call is not awaited and is not a React effect, so one document load sends one request and the first paint does not wait on it.

Alternative: a `useEffect` in `AppShell`. Rejected. It is tied to the React lifecycle and can run twice under StrictMode in development.

### Request

```text
GET /usage?v=<package.json version>&mode=browser|standalone
```

`mode=standalone` when `isPwaInstalled()` is true, otherwise `browser`. `fetch` uses `method: "GET"`, `cache: "no-store"`, and `keepalive: true`. An empty `catch` drops network and HTTP errors. No retry.

`v` comes from the `version` field of `package.json`, injected with Vite `define` from `vite.config.ts`. That avoids a second hardcoded copy and does not require `resolveJsonModule`.

Alternative: `navigator.sendBeacon`. Rejected. It is a POST and cannot set `cache: "no-store"`.

Alternative: Workbox Background Sync. Rejected. A failed open is dropped, matching the spec.

### Service worker

Do not precache `/usage` and do not add a runtime cache route for it. A `fetch` from the page is not a navigation, so the default navigate fallback does not rewrite it. Still set `navigateFallbackDenylist` to `/^\/usage$/` so a navigation to that path is not answered with the cached shell.

### Docs

Add one sentence beside the existing "No HTTP backend" line in `docs/architecture.md` and the matching OpenSpec context: the production web app may send one best-effort same-origin GET `/usage` per cold start, failure is ignored, and that request is not an application backend. The pedal path is unchanged.

### Nginx handoff

This change does not edit the server. The block below is the instruction for the agent that configures Nginx.

---

Configure Nginx for GP Studio usage pings. Do not change the GP Studio repo.

Site: `https://gpstudio.patocorrenti.com`. Static files are deployed with `rsync --delete` of `dist/` into the site root. Do not create a file on disk for `/usage`. The next deploy would delete it.

The app will send, once per cold start of the production website:

```text
GET /usage?v=<package version>&mode=browser
GET /usage?v=<package version>&mode=standalone
```

No body. Same origin. Examples: `mode=browser` is a normal tab, `mode=standalone` is the installed PWA. `v` looks like `1.0.0-beta.3`.

In the `server` block for that host, add this exact-match location. `location =` wins over a prefix `location /` that falls back to `index.html`, including when the fallback is declared first:

```nginx
location = /usage {
    add_header Cache-Control "no-store" always;
    return 204;
}
```

Leave the existing `access_log` on. Do not set `access_log off` for this location. Do not add CORS headers. Do not change TLS, other locations, or the deploy user.

After `nginx -t` and a reload, `curl -sI https://gpstudio.patocorrenti.com/usage` must show status `204` and `cache-control: no-store`. The access log line to count as a visit is that request, for example:

```text
GET /usage?v=1.0.0-beta.3&mode=standalone HTTP/1.1" 204
```

Count those lines. Do not also count `index.html` for the same open. If a cache or CDN sits in front of this vhost, bypass it for `/usage`. The app deploy talks to the VPS directly; add a bypass only when such a cache exists.

Until this location exists, the SPA fallback may answer `/usage` with `index.html`. The app ignores the body. The `204` is what keeps the response out of caches and out of page-view counts.

---

## Risks / Trade-offs

- [Nginx still falls back to `index.html`] → The app still ignores the response. A cache in front could store that HTML for `/usage` and hide later opens. The handoff's `204` and `no-store` is the mitigation. The browser request uses `cache: "no-store"` either way.
- [Visits counted from both `/` and `/usage`] → After this ships, a visit is the `/usage` line. The first online load also fetches the document; that fetch is not an extra visit.
- [Installed app left open for days] → One ping per cold start. A later open sends another. No mid-session heartbeat.
- [Offline open] → Nothing is recorded. The shell still renders.

## Migration Plan

Ship the app change and the Nginx location independently. The client tolerates a missing `204`. Rollback of the app is removing the call in `src/main.tsx`. The Nginx location can stay; an unused `204` does not affect the site. Do not merge or publish to `live` from this change.
