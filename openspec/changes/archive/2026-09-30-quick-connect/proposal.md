## Why

USB pedals show up in the Connect list as soon as they are detected. Bluetooth on the web does not: choosing a pedal in the browser picker connects immediately, and the next launch makes the user open that picker again. Remembering chosen pedals, and optionally connecting to one of them at startup, removes that step on web and desktop.

## What Changes

- Remember pedals the user has chosen, on USB and on Bluetooth, and show them again on the matching Connect tab the next time the app opens. The list is the remembered pedals plus whatever the current scan finds. A remembered pedal stays listed even when it is not detected right now.
- Each remembered pedal has a remove control. Removing it forgets that saved pedal. A later scan can list it again, and choosing it remembers it again.
- **BREAKING** (web): choosing a pedal in the browser Bluetooth picker no longer connects. The pedal is remembered and listed, and the session stays disconnected until the user picks it in the Connect list, the same as desktop Bluetooth and USB.
- Add one English checkbox at the bottom of the disconnected Connect body, above the Scan again footer: “Always connect this way, don't ask again”. Checking it does not connect. The next pedal the user picks, on the tab that is selected then, becomes the single startup pedal for that link. Unchecking clears only that startup choice. The remembered list stays.
- On the next launch, if a startup pedal is saved, the app tries to connect to it on that link without opening Connect first. Success keeps today's connect toast. Failure shows one English toast that the favorite pedal failed or is not connected, then opens Connect on that pedal's tab. That attempt does not open the browser Bluetooth picker.
- Store this in `localStorage`, which the web app and the Tauri webview both keep across restarts. Theme already uses that store through next-themes (`patone-theme` in `src/app/App.tsx`). This change adds a separate preferences document so later user settings can live there. Theme stays where it is.

## Non-goals

- Moving theme, or the Controller expanded-panel memory, into the new preferences document.
- Syncing preferences across machines, accounts, or a backend. There is no HTTP backend (`docs/architecture.md`).
- Treating USB and Bluetooth as interchangeable, or dropping either tab.
- Auto-connecting to every remembered pedal. At most one startup pedal.
- Revoking OS Bluetooth pairing. On the web, forget only the app's saved pedal (and the browser's device permission when the API allows it).
- A connect button separate from the pedal row. Picking a listed pedal still connects, after the model is known, as today.
- Editor, Library, SysEx, or mobile packaging.

## Capabilities

### New Capabilities

- None. Remembered pedals and the startup choice are Connect behavior.

### Modified Capabilities

- `device-connection`: The Connect lists persist chosen USB and Bluetooth pedals; the user can forget one; the web Bluetooth picker lists without connecting; an optional startup pedal connects on launch or, on failure, toasts and opens Connect.

## Impact

- `src/features/connect/` (`ConnectionStatus`, `ScanPanel`, `EndpointList`): merge remembered pedals into each tab, remove control, checkbox, startup attempt, and stop treating the web picker choice as an immediate connect.
- A small preferences module read from Connect (not `DeviceSession`, not a new session sibling). `localStorage` only. No new Tauri commands and no change to MIDI or GATT codecs.
- Web Bluetooth may call `forget()` on a removed device so a later passive `getDevices()` does not put it back. Desktop Bluetooth and USB forget by dropping the saved record.
- `openspec/specs/device-connection/spec.md` after archive. `bluetooth-link` stays: an interactive web discover may still report which pedal the picker returned, so Connect can remember it. `docs/architecture.md` only if the agreed Connect behavior sentence needs the remembered list and the optional startup pedal.
