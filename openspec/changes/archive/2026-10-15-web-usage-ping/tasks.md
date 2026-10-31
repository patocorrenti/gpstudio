Nginx for `/usage` is not a task in this change. The handoff for that agent is the "Nginx handoff" section in `design.md`.

## 1. Usage request

- [x] 1.1 In `vite.config.ts`, read the `version` field of `package.json` and expose it to the client with Vite `define`. Verify the defined string equals that field and `npx tsc -b` passes.
- [x] 1.2 Add `src/app/usage-ping.ts` that returns immediately unless `import.meta.env.PROD`, then fires one `GET /usage` with `v` set to that version and `mode` set to `standalone` when `isPwaInstalled()` is true and `browser` otherwise. Use `cache: "no-store"` and `keepalive: true`, ignore failures, and do not send a body, a client id, or pedal data. Verify by reading the module: a non-production call does not reach `fetch`, and the request matches that shape.

## 2. Shell wiring

- [x] 2.1 Call the usage ping from the existing non-Tauri branch in `src/main.tsx` after `createRoot`, without awaiting it and without a React effect. Verify the Tauri branch does not call it.
- [x] 2.2 Set Workbox `navigateFallbackDenylist` to `/^\/usage$/` in `vite.config.ts`. Do not add a runtime cache route or a file under `public/` or `dist/` for `/usage`. Verify the denylist is present and `globPatterns` still do not list that path.

## 3. Architecture notes

- [x] 3.1 Next to the existing "No HTTP backend" line in `docs/architecture.md`, and in the OpenSpec context in `openspec/config.yaml`, state that the production web app may send one best-effort same-origin GET `/usage` per cold start, that failure is ignored, and that this is not an application backend. Verify both files say that and still say the app talks to the pedal directly.
