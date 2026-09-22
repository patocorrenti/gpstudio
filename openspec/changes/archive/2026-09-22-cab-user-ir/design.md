## Context

See `proposal.md` for why. Controller already shows CAB from the factory catalog (`src/device/catalog/cab.ts`) and the current-preset dump (`src/device/chain-codec.ts`). A user-IR wire identity falls through `modelByWire` and `decodeSlotModel` leaves CAB without `modelId`, so the panel never mounts. The GP-5 manual documents twenty onboard cabinet IR slots on both pedals. The local GP-50 reference editor (`_reference/`) lists those slots in the CAB `<select>` and, after connect, requests a separate IR-name dump and overlays names. Patone must own the codec and match Patone Log / operator captures (`docs/protocol-references.md`); do not paste that HTML/JavaScript into `src/`.

## Goals / Non-Goals

**Goals:**

- Twenty user-IR CAB catalog entries so dump / live model / `1147` share one wire map.
- One requested IR-name dump per session; names overlay catalog fallbacks in the CAB select.
- IR fragments must not be assembled as a current-preset dump.

**Non-Goals:**

- Do not add a second catalog type or a new spec domain.
- Do not mutate static catalog labels at runtime.
- Do not wait for globals / preset-status / NAM dumps before requesting IR names.

## Decisions

### 1. User IRs are CAB catalog models, not a parallel type

**Choice:** Add twenty models to `CAB_MODELS` (both pedals). Wire identities follow the same 4-byte CAB family already used for factory cabs, with slot index in byte 0 and user-IR marker `0x10` in byte 2:

| Slot | id | fallback label | packed wire |
| --- | --- | --- | --- |
| 1 | `cab-user-ir-01` | `User IR 01` | `00 00 10 0a` |
| 2 | `cab-user-ir-02` | `User IR 02` | `01 00 10 0a` |
| … | … | … | … |
| 20 | `cab-user-ir-20` | `User IR 20` | `13 00 10 0a` |

Same single VOL control as factory cabs (`KIND_VALUE_COUNT.cab === 1`). Tag each entry with a slot index (1–20) so UI can overlay dumped names without parsing the id. `decodeSlotModel` / `modelByWire` / `encodeSlotModel` then treat a user IR like Tweedy: known, writable, Bluetooth live model `07` applies.

**Why:** The current-preset dump already stores CAB as that 4-byte identity. Factory wires in `cab.ts` already match the reference map (`0100000a` … `3c00000a`); the user-IR rows are the rest of that map (`0000100a` … `1300100a`). A parallel “IR object” on the slot would fork the panel.

**Alternative:** Keep them unknown until names arrive. Rejected: a patch that uses User IR 03 would still hide the CAB panel. **Alternative:** One generic `cab-user-ir` model. Rejected: twenty distinct wires; selecting the wrong slot would write the wrong identity.

### 2. Names live on the snapshot, not in the catalog

**Choice:** Connected `SessionSnapshot` gains `userIrNames: (string | null)[]` of length 20. Catalog `label` stays `User IR 01`…`User IR 20`. Controller CAB `ModelSelect` displays `userIrNames[i] ?? fallback` and includes the displayed string in search. Disconnect drops the array. A later current-preset dump does not clear it.

**Why:** The catalog is a static wire map. IR filenames are device-global and arrive later (or never). Mutating `CAB_MODELS` at runtime would leak session state into module scope.

**Alternative:** Replace option labels by rewriting catalog entries. Rejected: shared module, no disconnect cleanup. **Alternative:** Store the name only on the current CAB slot. Rejected: the select needs all twenty names.

### 3. Request IR names once per session, fail-open, after identity+chain are in flight

**Choice:** `DeviceSession` sends the IR-name request on the open link after the current-preset request is sent (same connect path as `sendChainRequest`). Do not delay `finishSync`, the patch bar, or chain refresh. Do not re-request on Reload or patch change. Timeout or missing dump leaves names `null` (fallback labels). Same request body wrapping as other identity-family asks (`encodeLinkMidi`).

