## Context

See proposal.md for why. The five free-tier list endpoints accept the user's bearer. `GET /api/v1/tones/search` does not. Header sign-in and the full select catalog use a popup (`popup.ts`) because an iframe does not keep the TONE3000 cookie.

## Goals / Non-Goals

**Goals:**

- The slot modal's first view is those five lists, rendered by GP Studio.
- Browse all catalog opens the select catalog in a popup window and keeps the modal on the lists.
- A chosen tone still uses `loadToneA2Models` and the existing SnapTone send.

**Non-Goals:**

- See proposal.md. No search endpoint, no favorite writes, no select iframe.

## Decisions

1. **List client next to the tone read.** Add the five reads in `src/features/tone3000/api.ts`, using the bearer from `ensureAccessToken`. Favorites, created, and downloads are `GET /api/v1/tones/favorited|created|downloaded` with `page` and `page_size` (at most 100). Gear `amp` or `amp-cab` is sent only when that filter is selected; All omits `gear`. Title search is the `query` parameter on those three only. Trending is `GET /api/v1/tones/trending` with optional `gear` and no page. Latest is `GET /api/v1/tones/latest` with no query. The client must not request `/tones/search`. A self-check on import asserts those URLs and rejects a search URL.
   Alternative: one search call with every filter. Rejected. It is rate-limited and outside the free tier.

2. **Rows are display fields only.** Each row keeps id, title, gear, format, username, and image URL when the payload has one. Gear labels reuse `tone3000GearLabel`. Choosing a row calls the existing `loadToneA2Models`. Lists are not filtered to A2; a tone with no A2 model keeps the existing English result and does not send.

3. **List chrome and remembered selection.** English tabs in this order: Trending, Latest, My Favorites, Downloaded by Me, Created by Me. Created by Me is the signed-in user's created tones. Default is Trending when nothing is stored. The chosen list kind and gear filter are stored in `localStorage` and restored on the next open. Switching list keeps the gear filter and drops the title search when the new list does not accept it. Gear All means Amp and Amp + Cab only (never pedals/IR/other): personal and trending lists request both gears; latest filters client-side. Amp / Amp + Cab send that single gear. Default gear is All with an empty title.

4. **Browse all catalog is a popup, not an iframe.** A highlighted English Browse all catalog control sits to the left of the list tabs. On click it opens `beginAuthorize("catalog")` in the existing TONE3000 popup (`prompt=select_tone`, `format=nam`, `architecture=2`, `menubar=true`). The `gears` query follows the remembered gear filter (`amp`, `amp-cab`, or `amp_amp-cab` for All). The modal stays on the lists and shows an English waiting line until the popup closes or a tone returns. A return with a `tone_id` loads A2 models. A return with a code and no `tone_id` exchanges it and loads a fresh select URL in the popup with the same gears. Closing the popup clears the waiting line and restores the lists. Closing the modal closes the popup. The list view itself does not navigate to TONE3000.

5. **Signed-out slot uses the header sign-in.** No token: the modal opens the existing sign-in popup (`beginAuthorize("sign-in")`) with no partnership screen. Success shows the remembered list (or Trending). Cancel closes the modal and stays signed out. The select popup is not the sign-in screen.

6. **Docs only state the extra reads.** One sentence in `docs/architecture.md` and in `openspec/config.yaml` context: the same web USB client may read favorites, created, downloads, trending, and latest. No server, no secret key, no search endpoint.

## Risks / Trade-offs

- [Personal lists include IR, pedals, and A1] → Gear filter narrows Amp and Amp + Cab. A tone with no A2 model still stops with the existing English message and does not send.
- [Browse can still need a second sign-in in the popup] → Lists are the path that does not need that cookie. Browse stays the full-catalog escape hatch and keeps the login-return reload.
- [Calling search would leave the free tier] → The client has no search URL. The self-check fails if one appears.
- [List endpoints can fail or return a short page] → One request per list or filter change. No prefetch of the other four. A failure is an English error and does not download or send.

## Migration Plan

No stored data moves except the new remembered list kind. A slot open that used to show the select flow first shows the lists instead. Rollback is restoring that select popup as the first view.
