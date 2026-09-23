## Why

Controller can edit the current patch’s chain, but not its patch volume or tempo. Both values are stored in the patch (`docs/architecture.md` lists official volume CC; the GP-50 manual also publishes tempo). The user needs those controls on the patch bar now; visual placement can be refined later.

## What Changes

- After the patch bar is shown, Controller shows a **Patch volume** control for GP-5 and GP-50. Range is 0–100. Writes go through `DeviceSession` as official **CC 7** (value 0–100), the same on USB and Bluetooth. React does not send raw MIDI.
- On GP-50 only, the same bar shows a **Patch BPM** control. Range is 40–260. Writes go through the session as official **CC 73 + CC 74** (tempo MSB / LSB from the GP-50 MIDI list). GP-5 has no tempo CC in its manual, so that control is absent.
- Displayed values come from the current-preset dump the session already requests (the same dump words `.prst` already uses). The controls stay unusable until that value is known, so a default is never sent over the real patch. A later dump replaces them only while the working patch is still unmodified, matching chain refresh. A user edit updates the snapshot, the in-memory dump used by download, and `modified`.
- Slider drags coalesce writes (throttle and flush on release), the same way effect sliders avoid flooding Bluetooth.
- `src/device/cc.ts` currently labels GP-50 CC 21 as BPM. The GP-50 manual assigns CC 21 to a relative patch-volume step and absolute tempo to CC 73/74. This change corrects that map for the new writes. Relative step CCs stay unused.

## Non-goals

- Master volume (GP-50 CC 1), relative one-step CCs (CC 17 master, CC 19 BPM, CC 21 patch volume), tap tempo (CC 75), tuner (CC 58), and Patch/Stomp mode (CC 28).
- Applying inbound volume, BPM, or tuner to the snapshot while the patch stays the same. USB stays one-way for live knobs (`docs/architecture.md`).
- A GP-5 BPM control. The GP-5 MIDI list has patch volume and no tempo CC.
- Replacing the existing parameter-write family `1142` used when a `.prst` upload applies descriptor volume/BPM. Live bar controls use the official CC above; upload keeps its current writes.
- A finished layout. Controls live in the patch bar; spacing and grouping can change later without a new protocol.
- Library browse/import, IR/NAM file upload, Editor, copied third-party SysEx, or mobile packaging.

## Capabilities

### New Capabilities

- None. This is the live-controller volume/BPM slice already named in `docs/architecture.md`, not a new spec domain.

### Modified Capabilities

- `live-controller`: The patch bar includes Patch volume (GP-5 and GP-50, 0–100) and Patch BPM (GP-50 only, 40–260). Both wait until the current-preset dump supplies a value, then edit through the device session. The same controls are used on USB and Bluetooth. GP-5 does not show BPM. Layout inside the bar is not specified beyond being on that bar.
- `device-connection`: The connected snapshot carries patch volume (both models) and patch BPM (GP-50). The session sends official CC 7, and on GP-50 official CC 73+74, without an extra patch recall or chain dump. Those values join the working-patch baseline, so a difference sets `modified` and download matches the edit. Inbound live volume/BPM still does not update the snapshot while the patch stays the same.

## Impact

- `src/features/controller/PatchBar.tsx` (and `ControllerPage.tsx` only if the bar needs the new snapshot fields): English volume and BPM controls. No raw MIDI.
- `src/device/cc.ts`, `src/device/encode.ts`, `src/device/session.ts`: official CC map, BLE-MIDI wrap of those CCs, snapshot values from the existing dump, baseline comparison, dump-word update for download.
- `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md`: patch-bar volume/BPM are in scope; the GP-50 CC list matches the manual (CC 7 volume, CC 73/74 tempo). The `1142` upload path stays as documented.
