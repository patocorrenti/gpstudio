## Why

The slot modal currently hands browsing to TONE3000's own catalog page. That page does not share the sign-in cookie with GP Studio, so the user signs in again and the return often stalls. The user's token can already read the free-tier tone lists, so the modal can show those lists itself and keep the existing A2 download. The full catalog still needs TONE3000's select flow in a real window (an iframe drops the session cookie).

## What Changes

- The slot modal opens on GP Studio free-tier lists: Trending, Latest, My Favorites, Downloaded by Me, and Created by Me. It no longer opens on TONE3000's catalog page.
- Default list is Trending. The last chosen list is remembered across open and close.
- My Favorites, Created by Me, and Downloaded by Me accept a gear filter (Amp, Amp + Cab, or all) and a title search. Trending accepts the same gear filter. Latest has no filter. Personal lists page. Trending and latest show at most ten tones.
- Each row shows the tone image, title, gear, format, and creator username. The view names TONE3000.
- Choosing a tone still lists that tone's A2 models and uses the existing name, replace, convert, and send path.
- A highlighted English Browse all catalog action opens TONE3000's select catalog in a popup window (not an iframe), so the TONE3000 cookie stays. The modal stays open on the lists while that window is used.
- A signed-out open uses the existing sign-in, then shows the remembered list (or Trending). Header sign-in, the USB-only control, and Disconnect stay as they are.
- The client uses the user's token. There is no GP Studio server, no secret key, and no `/tones/search` (`docs/architecture.md`).

## Capabilities

### New Capabilities

### Modified Capabilities

- `tone3000`: The catalog modal shows the free-tier lists, with the filters those lists accept, instead of opening on TONE3000's catalog page. Choosing a tone still returns one NAM A2 model through the existing send. Browse all catalog remains a popup path to the full select catalog.

## Non-goals

- `GET /api/v1/tones/search`, and filters that exist only there (tags, makes, sizes, creators, sort, calibrated, verified). That endpoint is rate-limited and sits outside the free tier.
- Embedding the select catalog in an iframe (it loses the TONE3000 session cookie).
- A commercial TONE3000 agreement, favorite or unfavorite writes, and audio preview.
- Crawling tone pages, or a catalog indexed by GP Studio.
- NAM A1, IR upload, and any new SysEx. Conversion and USB send stay the existing session path (`docs/architecture.md`).
- Changing who sees the TONE3000 control, how the session is stored, or the header sign-in.
- A Tauri catalog. The native window still hides the control.
- Merging or publishing to `live`.

## Impact

- `src/features/tone3000/`: list reads beside the existing tone and model reads. The slot modal in `Tone3000Catalog.tsx` renders the lists and opens the select catalog in a popup from Browse all catalog.
- `src/features/controller/SnapToneDialog.tsx` still only opens that modal for a user slot. Disk upload, delete, and rename stay.
- `docs/architecture.md` and the `context` in `openspec/config.yaml` note that the same web USB client may read those five lists. A GP Studio server stays out of scope.
