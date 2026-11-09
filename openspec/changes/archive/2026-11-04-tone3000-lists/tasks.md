## 1. List client

- [x] 1.1 Add the five list reads in `src/features/tone3000/api.ts`, using the existing bearer. Favorites, created, and downloads take `page` and `page_size` (at most 100), optional `gear` (`amp` or `amp-cab`; All omits it), and optional `query`. Trending takes optional `gear` and no page. Latest takes no query. No `/tones/search`. A self-check on import asserts a favorites URL with `gear=amp` and `query=plexi`, a trending URL with gear and no `query`, a latest URL with no `gear`, and rejects a search URL. Verify that check runs when the module loads and `npx tsc -b --pretty false` exits 0.
- [x] 1.2 Parse each row to id, title, gear, format, username, and image URL when present. An empty `data` array is an empty list. A self-check feeds one favorites payload with those fields and one empty payload, and does not request a model file. Verify that check and `npx tsc -b --pretty false` exits 0.

## 2. Slot lists

- [x] 2.1 In `Tone3000Catalog.tsx`, a signed-in open shows the remembered list or Trending, gear All, and an empty title, with no select iframe. English lists in order: Trending, Latest, My Favorites, Downloaded by Me, Created by Me. Each row shows the image when present, title, gear label, format, and creator username. The view names TONE3000 and shows the signed-in username. Created by Me, My Favorites, and Downloaded by Me can show the next page. Trending and Latest do not. Amp and Amp + Cab reload the current list; Latest hides both filters; Trending hides the title search. An empty list and a failed list are English and do not download or send. Verify `npx tsc -b --pretty false` exits 0.
- [x] 2.2 Choosing a row still calls `loadToneA2Models` and the existing name, replace, convert, and send path for that slot. A tone with no A2 model keeps `This tone has no A2 model.` and does not send. Cancel before confirm sends nothing. The modal still imports `@/device/session` only for inspect, convert, and upload. Verify `npx tsc -b --pretty false` exits 0 and that `src/features/tone3000/` does not import a MIDI transport.
- [x] 2.3 Persist the chosen list kind in `localStorage` and restore it on the next open. Verify `npx tsc -b --pretty false` exits 0.

## 3. Browse and sign-in

- [x] 3.1 While the lists are showing, a highlighted English Browse all catalog action to the left of the tabs opens the existing catalog popup (`prompt=select_tone`, `format=nam`, `architecture=2`, `gears=amp_amp-cab`, `menubar=true`), not an iframe. A return with `tone_id` lists A2 models. A return with a code and no `tone_id` exchanges it and loads a fresh select URL in the popup. Closing the modal closes the popup without sending. Verify `npx tsc -b --pretty false` exits 0.
- [x] 3.2 A signed-out open starts the header sign-in popup (`beginAuthorize("sign-in")`) with no partnership screen and no select iframe. Cancel closes the modal and stays signed out. Success shows the remembered list or Trending. Verify `npx tsc -b --pretty false` exits 0.

## 4. Docs

- [x] 4.1 Add one sentence to `docs/architecture.md` and to the `context` in `openspec/config.yaml`: the same web USB client may read favorites, created, downloads, trending, and latest. A GP Studio server, a secret key, and `/tones/search` stay out. Verify both files say that and `npx tsc -b --pretty false` exits 0.
