## Context

See proposal.md for why. Today `ConnectionStatus` treats a Web Bluetooth picker result (`selectedId` from `WebBluetoothLink.discover`) as an immediate `pickDevice`, so the web app connects without a second click. Desktop Bluetooth already lists, then connects on click. USB lists only the live `discover()` result. Nothing is stored: theme uses next-themes under `patone-theme`, and Controller panel expansion uses its own `localStorage` key. Desktop USB ids are `{index}::{label}` (`src-tauri/src/midi.rs`), so the index can change between launches. Desktop Bluetooth ids are the peripheral address (`src-tauri/src/ble.rs`).

Connect and Controller import `@/device/session` only. Preferences are not a session, a link, or a codec.

## Goals / Non-Goals

**Goals:**

- One JSON preferences document in `localStorage` that Connect can grow later, without moving theme.
- Remember and forget pedals in the Connect UI, and optionally connect to one of them at launch.
- Keep MIDI and GATT types behind the existing transports. React never sees `MIDIPort` or `BluetoothDevice`.

**Non-Goals:**

- A Tauri plugin or Rust command for storage. The webview's `localStorage` is the same store the web app already uses.
- Changing `bluetooth-link`: interactive discover still returns `selectedId` when the picker chooses a pedal. Connect stops treating that id as a connect.

## Decisions

### Preferences live in `src/app/preferences.ts`

One key, `patone-preferences`, versioned JSON:

- `pedals`: `{ link, id, label, model? }[]` where `link` is `usb` or `bluetooth` and `model` is `gp5` or `gp50` when known.
- `startup`: `{ link, id } | null`. The model used at launch is the `model` on that pedal. At most one startup pedal.

`localStorage` is already the durable store for theme and for expanded panels, and it survives restarts in the browser and in the Tauri webview. A separate document leaves `patone-theme` and the panel key alone, and gives later user settings a place to land.

Invalid JSON or an unknown version reads as empty. Writes replace the whole document.

Alternative: one key per pedal. Rejected because a future setting would be another ad-hoc key, and startup has to point at one pedal anyway.

### Connect owns the list; the session only opens the link

`ConnectionStatus` merges live discovery with remembered pedals for the active link. Match the same pedal by id, or by the same link and the same label when the id changed (desktop USB index). When a live endpoint matches a remembered label under a new id, update the stored id.

Remember:

- Web picker `selectedId`: save the endpoint, refresh the Bluetooth list, do not call `pickDevice`.
- USB or desktop Bluetooth row pick: save when connect starts with a known model (suggested, or the model the user just confirmed). Backing out of the model ask does not save.

Forget removes that pedal from the document and clears `startup` when it was that pedal. The current list drops it even if the scan just found it. The next scan may show it again; choosing it saves it again.

The remove control is a sibling of the row button, not a button nested inside it. Only remembered rows have it. The favorite (startup) pedal shows a white star icon at the top right of its row. Clicking the star clears startup only (same as unchecking the checkbox) and leaves the remembered list.

`DeviceSession` does not store preferences and does not gain a second session. UI still connects only through `session.connect`.

### Web forget stays inside `WebBluetoothLink`

Passive `getDevices()` would put a removed pedal back on the next Bluetooth refresh. `WebBluetoothLink` gains `forget(id)`: call `BluetoothDevice.forget()` when it exists, then drop the device from the in-memory map. `TauriBluetoothLink.forget` resolves without a Rust command. `DeviceSession` exposes that as a thin `forgetBluetooth(id)` so Connect does not import the link. USB has no transport-level forget.

If `forget()` is missing, Connect still drops the preferences record. A dismissed-id set in the same document hides that id from passive `getDevices()` until an interactive picker returns it again.

### Startup attempt is one shot in `ConnectionStatus`

On mount, if `startup` has a known model and the session is disconnected, resolve the pedal on that link only (USB `discover`, or Bluetooth `discover({ interactive: false })`), then `session.connect`. Do not open the browser picker. Match id, then label, and write back a new id.

Success uses the existing connect promise toast. Failure uses that same promise with one English error, “Your favorite pedal failed or is not connected.”, then opens Connect on that link's tab. No second error toast and no “Pedal disconnected” toast for that attempt. No model on the saved pedal: skip the attempt and do not toast.

The checkbox is the shadcn Checkbox primitive (added under `src/components/ui/`), rendered in `ScanPanel` above the Scan again footer. Checked means a startup pedal is saved, or the user has armed the next pick. Checking only arms; the next pick writes `startup`. Unchecking clears `startup`. The arm flag lives in `ConnectionStatus` so it still applies after the model ask.

Selecting the Bluetooth tab with a remembered pedal calls `discover({ interactive: false })` on the web (refresh granted devices, no picker). An empty Bluetooth list still starts an interactive scan, as today. Desktop select still scans; `interactive` stays ignored there.

### Docs

Apply updates the Connect sentences in `docs/architecture.md` so the modal remembers chosen pedals, the web picker lists without connecting, and an optional startup pedal connects on launch. Add the same constraint to the OpenSpec `context` field so a later agent does not restore one-click web connect.

## Risks / Trade-offs

- [Two pedals with the same label on one link collapse to one remembered row] → Acceptable for a single GP-5 or GP-50. Id match still wins when both ids are present.
- [Desktop USB index changes between launches] → Label match plus id rewrite. A renamed port is a different pedal.
- [`BluetoothDevice.forget()` missing in an older browser] → Dismissed-id fallback until the user picks that pedal in the picker again.
- [Startup connect runs while the user opens Connect manually] → The attempt is once, at launch, before the modal is the user's focus. A failure opens the modal; it does not start a second attempt.
- [Remembered pedal is powered off] → The row stays. Connect fails with the existing error toast (manual) or the favorite-pedal toast (startup).

## Migration Plan

No previous preferences document. First launch reads empty. Rollback is shipping the previous Connect UI; leftover `patone-preferences` is ignored by the old build.

## Open Questions

None. The checkbox targets the next pedal the user picks while it is checked, because the row click is still the connect action and the checkbox sits once above the footer rather than on each row.
