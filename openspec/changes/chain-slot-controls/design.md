## Context

See `proposal.md` for why. Controller already draws the current patch’s audio chain from `DeviceSession` (`src/features/controller/ControllerPage.tsx`). A slot is `{ id, enabled }` (`src/device/chain.ts`): `id` is the **kind** (`nr`…`rvb`, plus GP-50 `exp`). Specs and comments often call that kind a “module.” The current-preset dump decoder (`src/device/chain-codec.ts`) already requests and parses that dump for **order + on/off** and ignores the rest. Parameter-write SETs already exist for chain-order (`01 01 04`, CRC-8 ATM poly `0x07` init 0, nibble-expand in `src/device/sysex-nibble.ts`). Live notifies stay on `01 02 04` and are not SETs. UI never sends raw MIDI (`docs/architecture.md`). `reference/` is a behavioral guide, not a source drop (`docs/protocol-references.md`).

The GP-50 reference editor keeps a per-kind list of algorithms (static `<option>` labels + parallel default/control tables) and writes two SET shapes: model swap and float parameter. Patone will own typed catalog objects and codecs that **match observed wire bytes**, not that HTML/JavaScript.

## Goals / Non-Goals

**Goals:**

- One vocabulary: audio chain → slot → kind → model → controls/values.
- Factory catalog in `src/device/` that UI and codecs share.
- Snapshot carries loaded model + values from the dump we already request.
- Session methods for model swap and control write; Controller panels for enabled effect slots.

**Non-Goals:**

- Do not rename every existing spec’s “module” to “kind” in this change (only new requirements).
- Do not add a test runner, custom knobs, Editor route, IR/NAM dumps, or live knob follow.

## Decisions

### 1. Vocabulary: kind vs model (not a second “module”)

**Choice:**

```
audio chain
  slot                  position in the row
    kind                nr | pre | dst | ns | amp | cab | eq | mod | dly | rvb | exp
    enabled
    model               Tweedy, COMP, GATE, ...   (null if unknown)
    values              number[] keyed by control index (absent if unknown)
```

- **Kind** is today’s `EffectId` / `ChainSlotId`. Keep those TypeScript names. Informal “module” in older specs still means kind.
- **Model** is the algorithm loaded in that slot. Not “module”: that word already means NR/PRE/DST in this repo, and “audio module” repeats “audio.”
- **Control** is a catalog knob/toggle (label, min, max, step, display kind). **Value** is the live number for that control.
- Wire SysEx may still say “block” (kind index) and “param” (control index). Codecs map those to kind + control index.

**Why:** The user needed a name for Tweedy vs AMP. Amp modelers already say “model.” Repeating “module” for both AMP and Tweedy is how this stays confusing.

**Alternative:** Call Tweedy a module and rename NR/PRE to “block.” Rejected for this change: it would churn chain/on-off/reorder specs and UI comments without changing behavior. Revisit a full rename later if we want.

### 2. Catalog is code, shared, tagged per pedal

**Choice:** Add `src/device/catalog/` (types + one factory table per kind). Each model is a Patone object:

- stable id (slug, e.g. `amp-tweedy`)
- kind
- English label
- `devices: ReadonlySet<DeviceModel>` (`gp5`, `gp50`, or both)
- wire identity (the 4-byte flag used in dump + model SET)
- `controls[]`: `{ index, label, min, max, step, display }` where `display` is `percent | toggle | bipolar | rate | time | enum`

Only **visible** controls belong in `controls[]` (hidden padding slots in the reference tables stay out of the UI; codecs may still reserve unused value indexes so dump offsets stay aligned). Session filters the catalog by `snapshot.model`. Default until a GP-5 capture proves otherwise: factory models in the GP-50 reference exist on both pedals. Apply-time may mark a model GP-50-only when a capture or the GP-5 editor (behavioral, `docs/protocol-references.md`) disagrees.

Transcribe labels and ranges into these objects by reading `reference/`. Do **not** paste that JavaScript into `src/`.

**Why:** The pedal does not send control metadata — only wire ids and floats. The app has to know min/max/step/label. One catalog avoids a React copy and a codec copy.

**Alternative:** Fetch catalogs from the pedal. Rejected; no such dump is in scope. **Alternative:** JSON asset. Rejected; TypeScript constants type-check ids against kinds.

### 3. Slot state lives on the chain snapshot

**Choice:** Extend `AudioChainSlot` (effect slots only):

```
{ id, enabled, modelId?: string, values?: number[] }
```

`exp` stays `{ id: "exp", enabled }` with no model/values. `defaultChain` omits model/values (unknown). `reorderChain` and on/off copies keep `modelId`/`values` with the slot. Disconnect drops the chain as today.

