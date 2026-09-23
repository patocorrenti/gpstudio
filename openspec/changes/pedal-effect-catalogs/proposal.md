## Why

The effect catalog already filters by pedal (`FxModel.devices`, `modelsForKind`), but every factory model is tagged for both GP-5 and GP-50. Controller therefore offers the same models and the same knobs on either pedal. The official effect lists (`_reference/gp50manual.pdf`, `_reference/1748936007255.GP-5_Online Manual_EN_Firmware V1.0.3.pdf`) share most modules and differ in a few models and in GP-50-only controls.

## What Changes

- Keep one catalog, still split by effect kind (`src/device/catalog/*.ts`). Each model keeps a single entry and a `devices` set (`gp5`, `gp50`, or both). Stop using “both” as the default for models the manuals do not share.
- Give controls the same membership. A knob that exists on only one pedal is hidden and not written on the other. Shared knobs stay one definition.
- GP-50-only models from the effect lists: PRE **C-Wah**, PRE **AC Sim**, CAB **AC**. GP-5 does not list them. No GP-5-only factory model showed up in those lists.
- GP-50-only controls on shared models: **Sync** (and Sweep Echo **S-Sync** / **D-Sync**). The GP-5 effect list has no Sync parameter. **B-Boost** stays Gain / VOL / Bass / Treble on both pedals (GP-50 reference editor `defaultsPRE`; the GP-50 manual’s “Tone” wording is not used).
- Model select, control panels, and session writes follow the connected pedal. A dump whose wire identity is not in that pedal’s catalog stays unwritable. Wire bytes of shared models stay as they are.
- Factory SnapTone file names and the twenty user IR CAB slots match on both manuals and stay on both pedals.

## Non-goals

- A second catalog tree (shared file plus GP-5 and GP-50 add-on files), or a second model id when the wire identity is the same.
- Cross-model `.prst` conversion, Library import, or IR / NAM / SnapTone file upload (`docs/architecture.md`).
- Retagging the factory SnapTone (NS) list. Those names match in both manuals.
- New wire identities, new SysEx, or copying JavaScript from `reference/`.
- Editor / Library routes, or a new spec domain.

## Capabilities

### New Capabilities

- None. Pedal membership is a filter on the catalog the session and Controller already use.

### Modified Capabilities

- `device-connection`: A connected session exposes and writes only catalog models and controls that exist on that pedal. GP-5 does not expose C-Wah, AC Sim, CAB AC, or Sync. A wire identity outside that pedal’s catalog stays unwritable.
- `live-controller`: Model selects and slot panels list only the models and controls for the connected pedal. GP-50 PRE includes C-Wah and AC Sim; GP-5 PRE does not. GP-50 CAB includes AC; GP-5 CAB does not. Sync appears only on GP-50.

## Impact

- `src/device/catalog/` (`types.ts`, kind files, `index.ts`): pedal set on models that are not shared, and on controls that are not shared. Lookup helpers return the connected pedal’s controls.
- `src/device/session/` and `src/features/controller/SlotControls.tsx`: writes and panels use that filtered control list. `modelsForKind` already takes the pedal.
- No transport, Tauri, or MIDI-backend change. USB and Bluetooth stay asymmetric (`docs/architecture.md`).
