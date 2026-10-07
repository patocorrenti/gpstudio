## Context

See `proposal.md` for why. Controller already decodes factory NS / SnapTone models from the current-preset dump (`docs/architecture.md`), but a user SnapTone wire identity (indices 56–79 / first wire byte `0x38`–`0x4f`) falls through `modelByWire` and `decodeSlotModel` leaves NS without `modelId`, so the panel never mounts. The local GP-5 and GP-50 reference editors (`_reference/`) list eighty NS options and, after the IR dump on connect, request a Nam dump and rebuild the NS `<select>` from eighty nibble-packed names. GP Studio already owns the IR-name sibling (`src/device/ir-names.ts`); Nam stays out until this change. Do not paste that HTML/JavaScript into `src/`.

## Goals / Non-Goals

**Goals:**

- Twenty-four user SnapTone NS catalog entries so dump / live model / `1147` share one wire map.
- One requested Nam dump per session; names overlay catalog fallbacks in the NS select for those slots.
- Nam fragments must not be assembled as a current-preset dump.

**Non-Goals:**

- Do not add a second catalog type or a new spec domain.
- Do not mutate static catalog labels at runtime.
- Do not wait for Nam (or IR / globals) before session readiness.
- Do not retag factory NS models `0`–`55`.

## Decisions

### 1. User SnapTones are NS catalog models, not a parallel type

**Choice:** Add twenty-four models to `NS_MODELS` (both pedals). Wire identities follow the same 4-byte NS family already used for factory SnapTones (`xx 00 00 0f`), with the slot index in byte 0:

| Slot | id | fallback label | packed wire | dump index |
| --- | --- | --- | --- | --- |
| 1 | `ns-user-01` | `SnapTone 01` | `38 00 00 0f` | 56 |
| 2 | `ns-user-02` | `SnapTone 02` | `39 00 00 0f` | 57 |
| … | … | … | … | … |
| 24 | `ns-user-24` | `SnapTone 24` | `4f 00 00 0f` | 79 |

Same five controls as factory NS (`KIND_VALUE_COUNT.ns === 5`). Tag each entry with a slot index (1–24) so UI can overlay dumped names without parsing the id. `decodeSlotModel` / `modelByWire` / `encodeSlotModel` then treat a user SnapTone like a factory NS: known, writable, Bluetooth live model `07` applies.

**Why:** The current-preset dump already stores NS as that 4-byte identity. Factory wires in `ns.ts` already match the reference map (`00`–`37`); the user rows are the rest (`38`–`4f`). A parallel “NAM object” on the slot would fork the panel. Unlike CAB user IRs, there is no distinct marker byte in position 2—only the higher index.

**Alternative:** Keep them unknown until names arrive. Rejected: a patch that uses user SnapTone 03 would still hide the NS panel. **Alternative:** One generic `ns-user` model. Rejected: twenty-four distinct wires; selecting the wrong slot would write the wrong identity.

### 2. Names live on the snapshot, not in the catalog

**Choice:** Connected `SessionSnapshot` gains `userNsNames: (string | null)[]` of length 24. Catalog `label` stays `SnapTone 01`…`SnapTone 24`. Controller NS `ModelSelect` displays `userNsNames[i] ?? fallback` and includes the displayed string in search. Disconnect drops the array. A later current-preset dump does not clear it. Factory NS labels stay static (do not overlay dump indices 0–55).

**Why:** The catalog is a static wire map. SnapTone filenames are device-global and arrive later (or never). Mutating `NS_MODELS` at runtime would leak session state into module scope. Overlaying all eighty dump names would rewrite factory labels without product need.

**Alternative:** Replace the entire NS select from the dump like the reference editor. Rejected: factory catalog is already owned and searched; only user slots need the dump. **Alternative:** Store the name only on the current NS slot. Rejected: the select needs all twenty-four names.

### 3. Request Nam names once per session, fail-open, after the first current-preset dump

**Choice:** `DeviceSession` sends the IR-name request and the globals request on the open link in the same post-first-preset secondary burst (once per connect). The Nam request waits until the IR-name dump is applied (reference editors ask Nam from the IR terminator handler), with a short fail-open timeout if IR never arrives. Do not delay `finishSync`, the patch bar, or chain refresh. Do not re-request on Reload or patch change. Timeout or missing dump leaves names `null` (fallback labels). Same request body wrapping as other identity-family asks (`encodeLinkMidi`).

