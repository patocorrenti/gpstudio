## Context

See `proposal.md` for why. Chrome on Linux now lists GATT (2026-09-17). Control UUIDs are locked from that Patone log. USB patch CC 0 is unchanged. Bluetooth `encodePatch` wraps the same CC 0 in an MMA BLE-MIDI packet. Desktop BlueZ may still fail to bind the characteristic; web is the working send path on this host.

## Blocker (2026-09-16, Linux / BlueZ / btleplug 0.11)

Operator: GP-5 (or GP-50) at `DD:EA:83:78:96:F8`, native Patone window (`npm run tauri dev` → `target/debug/app`), **not** Chrome at `localhost:1420`. Pairing via `bluetoothctl pair` / `trust` succeeded after putting the pedal in pairing mode. Earlier `connect` failed with BlueZ **Authentication failed** until that pairing.

Patone scan finds the pedal. `ble_open` connects. Advertisement (from `peripheral.properties().services`, our capture) always includes:

- `03b80e5a-ede8-4b33-a751-6ce34ec4c700` — official BLE-MIDI service (MMA). This **contradicts** `docs/architecture.md` “pedal Bluetooth is not class-compliant BLE-MIDI”. Follow the capture, not that sentence, until proven otherwise.
- `00001800-0000-1000-8000-00805f9b34fb` — GAP
- `0000080b-0000-1000-8000-00805f9b34fb` — 16-bit `0x080B`, unknown; do not invent a characteristic for it

`peripheral.discover_services()` then `peripheral.services()` stays **empty for 20 attempts** (~10s) after connect. Latest log:

```
already connected; disconnecting so BlueZ can open GATT (not classic audio)
starting scan while connecting
connecting DD:EA:83:78:96:F8
connected
advertised services: 0000080b-…, 00001800-…, 03b80e5a-…
discover attempt 1..20: 0 service(s)
```

Dump file: `src-tauri/gatt-map.log`. Console prefix: `[patone][gatt]`.

Tried and still empty:

1. `log::info` (does not show in `tauri dev` terminal) → `eprintln` + file dump
2. Retry `discover_services` while empty
3. Reuse `Manager`/`Adapter` across scan and open
4. Skip `connect()` when BlueZ already reports connected (likely classic audio after `bluetoothctl`) → now disconnect, start scan, connect again. Still 0 GATT.

`btleplug` BlueZ `discover_services` only introspects D-Bus `serviceXXXX` nodes (`bluez-async` `get_services`). `connect()` already waits for `ServicesResolved`. If that fires with no GATT children, we get this log.

Do **not** copy characteristic UUIDs from third-party editors. The MMA BLE-MIDI I/O characteristic `7772e5db-3868-4112-a1a9-f2669d106bf3` is public spec for service `03b80e5a-…`, but it is **not** confirmed on this pedal because the GATT tree never appeared.

### Chrome Web Bluetooth result (2026-09-16, same Linux host)

Patone web (`npm run dev` → Chrome `localhost:1420`) with `optionalServices` = the three advertised UUIDs. Chooser works; `gatt.connect()` succeeds. Then:

```
[patone][gatt] could not list GATT services NotFoundError: No Services found in device.
```

Same empty GATT as BlueZ+btleplug. That log came from `getPrimaryServices()` (list all). Chrome on Linux often throws that even when `getPrimaryService(uuid)` works for a UUID listed at chooser time.

### Chrome spike (2026-09-17)

