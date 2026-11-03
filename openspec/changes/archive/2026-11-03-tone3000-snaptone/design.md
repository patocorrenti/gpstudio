## Context

See `proposal.md` for why. SnapTone upload, delete, and rename already live in `src/features/controller/SnapToneDialog.tsx` and go through `DeviceSession` (`inspectNam`, `convertNamToSnapTone`, `uploadUserSnapTone`). The shell nav is `src/components/main-menu.tsx`, rendered from `src/app/AppShell.tsx`. The app is a Vite PWA on a hash router (`src/app/App.tsx`) and the production site is a static `dist/` upload (`docs/architecture.md`: no HTTP backend). TONE3000's API is OAuth 2.0 with PKCE for a public client: the publishable key is the `client_id`, the token request has no client secret, and a refresh token is rotated on every refresh.

## Goals / Non-Goals

**Goals:**

- A browser session that outlives the tab, refreshed with the latest stored refresh token.
- Sign-in and the catalog inside GP Studio modals, on the web app only, and only while USB can take a SnapTone file.
- One chosen A2 model dropped onto the existing upload preview for that slot.

**Non-Goals:**

- A new SysEx path, a GP Studio server, or a TONE3000 catalog implemented in React.
- Registering the native window's origin. See `proposal.md`.

## Decisions

1. **Feature folder, not the session.** TONE3000 HTTP and tokens live in `src/features/tone3000/`. The shell and the SnapTone modal import that feature. `DeviceSession` stays the pedal façade. React still does not send MIDI. The catalog modal calls the existing inspect / convert / upload methods with the downloaded bytes.

2. **Public client only.** `client_id` is `VITE_TONE3000_CLIENT_ID`. An empty value hides the control and the row action. The secret key is never read. Deploy passes the id in from a repository variable. A missing variable builds a web app with the control hidden.

3. **Redirect is the site root, plus the query TONE3000 appends.** The host only serves files that exist in `dist/`, and hash routes cannot be a registered redirect URI. The registered URI is the origin root (`https://gpstudio.patocorrenti.com/`, the staging origin, and `http://localhost:1420/`). Boot reads `code`, `state`, and `tone_id` from `location.search` before the hash router matters.

   The sign-in and catalog pages are iframed in the modal. The iframe is same-origin once it returns, posts `{ code, state, tone_id }` to the parent, and renders nothing else. The parent checks `state`, exchanges the code, and continues the modal. The PKCE verifier and `state` live in `sessionStorage` for that tab, including the iframe. If the top window itself lands on the callback, boot exchanges the code and then `replace`s the URL back to `/#/` with the query removed.

   Authorize URL: `https://www.tone3000.com/api/v1/oauth/authorize`. Token URL: `POST /api/v1/oauth/token` with `client_id` and the PKCE verifier. Header sign-in omits `prompt`. The catalog uses `prompt=select_tone`, `format=nam`, `architecture=2`, `gears=amp_amp-cab`, and `menubar=true`. A select-flow code is exchanged the same way and replaces the stored tokens.

4. **Long session is `localStorage` on the page origin.** Keys hold the access token, the refresh token, and the access expiry. Closing the tab does not clear them. Pedal disconnect does not clear them. Disconnect removes only those keys. On launch, and before a TONE3000 request, an expired access token is refreshed. Each refresh response replaces both tokens. One refresh runs at a time per tab. Before refreshing, the tab reads the latest refresh token from `localStorage`, so another tab's rotation is not overwritten with a stale one. `invalid_grant` after that re-read signs the user out. There is no documented revoke call. The username comes from `GET /api/v1/user`.

5. **After a tone id, two reads, no search.** `GET /api/v1/tones/{id}?architecture=2` and `GET /api/v1/models?tone_id={id}&architecture=2&page_size=300`, with the user bearer. The model file is `GET` of that row's `model_url` with the same bearer. The modal shows title, gear, NAM, and `username`. An empty A2 list stops before inspect. Bytes then follow the SnapTone preview already in the slot dialog, including the 10-character name and the replace ask.

6. **Where the control sits.** `AppShell` renders the feature control in the right header cluster, immediately before `MainMenu`, visible from the `md` breakpoint up. It is not a child of the narrow-screen popover. It renders only when the session snapshot is connected on USB, the publishable key is set, and `isTauriRuntime()` is false. The SnapTone row action uses that same gate, so the native window and Bluetooth never open the catalog.

## Risks / Trade-offs

- [TONE3000 blocks framing later, or the sign-in cookie does not stick in the iframe on a desktop browser] → The modal cannot fall back to navigating the controller away. Stop and ask before replacing the iframe with a full-page redirect.
- [The registered redirect must accept the appended `code` query] → Register the origin root, which is what their authorize redirect already does. If their settings require a path with no extra query, the callback cannot move to a new path without a server rewrite, and that needs a separate decision.
- [Refresh lifetime is unpublished, and refresh rotates] → Persist every new refresh token. A lost rotation, or a refresh TONE3000 rejects, returns the muted control. GP Studio cannot lengthen their lifetime past that.
- [Two tabs refresh at once] → Re-read `localStorage` before the refresh, and do not sign out on the first `invalid_grant` until that re-read still fails.
- [Native window and the PWA do not share tokens] → The control is web-only. A login in the browser does not appear in Tauri.
- [Catalog filters still let an unusable A2 through] → `inspectNam` remains the gate. The modal shows its English reason and does not send.

## Migration Plan

No stored pedal data moves. Before the control can succeed in production, the integration owner creates a publishable key, registers the three origin roots above, and sets the build variable. Unset, the shipped app looks as it does today. Reverting the change, or clearing the variable, removes the control. Tokens already in a browser sit unused until the user clears site data.

## Open Questions

None. The refresh token's calendar lifetime is TONE3000's, and the spec already treats a failed refresh as signed out.