**Why:** Specs require readiness without IR names. Names are not per-patch. Re-requesting on every patch would stall Bluetooth the way a second chain dump already can.

**Alternative:** Match the reference editor’s order (globals → preset-status → IRs → NAM). Rejected: those dumps are out of scope and would delay names for no product gain. **Alternative:** Block chainSync until names arrive. Rejected: CAB already works with fallbacks.

### 4. Patone IR-name codec; lock USB vs Bluetooth headers from captures

**Choice:** New sibling of `identity.ts` / `chain-codec.ts` (request + fragment assembler + `getName`-style nibble ASCII). Behavioral shape from the reference editor, **not** a source drop:

- Request is the same 14-byte identity-family envelope as name-list / current-patch / current-preset, with a distinct size/command/path. Bluetooth wrap is `encodeLinkMidi`; do not paste the reference `8080f0…` string.
- Assembler concatenates indexed fragments, then reads twenty names: 10-character nibble-packed ASCII, first name at packed offset 44, stride 32. NUL nibbles become space; trim; empty → `null`.
- Fragment classification must run **before** `ChainDecoder.push`. IR dumps must not be stored as preset fragments (wrong command/length vs chain dumps).
- USB vs Bluetooth inbound headers and fragment lengths differ for other dumps (`docs/protocol-references.md`). Apply locks those IR headers from Patone Log on each link, the same way name-list locked `01 05` vs `06 0A`. Reference byte lengths (212 / 96 including BLE wrap) are a hint, not the fixture.

**Why:** Hard constraint: own the codec, match wire bytes. Copying the HTML handler would import BLE-wrapped offsets and break USB.

**Alternative:** Decode names from the current-preset dump. Rejected: that dump has CAB wire + VOL only; names are a separate dump. **Alternative:** Skip the name dump in this change and only catalog `User IR 01`…`20`. Rejected: the user asked to **read** loaded IR files; the dump is how names arrive.

### 5. Selecting a user IR is a CAB model SET, not an upload

**Choice:** `setSlotModel('cab', 'cab-user-ir-03')` already encodes `1147` with that model’s `wire`. No new write family. Do not send IR audio. Empty slots stay in the select so the user can point CAB at them (pedal-defined; often silent).

**Why:** The patch stores which IR **slot** is loaded, not the WAV. Upload is a later change.

### 6. Docs: IR **name read** in; file upload still out

**Choice:** Update `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md` so the in-scope SysEx subset includes the IR-name dump and user-IR CAB catalog. Keep “IR / SnapTone / NAM **upload**” in the later list.

**Why:** Agents currently treat all IRs as forbidden. Without this, apply would fight the context field.

## Risks / Trade-offs

- **USB fragment headers differ from the Bluetooth reference handler** → Classify from Patone Log per link; keep a fixture in the codec. If USB never returns the dump, fail-open with fallback labels; do not invent names.
- **IR fragments mistaken for preset dump** → Classify IR first; `ChainDecoder` ignores that class. A misfed dump would desync chain/baseline.
- **Empty IR slot selected** → Pedal may be silent. Still list all twenty; do not hide empty slots (no occupancy flag in the name dump beyond a blank name).
- **Stale names if the user uploads an IR in another app while connected** → Accept for this slice. Names refresh on the next connect.
- **CAB select grows to 41 rows** → Existing searchable `ModelSelect` (threshold 15) already covers factory CAB; overlay names stay searchable.

## Migration Plan

Local app only. No persisted IR data. Rolling back is reverting the change; snapshots rebuild on next connect.

## Open Questions

- Exact USB IR fragment command bytes and lengths, to be filled from a Patone USB Log during apply (same as prior dump locks). Specs and tasks already say fail-open if that dump is missing.
