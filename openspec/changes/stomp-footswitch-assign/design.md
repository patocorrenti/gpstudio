## Context

See `proposal.md` for why. The current-preset dump already runs after identity and on patch change. `ChainDecoder` today reads order, on/off, models, and controls — not stomp assignment. Footswitch follow already toggles NR…NS on Bluetooth; assignment is which modules those presses affect.

Prior lab `openspec/changes/stomp-assignment/` locked GP-50 dump offsets (1006 / 1014) and live notify command `0D`, then failed every guessed SET (live `0D` echo, host `0D`, H7 with wrong size/command/body). Product UI was rolled back. That folder is the anti-pattern notebook: do not retry W1–W3, panel H1–H4, or H7 as-is.

Since then Patone owns the parameter-write family (path `01 01 04`, CRC-8 ATM + nibble-expand) for chain-order, model `1147`, control `1148`, store `114a`, and globals. Local reference editors (`_reference/GP50-USB.html`, `gp5usb.html`, `GP5bluetooth.html`) use the same framing for stomp assignment as packed family **`114d`**: one footswitch index, one effect index, 0|1. That is the write this change encodes as a Patone-owned codec — read the reference for wire shape; do not paste its JavaScript (`docs/protocol-references.md`).

## Goals / Non-Goals

**Goals:**

- Decode stomp assignment from the dump we already request; put it on the snapshot.
- Encode and send a `114d` per-effect SET on assign/clear; USB and Bluetooth (`commandToPedal`).
- Controller UI: one stomp (GP-5) or two (GP-50); EXP never assignable.
- Document the slice in architecture / context; retire “paused only” copy.

**Non-Goals:**

- A second dump request, full preset write, or Patch/Stomp mode gating of the UI.
- Copying reference source or retrying failed spike envelopes.
- Treating live `0D` as a SET (it is notify-only; apply only after SET works, and only on Bluetooth).

## Decisions

### 1. Same dump, snapshot `stomps: EffectId[][]`

**Choice:** Extend the existing chain-dump parse. Snapshot grows `stomps` with length 1 (GP-5) or 2 (GP-50). Each inner list is the modules that stomp toggles. Empty list is valid. Missing dump → empty lists, no write. Patch change replaces assignment from the new dump.

**Offsets (locked / reference-aligned):**

| Model | Stomp | Mask bytes (enable-style nibbles) |
| --- | --- | --- |
| GP-50 | 1 (A) | 1006 CAB/EQ/MOD/DLY, 1007 NR/PRE/DST/AMP, 1009 RVB/NS |
| GP-50 | 2 (B) | 1014 / 1015 / 1017 (stride 8) |
| GP-5 | 1 | 920 / 921 / 923 (same 86-byte front shift as other GP-5 dump fields) |

EXP is never in the mask. Same bit layout as module enable masks in the dump.

**Why:** Specs require using the dump already in the pipeline. Patone dump diffs and the reference editors agree on these offsets.

**Alternative:** Dedicated SysEx ask for stomps. Rejected; extra round-trip.

### 2. Write is parameter family `114d`, not live `0D`

**Choice:** Patone-owned encoder parallel to model/control SETs:

- Packed body: size `0x05`, family `11 4d`, then footswitch `0|1`, effect index `0`–`9`, value `0|1`.
- CRC-8 ATM (poly `0x07`, init 0) + nibble-expand; SysEx path `01 01 04` after expand (`src/device/sysex-nibble.ts`).
- Effect index map (CTL order, **not** UI chain order): `0` NR, `1` PRE, `2` DST, `3` AMP, `4` CAB, `5` EQ, `6` MOD, `7` DLY, `8` RVB, **`9` NS**.
- GP-5: always footswitch `0` (single stomp). GP-50: `0` = A, `1` = B.
- One SET per checkbox flip (assign or clear), not a 30-byte mask poke.
- BLE-MIDI wrap on Bluetooth via the existing link encoder; send as one GATT write (same rule as other SETs — do not chunk).

**Why:** Reference editors move the pedal with this shape. Spike H7 guessed command `0D` / wrong body and was ignored. Live `0D` is pedal→app notify only (spike captures).

**Alternative:** Echo live `0D` or host dump-offset poke. Rejected; already failed in the lab.

**Confirm:** Operator assigns DST on stomp 1 over USB, Log shows Patone’s `114d` frame, dump 1006/1014 (or GP-5 920) matches. Refine only if the pedal still ignores — then capture an accepted app→pedal frame; do not invent a third family.

### 3. Optimistic edit, no chain overlay

**Choice:** Session API updates `stomps` then sends the SET. Do not call `refreshChain` / set `chainSync: "syncing"`. Module on/off and footswitch follow stay on `chain[].enabled`.

**Why:** Assignment is not on/off; specs forbid busy overlay solely for this edit.

### 4. Count from model, not from Patch/Stomp mode

**Choice:** GP-5 always one stomp UI; GP-50 always two. Do not gate on CC 28 or GP-5 footswitch mode. The pedal only *uses* assignments in Stomp (or CTL) mode; users still need to edit the map before switching.

**Why:** Specs require count by model. Mode UI already exists separately in Global settings.

### 5. USB one-way for live assignment; Bluetooth notify optional after SET works

**Choice:** USB never applies unsolicited assignment frames. Bluetooth may decode live command `0D` (spike map: stomp masks in the 30-byte envelope) into `stomps` only after the SET path is accepted; until then dumps after patch change are source of truth. `liveFromPedal` stays Bluetooth-only.

**Why:** USB is not duplex. Do not apply inbound `0D` while write is unproven (avoids fighting a silent SET with stale notify).

### 6. Placement

**Choice:** Decode/encode in `src/device/chain-codec.ts` (or a thin sibling if the file is already hard to navigate — only if needed). Session façade in `src/device/session/`; writes beside other throttled/command-out SETs. Controller UI under `src/features/controller/` as a sibling (e.g. Patch Settings-style chips), not under `src/components/`.

**Why:** Matches device-session and feature-UI workspace rules. Assignment is current-patch dump + SET, not Connect chrome.

### 7. Prior change stays a lab

**Choice:** Do not archive or delete `stomp-assignment` in this change. Point architecture / protocol-references at this change for product scope and at the spike for failed envelopes. After apply succeeds, archive or supersede the old change in a follow-up if desired.

**Why:** Keeps the “what not to send” notebook; avoids mixing failed spike UI back into product.

## Risks / Trade-offs

- [Reference `114d` still ignored on this firmware] → Mitigate: USB Log of Patone frame + dump confirm; if fail, operator capture of accepted bytes before inventing another layout. Do not fall back to W1–W3/H7.
- [Effect index 9 for NS mismatched] → Use CTL map from reference; unit-test encode/decode round-trip for NS on both stomps.
- [One module on both GP-50 stomps] → Allow unless a capture shows the pedal forbids it.
- [Optimistic UI desync if SET dropped] → Same class as other SETs; Reload / next dump refreshes. Optional later: dump-confirm after edit (out of default path).
- [GP-5 offset 920 only assumed in prior lab] → Align with reference `data[920]` and confirm on hardware in tasks.
- [No browser verification] → `tsc`; user tests on real pedals.

## Migration Plan

Additive snapshot field and dump parse. Disconnect drops it. Rollback is reverting the change. Update architecture, protocol-references, and OpenSpec context in the same apply so agents stop treating assignment as out of scope.

## Open Questions

None that block specs or tasks. Operator accept-capture is a verify step after the Patone `114d` encoder lands, not a planning unknown — the wire shape is already visible in the reference editors and matches the parameter-write family Patone already ships.
