## Context

See proposal.md for why. The slot modal in `src/features/tone3000/Tone3000Catalog.tsx` opens TONE3000's select URL in an iframe. `src/features/tone3000/api.ts` already reads one tone and its A2 models with the user's bearer. Header sign-in is a popup (`popup.ts`) because an iframe does not keep the TONE3000 cookie. The five free-tier list endpoints accept that same bearer. `GET /api/v1/tones/search` does not.

## Goals / Non-Goals

**Goals:**

- The slot modal's first view is those five lists, rendered by GP Studio.
- Browse TONE3000 keeps the select catalog reachable inside the same modal.
- A chosen tone still uses `loadToneA2Models` and the existing SnapTone send.

**Non-Goals:**

- See proposal.md. No search endpoint, no favorite writes, no second session.

## Decisions

1. **List client next to the tone read.** Add the five reads in `src/features/tone3000/api.ts`, using the bearer from `ensureAccessToken`. Favorites, created, and downloads are `GET /api/v1/tones/favorited|created|downloaded` with `page` and `page_size` (at most 100). Gear `amp` or `amp-cab` is sent only when that filter is selected; All omits `gear`. Title search is the `query` parameter on those three only. Trending is `GET /api/v1/tones/trending` with optional `gear` and no page. Latest is `GET /api/v1/tones/latest` with no query. The client must not request `/tones/search`. A self-check on import asserts those URLs and rejects a search URL.
   Alternative: one search call with every filter. Rejected. It is rate-limited and outside the free tier.

2. **Rows are display fields only.** Each row keeps id, title, gear, format, username, and image URL when the payload has one. Gear labels reuse `tone3000GearLabel`. Choosing a row calls the existing `loadToneA2Models`. Lists are not filtered to A2; a tone with no A2 model keeps the existing English result and does not send.

3. **Default view.** Open on Favorites, gear All, empty title. Switching list keeps the gear filter when the new list accepts it and drops the title search when it does not. Latest shows neither control.

4. **Browse reuses the select iframe.** Browse TONE3000 sets the iframe to `beginAuthorize("catalog")`, the URL the modal uses today (`prompt=select_tone`, `format=nam`, `architecture=2`, `gears=amp_amp-cab`, `menubar=true`). A return with a `tone_id` loads A2 models and hides the iframe. A return with a code and no `tone_id` exchanges it and loads a fresh select URL, as the iframe does today. Back clears that URL and shows the lists again. The list view itself does not navigate to TONE3000.

5. **Signed-out slot uses the header sign-in.** No token: the modal shows the same partnership screen, then the existing sign-in popup (`beginAuthorize("sign-in")`). Success shows Favorites. Cancel closes the modal and stays signed out. The select iframe is not the sign-in screen.

6. **Docs only state the extra reads.** One sentence in `docs/architecture.md` and in `openspec/config.yaml` context: the same web USB client may read favorites, created, downloads, trending, and latest. No server, no secret key, no search endpoint.

## Risks / Trade-offs

- [Personal lists include IR, pedals, and A1] → Gear filter narrows Amp and Amp + Cab. A tone with no A2 model still stops with the existing English message and does not send.
- [Browse TONE3000 can still lose the cookie inside the iframe] → Lists are the path that does not need that cookie. Browse stays the full-catalog escape hatch and keeps the login-return reload.
- [Calling search would leave the free tier] → The client has no search URL. The self-check fails if one appears.
- [List endpoints can fail or return a short page] → One request per list or filter change. No prefetch of the other four. A failure is an English error and does not download or send.

## Migration Plan

No stored data moves. A slot open that used to show the select iframe shows the lists instead. Rollback is restoring that iframe as the first view.