Unknown means “do not write,” not “pretend the first catalog model is loaded.”

**Why:** Same seam as order + on/off. Controller only reads the snapshot.

**Alternative:** Parallel `slotParams` map on the snapshot. Rejected; it can drift from chain order. Keep data on the slot.

### 4. Same dump, more fields; live reports do not invent params

**Choice:** Extend `parsePresetDump` (and GP-5/GP-50 layouts already branched in the codec) to also read each kind’s wire identity and float32 LE values. Offsets are an apply-time fill-in from Patone captures; the GP-50 reference is a map, not source. Identity lookup: wire bytes → catalog model for that kind. Unknown identity → leave `modelId`/`values` unset for that slot; order + on/off still apply.

Requested / opportunistic current-preset dumps replace model + values (same class as today’s chain apply; not `liveFromPedal`). Bluetooth live on/off and live chain-order **keep** `modelId`/`values`. USB still ignores those live reports. Do **not** apply unsolicited live parameter frames while the patch stays the same.

Kind index on the wire follows `DUMP_MODULE_IDS` (NR PRE DST AMP CAB EQ MOD DLY RVB NS), not UI `EFFECT_IDS` order.

**Why:** We already wait on this dump. A second request would only slow connect.

**Alternative:** New SysEx ask per slot. Rejected.

### 5. Two SET encoders, same family as chain-order

**Choice:** Patone-owned encoders, path `01 01 04`, CRC-8 + nibble-expand, wrapped by existing `encode.ts` for Bluetooth:

- **Model write:** packed body in the `1147` family — kind index + wire identity.
- **Control write:** packed body in the `1148` family — kind index + control index + IEEE-754 float32 LE of the UI number.

Exact packed bytes are apply-time capture fill-in (operator log / Patone Log). Echoing a live `01 02 04` notify is not a SET.

`DeviceSession` grows `setSlotModel(kind, modelId)` and `setSlotControl(kind, index, value)`:

- no-op when not ready, chain busy, unknown slot state, kind not in catalog, model not for this pedal, or EXP
- model swap: snapshot `modelId` + `values` reset to that model’s catalog defaults (visible controls’ default numbers; others 0), then send model write. Do not extra-dump.
- control: clamp to min/max, snap to step, update `values[index]`, send control write. Do not extra-dump. Do not change on/off or order.

**Why:** Same seam as chain-order SET. Official CC cannot select Tweedy or set Gain.

**Alternative:** CC for knobs. Rejected; not in the manuals for these parameters.

### 6. Controller panels are a simple list under the chain

**Choice:** Below the chain row, one panel per **enabled** effect slot with known model/values, in chain order. Panel: kind label, model `<Select>` if `catalog[kind].length > 1` for this pedal, then a shadcn slider (or switch when `display === "toggle"`) per visible control. English only. The existing chain-refresh overlay already covers controls below the patch bar; panels sit there. NS prohibition overlay stays on the AMP/CAB **slots**; those panels still show if AMP/CAB are enabled. Turning a slot off unmounts its panel; values stay on the snapshot for when it turns back on.

No click-to-focus on the chain in this change. Editor page stays stub.

**Why:** User asked for a simple first UI. Polished knobs are later.

**Alternative:** Put this on `/editor`. Rejected for this slice; live current-patch edit belongs next to the chain the user already uses.

### 7. NS / CAB factory vs user IRs

**Choice:** Catalog factory CAB models and any NS/SnapTone factory wire ids we can label in English from static reference options or manuals. Extra CAB/NS entries that only get names from an IR/NAM dump are omitted until that change. If an NS wire id is known but has no product name, use a stable English fallback (`SnapTone 01`) so the select can still match the dump. Do not upload IRs.

**Why:** Proposal non-goal is upload and user-loaded names, not “NS has no knobs.” NS Gain/EQ still need a model row to hang on.

## Risks / Trade-offs

- **GP-5 dump layout / catalog differs** → Keep the existing per-model layout branch; tag `devices` when a GP-5 capture disagrees. Until then share the factory list.
- **Model SET ignored (same class as paused stomp-assignment)** → Implement encoder from captures; if the pedal ignores it, stop and record a spike rather than guessing more frames.
- **Firmware adds models we do not have** → Unknown identity stays unwritable; chain on/off still works.
- **Float rounding** → Round trip dump floats to the control’s step before display; send the snapped number.
- **Large catalog** → One file per kind is fine; do not generate from pasted JS.

## Migration Plan

Local app only. No persisted user data. Rolling back is reverting the change; snapshots rebuild on next connect.

## Open Questions

None that block specs or tasks. Apply-time fill-ins (dump offsets, packed SET bodies, any GP-5-only models) are capture work, not product forks.
