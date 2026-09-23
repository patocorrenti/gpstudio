## Context

See proposal.md for why. The patch bar already edits the working patch through `DeviceSession`. Patch volume and BPM are already words in the current-preset dump and in the `.prst` descriptor (`src/device/patch-store.ts`: GP-50 dump volume at 100, BPM at 110; GP-5 shifted by the existing dump offset). Upload already writes those words with parameter-write family `1142`. The published MIDI lists are different: both manuals assign patch volume to CC 7 (0–100); only the GP-50 list assigns absolute tempo to CC 73 + CC 74 (40–260). `src/device/cc.ts` already has CC 7 as volume, and incorrectly names GP-50 CC 21 `bpm`. The manual assigns CC 21 to a one-step patch-volume nudge and CC 19 to a one-step BPM nudge.

## Goals / Non-Goals

**Goals:**

- Bar controls send the official CC from the manuals, on USB and Bluetooth, through the existing encoder (`midiCc` + BLE-MIDI wrap).
- Snapshot and the modified baseline include those values, read from the dump the session already stores.
- Download of an edited patch carries the edited volume and, on GP-50, BPM.

**Non-Goals:**

- Switching `.prst` upload off family `1142`.
- Sending CC 17, CC 19, or CC 21.
- Following inbound CC 7 / 73 / 74. Bluetooth live patch-volume SysEx is applied.

## Decisions

### 1. Live writes are CC 7 and CC 73/74, not family `1142`

The bar calls new encoders. Keep `encodePatchVolume` / `encodePatchBpm` (SysEx `1142`) for upload only.

Alternative: reuse `1142` for the bar, since upload already sends it. Rejected. The request is the manual MIDI list. The `1142` BPM body is one byte and rejects 256–260, which CC 73/74 can express (`CC 73 = 2`, `CC 74 = BPM − 256`).

Tempo for one edit is two messages, CC 73 then CC 74, each wrapped like any other CC on Bluetooth:

- 40–127 → CC 73 = 0, CC 74 = BPM
- 128–255 → CC 73 = 1, CC 74 = BPM − 128
- 256–260 → CC 73 = 2, CC 74 = BPM − 256

`gp5Cc.volume` stays 7. Replace the `gp50Cc.bpm = 21` meaning: CC 73 and CC 74 are the tempo pair. Leave CC 19 and CC 21 named as unused step controllers so a later reader does not point BPM at CC 21 again.

### 2. Snapshot values come from the dump words already used by `.prst`

When a current-preset dump is applied, read patch volume (and GP-50 BPM) with the same packed-word offsets as `patch-store`. Out of range or missing means `null`: the control stays disabled and nothing is sent. GP-5 does not expose BPM.

`SessionSnapshot` gains `patchVolume: number | null` and `patchBpm: number | null` (GP-5 BPM stays `null`).

The modified baseline becomes the chain plus those values. Equality is the existing chain compare plus volume, plus BPM on GP-50. Save / rename recapture that whole baseline.

### 3. Throttle matches slot sliders

Reuse `CONTROL_WRITE_THROTTLE_MS` (80) and flush-on-release, with keys that cannot collide with slot controls (`patch-volume`, `patch-bpm`). The UI updates the snapshot on-change; the session sends the coalesced CC.

### 4. Download keeps the edited words

Download still re-requests the current-preset dump and still does not recapture the baseline. If the working patch is modified, write the snapshot volume and GP-50 BPM into that dump’s word slots before `encodePrstFile`, and leave the on-screen values alone. If it is not modified, the dump words are both the file and the snapshot.

Alternative: encode the dump already in memory and skip the re-request. Rejected. The current download contract refreshes the chain from the pedal; overlaying two words is the smaller change.

### 5. Controls sit in the patch bar

`PatchBar` (or a sibling file under `src/features/controller/` if the dialogs make the bar hard to read) renders shadcn `Slider`s labeled `P-Vol` and `BPM`. Pass the snapshot fields in from `ControllerPage`. Disabled when the value is `null` or the patch is syncing. No `src/components/` domain folder. Layout inside the bar is provisional.

## Risks / Trade-offs

- [CC 7 updates the pedal’s sound but the next dump still has the old volume word] → Download overlays the snapshot value when modified, so the file and the bar keep the edit. Save still stores whatever the pedal’s working buffer holds; if a pedal ignores CC 7 until Save, that shows up in device testing, not as a second protocol in this change.
- [Two tempo CCs on Bluetooth are two GATT writes] → Same wrap as other CCs; the throttle already exists so a drag does not emit a pair per step.
- [`1142` upload and CC live edits can diverge for BPM above 255] → Upload stays as it is. The bar can send 256–260. Do not widen the `1142` encoder here.
- [GP-5 dumps also contain a BPM word] → Ignore it for the snapshot and for modified. Do not send CC 73/74 to a GP-5.

## Migration Plan

No stored data migration. Update `docs/architecture.md`, the `context` in `openspec/config.yaml`, and `docs/protocol-references.md` in the same work: patch-bar volume (CC 7) and GP-50 BPM (CC 73/74) are in scope; inbound volume/BPM still are not; family `1142` stays the upload path. The GP-50 CC list must not call CC 21 BPM.

## Open Questions

None. Spacing inside the bar can change later without a new protocol.
