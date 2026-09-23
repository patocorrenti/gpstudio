## Why

GP Studio already edits GP-50 device globals from the Global settings modal. A connected GP-5 still has no Global control: `pedal-global-settings` left those rows out until a GP-5 source locked the read and the writes. The local GP-5 editors (`_reference/GP5bluetooth.html`, `_reference/gp5usb.html`) request the same globals ask and edit a smaller set than the GP-50 menu. Those rows should use the same modal, and only the ones those editors can actually control.

## What Changes

- A connected GP-5 session requests the globals dump once per connect (same ask envelope as GP-50, after the first current-preset dump, no waiter) and exposes the decoded fields on USB and Bluetooth.
- The existing Global control and Global settings modal appear for GP-5. Layout and immediate-write behavior match GP-50. The modal lists only GP-5 rows the reference editors control:
  - Global volume (0–100), first, same place as GP-50 master volume
  - Input level, No CAB, REC level, BT REC, monitor level
  - Screen brightness (1–100), present in the Bluetooth editor
  - Footswitch mode: `0-99`, `0-9`, `A-Z`, `CTL`, `Tuner`
- GP-5 does not show REC mode, Patch | Stomp, or a CC 1 master slider. GP-50 rows, CC 1, and CC 28 stay as they are.
- Writes go through `DeviceSession` immediately and do not mark the working patch modified. Bluetooth applies the GP-5 live reports those editors handle. USB does not.
- GP-5 effect/flag pairs and the footswitch family are not the GP-50 pairs. A GP-50 globals payload must not be decoded as GP-5, and the reverse.

## Non-goals

- REC mode left/right, GP-50 master volume (CC 1), and GP-50 Patch | Stomp (CC 28) on a GP-5.
- The editors' Global BPM switch. It rewrites delay time; it is not a device global and stays off the modal and off the patch bar.
- Menu rows neither editor controls: language, factory reset, About, song-list CC 29 and 30, and the GP-50-only GLOBAL rows already omitted (EXP calibrate, bypass type, EXP/FS assign, MIDI routing, Auto CAB).
- Pasting JavaScript from `_reference/` into `src/`. Codecs stay Patone-owned (`docs/architecture.md`).
- Re-requesting globals on Reload or patch change. Library, IR/NAM upload, and tuner stay out.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `device-connection`: A GP-5 session reads and writes its own globals. It must not send CC 1 or CC 28 for them, and it must not treat a GP-50 dump as GP-5 values.
- `live-controller`: The Global settings modal lists the GP-5 rows above and hides every GP-50-only row.

## Impact

- `src/device/globals.ts` and `src/device/session/globals.ts`: GP-5 dump classification, offsets, live reports, and SETs beside the GP-50 codec.
- `src/device/session/device-session.ts`: send the existing globals ask on GP-5 as well; snapshot starts empty GP-5 globals instead of `null`.
- `src/features/connect/GlobalSettingsModal.tsx`: same modal, model-specific rows.
- `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md`: GP-5 globals that those editors control are in scope. USB still does not apply live inbound globals.
