## Context

See `proposal.md` for why. Connect already has USB | Bluetooth tabs (`ConnectionStatus`). USB uses `MidiTransport` (Web MIDI / Tauri `midir`). Bluetooth is still copy-only. `DeviceSession.connect()` always opens USB-MIDI and sets `linkMode: "usb"`. `setPatch` sends CC 0 on that pipe. WebView2 does not expose Web Bluetooth; Chrome does. Pedal Bluetooth is Valeton Suite GATT, not a `usb-midi` kind (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- Parallel web vs desktop Bluetooth backends behind one TypeScript contract (`discover` / `open` / `close`).
- Session can be connected on that contract with `linkMode: "bluetooth"` without opening USB-MIDI.
- Patch CC stays on the USB path; Bluetooth connect does not grow a throwing `send()`.

**Non-Goals:**

- Characteristic writes, SysEx framing, BLE-MIDI packets, or any control encoder.
- Folding GATT into `MidiTransport`.

## Decisions

### 1. Separate `BluetoothLink` from `MidiTransport`

**Choice:** New contract next to `src/midi/`: `discover()` → endpoints (`kind: "bluetooth"`), `open(id)`, `close()`. No `send`. `DeviceSession` keeps using `MidiTransport` for USB and the new link for Bluetooth. Snapshot `endpoint` stays `{ id, label, kind, suggestedModel? }` with `kind` widened.

**Why:** `docs/architecture.md` — Bluetooth is not another USB-MIDI backend. A `send()` that throws would be the stub that change forbade.

**Alternative:** Add `kind: "ble"` to `MidiTransport` and no-op `send`. Rejected; callers would think CC 0 goes out.

### 2. Web Bluetooth vs native BLE (same split as MIDI)

**Choice:** Browser: Web Bluetooth (`navigator.bluetooth`). Desktop: Rust BLE via Tauri commands/events (`btleplug`), not the WebView. Filter advertised names with the existing GP-50-before-GP-5 heuristic (plus a Valeton-looking name so a pedal still appears when the model string is missing). Optional services / GATT writes stay out; `open` is a connection to the peripheral.

**Why:** Matches `detect.ts` (web vs Tauri). WebView2 has no Web Bluetooth.

**Alternative:** Desktop-only. Rejected; USB already has both runtimes.

### 3. Session API branches on kind, not a second UI stack

**Choice:** `connect(endpoint, model)` uses `endpoint.kind`. USB opens MIDI and sets `linkMode: "usb"`. Bluetooth opens GATT and sets `linkMode: "bluetooth"`. `disconnect` closes whichever is open. `capabilitiesForLink` gains `commandToPedal: true` on USB, `false` on Bluetooth. Controller reads that flag and does not offer working patch controls. `setPatch` / `stepPatch` refuse when `commandToPedal` is false so a stray click cannot hit USB-MIDI.

**Why:** One session; later encoder flips `commandToPedal` (and likely adds `send` on `BluetoothLink`) without forking Controller.

**Alternative:** Keep Controller sending CC and swallow errors. Rejected; looks like the pedal took the patch.

### 4. Scan stays on the Bluetooth tab

**Choice:** Bluetooth `discover` runs only while that tab is active (same pattern as USB). Refresh restarts the scan. Empty and permission errors are English and tab-local. USB `midir` commands and permissions stay unchanged; add a separate BLE allow-list.

**Why:** Switching tabs must not mix MIDI ports into the Bluetooth list.

**Alternative:** Continuous background scan. Rejected; extra radio use and mixed lists.

### 5. Architecture doc

**Choice:** Replace “Bluetooth tab is not available yet / no GATT” with: Connect can open Valeton Suite GATT; control encoding is a later change; do not copy third-party SysEx.

**Why:** Later proposals must not re-assert the UI-only tab.

## Risks / Trade-offs

- [Windows Bluetooth permission / adapter off] → English error; session stays disconnected; Refresh retries.
- [Web Bluetooth needs a user gesture and Chromium] → Scan starts from the tab/Refresh click; non-Chromium gets the unavailable error.
- [Advertised name is generic] → Same model-confirm dialog as USB.
- [User connects Bluetooth and expects patch changes] → Disabled/non-working patch copy; encoder is a later change.
- [Opening GATT without a known service UUID may still succeed as a connection] → Treat peripheral connect as enough for this slice; service map waits for the encoder change.

## Migration Plan

Additive backend + Connect tab wiring. USB path untouched. Rollback is reverting the change. No MIDI wire format change.

## Open Questions

None that block this slice. GATT service/characteristic map is for the encoder change, from our own captures, not third-party SysEx dumps.