Accessed [GP5 Editor](https://rvalladares.com/gp5/gp5editor/) (single HTML, inline JS; `view-source:` is not required). Connection method only — do **not** copy its SysEx payloads.

How that page opens GATT:

- `requestDevice({ filters: [{ services: [BLE-MIDI service] }] })` — filter by advertised service `03b80e5a-…`, not by name. Forces the LE/GATT identity instead of the dual-mode audio one.
- `gatt.connect()` then `getPrimaryService(that UUID)` then `getCharacteristic(…)`. Never calls `getPrimaryServices()`.
- The characteristic it binds is the public MMA BLE-MIDI I/O UUID `7772e5db-3868-4112-a1a9-f2669d106bf3`. Still **not** locked for Patone until our own Chrome/desktop log lists it.
- Writes are `writeValueWithoutResponse`. Payloads are SysEx (out of scope). Prefix `80 80` is standard BLE-MIDI timestamps, not a Valeton-only header.

Patone web now matches that connection path without copying their protocol:

- Chooser filters AND name prefix with advertised BLE-MIDI service (plus the other advertised UUIDs in `optionalServices`).
- After connect, log `getPrimaryServices()` **and** `getPrimaryService` per advertised UUID, then list characteristics.

Operator A/B on this Linux Chrome:

1. [GP5 Editor](https://rvalladares.com/gp5/gp5editor/) Connect — if that page also fails, the host/BlueZ GATT tree is empty and no web app can proceed.
2. Patone `npm run dev` → console `[patone][gatt]` — look for `getPrimaryService 03b80e5a-…` succeeding and any characteristic lines.
3. If the chooser is empty after the AND filter, retry with the editor’s services-only filter.

Patone Chrome (2026-09-17, `GP-50 Pato BLE`) listed GATT. Locked from that log (not a third-party editor):

- Service `03b80e5a-ede8-4b33-a751-6ce34ec4c700` (MMA BLE-MIDI)
- Characteristic `7772e5db-3868-4112-a1a9-f2669d106bf3` `[read, write-without-response, notify]`
- GAP `00001800-…` / `00002a00-…` is Device Name, not control
- Advertised `0000080b-…` is not a GATT service (`NotFoundError`)

Shared constants: `src/bluetooth/uuids.ts` and `src-tauri/src/ble.rs`. Bluetooth `encodePatch` wraps official CC 0 as BLE-MIDI (`80 80 B0 00 patch`). USB stays raw CC 0.

### Earlier Linux / BlueZ notes

1. `bluetoothctl info`: often `Connected` + `ServicesResolved` with **zero** D-Bus `serviceXXXX` children; journal `error updating services: Host is down (112)`.
2. `list-attributes` empty. `ConnectProfile(BLE-MIDI)` → `br-connection-profile-unavailable`.
3. Pedal has separate identities: `…96:F8` “GP-50 Pato BLE” vs `…36:F8` “GP-50 Pato Audio”.
4. If a writable characteristic is ever confirmed elsewhere, implement `ble_send` + web write. First payload remains official CC 0 via `encodePatch`. If the char is BLE-MIDI I/O, wrap MIDI in BLE-MIDI packets at the encoder/link seam (not a third-party SysEx copy). USB encode path must stay raw CC 0.

## Goals / Non-Goals

**Goals:**

- Real `BluetoothLink.send(bytes)` on web and desktop (not a throwing stub).
- `open` selects the control characteristic so `send` has somewhere to write.
- `DeviceSession` encodes patch recall and routes bytes by `linkMode`.
- `commandToPedal` true on Bluetooth; Controller reuses the USB patch bar.
- Discover the GATT map from Patone (desktop first) and, if needed, Valeton Suite traffic.

**Non-Goals:**

- Folding GATT into `MidiTransport` or leaking Web Bluetooth types above the link.
- Applying notifications to the session patch (`liveFromPedal` stays unused).
- A product GATT browser. Capture output is debug logs / `tauri dev` console.
- Copying framing from third-party editors.

## Decisions

### 1. Byte pipe on `BluetoothLink`; encoder stays in `DeviceSession`

**Choice:** Extend the contract to `discover` / `open` / `send` / `close`. `send(bytes)` writes those bytes to the open control characteristic. `setPatch` / `stepPatch` keep computing the patch index, then call `bluetooth.send` when `linkMode` is Bluetooth and `transport.send` when it is USB. First Bluetooth payload is the same official CC 0 frame as USB. If captures show a different frame, replace only the Bluetooth encode path in the device layer (for example `encodePatch(linkMode, patch)`), not the GATT backends.

**Why:** `docs/architecture.md` — if BLE cannot speak CC, the encoder (CC vs SysEx) is the seam. The link must not learn patch numbers.

**Alternative:** `BluetoothLink.sendPatch(n)` that owns GATT framing. Rejected; it forks protocol into the link.

**Alternative:** A throwing `send()`. Rejected; that stub was forbidden, and this change is the real encoder.

### 2. Desktop GATT map first, then lock UUIDs, then Web Bluetooth

**Choice:** Spike on desktop: `ble_open` connects, `discover_services`, and logs each service/characteristic UUID plus properties (read/write/notify). Operator captures from Patone trial writes and, if the pedal ignores CC 0, from Valeton Suite (official app) via a BLE sniffer. Record the control characteristic UUID as a constant shared by Rust and TypeScript. Web `requestDevice` then adds that UUID to `optionalServices` so `getPrimaryService` works. Do not guess UUIDs from third-party editors.

**Why:** Web Bluetooth will not expose a service unless it was listed in `optionalServices` at chooser time. `btleplug` can list everything after connect. Desktop is the only way to learn the map without already knowing it.

**Alternative:** Web-only discovery. Rejected; Chrome will hide the control service.

**Alternative:** Scan with a wildcard / all services. Rejected; Web Bluetooth has no “all services” option.

### 3. `open` binds the write characteristic; `send` only writes

**Choice:** After connect, `open` discovers services, finds the documented control characteristic, and keeps that handle until `close`. `send` fails if nothing is open. Prefer write-without-response when the characteristic allows it (command-out, lower latency); otherwise write-with-response. Write type is confirmed in the spike, not guessed here.

**Why:** Specs require send on an open session and fail when closed. Binding at `open` keeps `send` a byte write on both backends.

**Alternative:** Look up the characteristic on every `send`. Rejected; extra GATT round-trip on every patch step.

### 4. Flip `commandToPedal`; do not fork Controller

**Choice:** `capabilitiesForLink("bluetooth").commandToPedal = true`. Controller already hides the patch bar when that flag is false; it will show the same bar as USB. Snapshot still starts at patch `00` and does not send on connect.

**Why:** Matches USB live-controller behavior and the device-connection delta. `liveFromPedal` can stay true for later work; this slice does not apply inbound bytes to `snapshot.patch`.

**Alternative:** A Bluetooth-specific Controller screen. Rejected; links are a capability mask (`docs/architecture.md`).

### 5. Architecture and OpenSpec context catch up

**Choice:** Update `docs/architecture.md` and `openspec/config.yaml` so `BluetoothLink` includes `send`, this encoder is in scope, and copying third-party SysEx stays forbidden. Phase-1 “no encoder” rules must not survive this change.

**Why:** Later proposals still read those files; `bluetooth-connect` did the same when GATT connect became real.

## Risks / Trade-offs

- [Web Bluetooth cannot list services until UUIDs are known] → Desktop spike first; then add `optionalServices` and re-test Chrome.
- [Official CC 0 written to GATT does not change the pedal] → Iterate with Patone notify/write captures, then Valeton Suite sniff; change only `encodePatch` for Bluetooth.
- [Characteristic is notify-only or needs a handshake before writes] → Spike logs properties; if a enable-notify or “start” write is required, do it in `open`, not in Controller.
- [Payload larger than ATT MTU] → Spike records size; split only if captures show chunking. CC 0 is three bytes if that attempt works.
- [Operator copies ToneLib / other editor SysEx] → Tasks and architecture say Valeton Suite + Patone only.
- [Displayed `00` may not match the pedal] → Same as USB; do not send on connect.
- [No in-browser verification] → `tsc`; operator tests patch bar on a real GP-5/GP-50 over Bluetooth (web and desktop).

## Migration Plan

Additive. USB path untouched. Rollback is reverting the change. After the spike, commit the UUID constant and encode path together so web/desktop do not ship `send` against an unknown characteristic.

## Open Questions

- Whether BLE-MIDI-wrapped CC 0 actually changes the pedal patch (operator test in Chrome).
- How to make BlueZ expose GATT for this dual-mode pedal so desktop `ble_send` can bind the same characteristic.