**Why:** Specs require readiness without Nam names. Names are not per-patch. Asking Nam in the same burst as IR drops the Nam response on the pedal (overlapping name-table dumps); the reference editor sequences IR → Nam. Re-requesting on every patch would stall Bluetooth the way a second chain dump already can.

**Alternative:** Match the reference editor’s full order exactly (globals → preset-status → IRs → Nam). Rejected: preset-status stays out; globals stay in the secondary window with IR. **Alternative:** Block chainSync until names arrive. Rejected: NS already works with fallbacks once catalogued. **Alternative:** Ask Nam immediately after IR without waiting for the IR dump. Rejected: operator report — slots appear, dumped names stay blank until Nam is sequenced after IR.

### 4. GP Studio Nam codec; lock USB vs Bluetooth headers from reference / Log

**Choice:** New sibling of `ir-names.ts` (request + fragment assembler + nibble ASCII). Behavioral shape from the reference editors, **not** a source drop:

- Request is the same 14-byte identity-family envelope as name-list / current-patch / current-preset / IR-name, with a distinct size and path: `F0 03 05 00 01 00 00 00 02 01 02 02 04 F7`. Bluetooth wrap is `encodeLinkMidi`; do not paste the reference `8080f0…` string.
- Assembler concatenates indexed fragments, then reads eighty names: nibble-packed ASCII, first name at packed offset 164, stride 32. NUL nibbles become space; trim; empty → `null`. Snapshot keeps only indices 56–79 (twenty-four user slots).
- Fragment classification must run **before** `ChainDecoder.push`. Nam dumps must not be stored as preset fragments.
- Bluetooth: command `00 0E`, F0-aligned lengths 210 (data) / 134 (terminator); index nibbles at 5–6, payload from byte 9 (same shape as IR, different command and terminator length).
- USB: command `04 08`, lengths 48 (data) / 36 (terminator); index nibbles at 5–6, payload from byte 9. Confirm last-index / fragment count from assembled length against the eighty-name table; record any gap in `docs/protocol-references.md`.

**Why:** Hard constraint: own the codec, match wire bytes. Copying the HTML handler would import BLE-wrapped offsets and break USB.

**Alternative:** Decode names from the current-preset dump. Rejected: that dump has NS wire + knobs only; names are a separate dump. **Alternative:** Skip the name dump in this change and only catalog `SnapTone 01`…`24`. Rejected: the user asked to see newly loaded SnapTones by name; the dump is how names arrive.

### 5. Selecting a user SnapTone is an NS model SET, not an upload

**Choice:** `setSlotModel('ns', 'ns-user-03')` already encodes `1147` with that model’s `wire`. No new write family. Do not send NAM audio. Empty slots stay in the select so the user can point NS at them (pedal-defined; often silent / placeholder).

**Why:** The patch stores which SnapTone **slot** is loaded, not the `.nam` file. Upload is a later change.

### 6. Docs: Nam **name read** in; file upload still out

**Choice:** Update `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md` so the in-scope SysEx subset includes the Nam dump and user-NS catalog. Keep “IR / SnapTone / NAM **file upload**” in the later list.

**Why:** Agents currently treat all NAM as forbidden. Without this, apply would fight the context field.

## Risks / Trade-offs

- **USB fragment last-index not confirmed in a GP Studio Log yet** → Classify from reference editors; keep fail-open decode; record any Log gap in `docs/protocol-references.md`.
- **Nam fragments mistaken for preset dump** → Classify Nam first; `ChainDecoder` ignores that class. A misfed dump would desync chain/baseline.
- **Empty SnapTone slot selected** → Pedal may be silent. Still list all twenty-four; do not hide empty slots (no occupancy flag beyond a blank name).
- **Stale names if the user uploads a SnapTone in another app while connected** → Accept for this slice. Names refresh on the next connect.
- **NS select grows by 24 rows** → Existing searchable `ModelSelect` already covers large factory NS; overlay names stay searchable.
- **Hardcoded “custom” factory rows already in `ns.ts` (e.g. `_CrateGX65`)** → Leave them; they are dump indices ≤ 55 and already resolve. This change only adds 56–79.

## Migration Plan

Local app only. No persisted SnapTone data. Rolling back is reverting the change; snapshots rebuild on next connect.

## Open Questions

- Exact USB Nam last fragment index in a GP Studio USB Log, if the reference terminator length alone is ambiguous during apply (fail-open if missing).
