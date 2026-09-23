## Context

See `proposal.md` for why. `FxModel.devices` and `modelsForKind(kind, pedal)` already exist (`src/device/catalog/`). Every factory model currently uses `BOTH_PEDALS`, so both pedals get the same list. Slot panels read `model.controls` directly (`src/features/controller/SlotControls.tsx`). The session already refuses a model write when `devices` does not include the connected pedal. Wire lookup is one map per kind (`modelByWire`); a duplicate id or a duplicate kind+wire throws at startup.

The effect lists in the GP-5 and GP-50 manuals share the factory models except PRE C-Wah, PRE AC Sim, and CAB AC (GP-50 only). Factory SnapTone names and the twenty user IR slots match. Sync (including Sweep Echo S-Sync and D-Sync) appears only in the GP-50 effect list. B-Boost stays Gain / VOL / Bass / Treble on both pedals (GP-50 reference editor; the manual’s Tone wording is not used). Current B-Boost slots are Gain 0, VOL 1, Bass 2, Treble 3.

UI never sends raw MIDI (`docs/architecture.md`). Do not paste `reference/` into `src/`.

## Goals / Non-Goals

**Goals:**

- One catalog entry per model, with pedal membership on the model and on any control that is not shared.
- Selects, panels, and writes use the connected pedal’s subset.
- Shared wire identities stay one entry.

**Non-Goals:**

- A shared-file plus GP-5 file plus GP-50 file layout.
- A second model id for B-Boost or for any other shared wire.
- New value slots, new SysEx, or SnapTone retagging.

## Decisions

### One catalog, membership on the entry

Keep the files split by effect kind. Set `devices` to `gp50` on C-Wah, AC Sim, and CAB AC. Leave every other factory model, including user IR slots and SnapTone files, on both pedals.

A common file plus two pedal add-on files was considered. Most entries are identical, and `modelByWire` is per kind, not per pedal. A second tree would duplicate the shared majority and split the wire map the index already checks. The `devices` set is the flag that select and session already honor; the data is what is wrong.

### Same flag on controls

Add an optional `devices` set on `FxControl`. Omitted means both pedals, matching today’s models. A helper returns the controls whose set includes the connected pedal. Panels and session writes use that list. `defaultValuesFor` still fills every catalog slot so a hidden GP-5 Sync index is not invented as a write; the panel simply does not offer it, and the session does not send a control SET for a control outside that pedal’s list.

Tag Sync, S-Sync, and D-Sync as GP-50 only. Walk the effect-list parameter columns once more at apply and tag any other shared knob the same way when the two manuals name it differently. Do not split the model.

Duplicating B-Boost into two `FxModel` rows was rejected. Both pedals share wire `0b 00 00 00`, and the index rejects two models with the same kind and wire.

### B-Boost stays Gain / VOL / Bass / Treble on both pedals

The GP-50 manual effect list names Tone for B-Boost, but the GP-50 reference editor’s `defaultsPRE` entry for B-Boost is Gain, VOL, Bass, Treble at indexes 0–3 — the same layout as GP-5 and as the current catalog. Prefer that observed parameter map over the manual wording. Do not invent a Tone control and do not hide Bass / Treble on GP-50.

## Risks / Trade-offs

- [A shared model has another knob the manuals name differently and the walk misses it] → The apply walk is the checklist. Membership stays on the control, so a miss is a data fix, not a new shape.
- [A GP-5 dump still contains a Sync byte] → The value can sit in the slot. GP-5 does not show it and does not write it.

## Migration Plan

Catalog data only. No stored user migration. Revert the `devices` tags to roll back.

## Open Questions

None.
