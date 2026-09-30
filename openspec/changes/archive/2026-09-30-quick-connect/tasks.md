## 1. Preferences document

- [x] 1.1 Add `src/app/preferences.ts` with `patone-preferences` versioned JSON (`pedals` of `{ link, id, label, model? }`, `startup` of `{ link, id } | null`). Invalid JSON or an unknown version reads as empty. Remember, forget (and clear startup when that pedal was startup), set startup, and clear startup. Match a pedal by id, or by the same link and label, and rewrite a stored id when the label matches a new id. Leave `patone-theme` and the Controller panel key untouched. Verify with import-time asserts in that module (empty/invalid document, forget clears startup, label match rewrites a desktop-style `{index}::{label}` id) and `npm run build`.

- [x] 1.2 Add a pure merge of live endpoints plus remembered pedals for one link: no duplicates, remembered pedals absent from the live scan still appear, the other link's pedals stay out, and a just-forgotten pedal is omitted until chosen again. Verify with import-time asserts beside the preferences module and `npm run build`.

## 2. Bluetooth forget

- [x] 2.1 Add `forget(id)` on `BluetoothLink`. `WebBluetoothLink` calls `BluetoothDevice.forget()` when present, then drops that id from its map; if `forget` is missing, the preferences dismissed-id fallback hides it from passive `getDevices()` until an interactive picker returns it. `TauriBluetoothLink.forget` resolves with no Rust command. `DeviceSession.forgetBluetooth` delegates so Connect does not import the link. Verify `npm run build` and that `src/features/` does not import `@/bluetooth/web` or mention `BluetoothDevice`.

## 3. Connect UI

- [x] 3.1 In `ConnectionStatus`, stop calling `pickDevice` for a web picker `selectedId`. Remember that pedal and list it, leaving the session disconnected. Selecting Bluetooth with a remembered pedal uses `discover({ interactive: false })` on the web (no picker). An empty Bluetooth list still starts an interactive scan. Desktop select still scans. Verify by reading the scan path: picker success does not call `connect`, and `npm run build` passes.

- [x] 3.2 Add the shadcn Checkbox primitive under `src/components/ui/` using the existing `radix-ui` package. In `ScanPanel`, render “Always use this pedal and don't ask” at the bottom of the disconnected scan body, above the Scan again footer, disabled when the active tab lists no pedals. In `EndpointList`, remembered rows get a sibling remove button (not nested inside the row button) and the startup pedal shows “Preferred”. Verify the checkbox is absent from `ConnectedPanel` and `npm run build` passes.

- [x] 3.3 Remember a USB or desktop Bluetooth pedal when connect starts with a known model, including after the model ask; backing out of the model ask does not remember it. Remove forgets the pedal from the current list and from preferences, and clears startup when needed. While the checkbox is checked, that pick becomes the only startup pedal for the active tab's link; unchecking clears startup only. Verify the arm flag still applies after the model ask (code path in `ConnectionStatus`) and `npm run build` passes.

- [x] 3.4 On launch, if startup has a known model and the session is disconnected, try once to connect on that link without opening Connect and without the browser picker (resolve id, then label). Success keeps the existing connect promise toast. Failure shows one English toast, “Your preferred pedal failed or is not connected.”, opens Connect on that tab, and does not also show the manual connect error toast or “Pedal disconnected”. No known model skips the attempt with no toast. Verify the failure path cannot emit both toasts (single `toast.promise` error string plus `setOpen(true)`) and `npm run build` passes.

## 4. Docs

- [x] 4.1 Update the Connect sentences in `docs/architecture.md` and the OpenSpec `context` field so the modal remembers chosen pedals, the web picker lists without connecting, and an optional startup pedal connects on launch. Verify those sentences no longer tell an agent to connect straight from the browser picker.
