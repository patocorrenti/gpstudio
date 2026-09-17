## Why

After connect, Controller always shows patch `00` and numeric labels, even when the pedal is already on another preset with a name (`docs/architecture.md`). Users need the selector to match the pedal on USB and Bluetooth, and a short loading state while that identity is requested.

## What Changes

- After the Connect modal closes, the session stays connected and Controller MAY show an English loading state while it syncs initial patch identity.
- `DeviceSession` requests the current patch index and the onboard patch-name list over the open link (USB-MIDI or Bluetooth). It applies that identity to the snapshot. It still MUST NOT send patch recall solely because the session connected.
- Controller’s 00–99 selector shows the pedal’s current patch when known, and shows names in the list when the dump arrived. If a request times out or SysEx is unavailable, the selector stays usable with numbers and does not stomp the pedal with `00`.
- Pedal-initiated patch changes after sync update the snapshot index (and the known name). User-initiated previous / select / next still send official CC 0 through the existing encoder.
- Permanent protocol references land in `docs/` (and `docs/architecture.md`) for the third-party GP-5 / GP-50 web editors. Those pages are behavioral/runtime references only. Patone MUST NOT copy their source or SysEx payloads (`docs/architecture.md`).
- Architecture / OpenSpec context: applying inbound patch identity is in scope; the SysEx subset for current patch + names is a Patone-owned codec. Full preset dumps, IRs, NAM, and the editor stay later.

## Non-goals

- Full preset read/write, rename, reorder, module/parameter dumps, globals, IR / SnapTone / NAM (`docs/architecture.md`).
- Volume, module toggles, tuner, or GP-50 extras on either link.
- Copying reverse-engineered SysEx or JavaScript from third-party editors.
- Changing USB vs Bluetooth as interchangeable, or reverting Connect to USB-only.
- Mobile packaging.

## Capabilities

### New Capabilities

- `live-controller`: Controller empty state when disconnected; connected patch 00–99 previous / select / next; post-connect sync of current patch and names with a loading state. Not yet in `openspec/specs/` (the earlier `live-controller` change shipped the empty state and selector but was not archived).

### Modified Capabilities

- `device-connection`: Connecting still MUST NOT send patch recall by itself. After the modal closes, the connected session MAY sync patch identity while chrome already shows the device name.
- `inbound-log`: Log still records inbound MIDI only while visible and MUST NOT apply that traffic itself. `DeviceSession` MAY apply decoded patch identity to the snapshot independently of Log capture.

## Impact

- `src/device/session.ts`: connected snapshot gains sync status and optional names; inbound is parsed even when Log capture is off; connect starts a bounded sync.
- New device-layer codec (request/decode current patch + name list). Encoder still wraps Bluetooth as BLE-MIDI. USB still uses `MidiTransport.send`.
- `src/features/controller/ControllerPage.tsx`: loading while syncing; selector labels include names when present.
- `docs/architecture.md`, `openspec/config.yaml`, and a permanent protocol-references doc.
- Web MIDI already requests SysEx; if the host falls back to non-SysEx, sync fails open. No new Tauri commands or HTTP backend.
