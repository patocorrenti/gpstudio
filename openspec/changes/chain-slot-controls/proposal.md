## Why

Controller already shows the current patch’s audio chain (slot order + on/off, `docs/architecture.md`), but a slot is only a kind (AMP, DST, PRE). Users cannot see or change which algorithm sits there (Tweedy vs a Marshall-style amp, COMP vs a Tube Screamer-style drive) or the knobs for that algorithm. The current-preset dump Patone already requests carries those fields; the decoder ignores them. This is the first slice of the planned preset-editor work, shown on Controller rather than the Editor route.

## What Changes

- Introduce a Patone-owned **factory catalog**: each **slot kind** (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) lists the **models** it can load. A model has an English label, which pedals it exists on (GP-5, GP-50, or both), the wire identity used in dumps/SETs, and a list of **controls** (label, min, max, step, display kind). Catalog data is typed TypeScript in `src/device/`, transcribed from observed pedal behavior and the local reference editor — not a JavaScript paste from `reference/`.
- Extend the connected snapshot so each effect **slot** carries the loaded **model** and current control **values**, decoded from the same current-preset dump already requested after connect and on patch change (`docs/architecture.md`). Missing or unknown dump fields fail open: do not invent values that get written to the pedal.
- After the chain is shown, Controller draws a simple control panel **below the audio chain for each enabled effect slot**: a model select (when that kind has more than one factory model) and that model’s controls, in two columns when width allows. AMP and CAB panels hide while NS bypasses those slots. Changing a model or a control goes through `DeviceSession` and is sent as a parameter-write SET (path `01 01 04`, CRC-8 + nibble-expand; not live notify `01 02 04`). On Bluetooth, pedal→app live model (`01 02 04` command `07`) and live control (`01 02 04` command `08`) notifies update the same snapshot; USB ignores those reports. Slider drags update the snapshot immediately and coalesce the SET (throttle + flush on release) so Bluetooth is not flooded. USB and Bluetooth share the same UI; USB remains one-way for unsolicited knob telemetry.
- Vocabulary for this work (full rationale in `design.md`): **audio chain** → **slot** (position) → **kind** (`nr`…`rvb`, plus GP-50 `exp`) → **model** (Tweedy, COMP) → **controls** / **values**. Existing specs may still say “module” for a slot kind; new requirements use **kind** and **model** so those two ideas stay distinct.

## Non-goals

- The Editor and Library routes stay stubs. No preset rename, save-as, library reorder, or full preset file write (`docs/architecture.md`).
- IR / SnapTone / NAM **upload**. User-loaded IR and SnapTone **names** (extra dumps) stay later; factory CAB/NS models that already have wire ids may appear in the catalog with stable English labels.
- GP-50 EXP: still on/off only. No EXP model panel in this change.
- Applying inbound volume, tuner, globals, BPM, Patch/Stomp mode, or stomp-assignment edit (paused lab). Bluetooth live model/control follow for the ten effect slots is in this change. USB still must not apply those live reports.
- Polished knob chrome (custom knobs, per-slot colors, card selection on the chain). This change’s UI is functional panels under the chain.
- Copying reverse-engineered JavaScript from `reference/` or other third-party editors. Mobile packaging. Treating USB and Bluetooth as interchangeable.

## Capabilities

### New Capabilities

- None. This is the next live-controller slice after chain order + on/off, not a new spec domain. The Editor route is still unspecified.

### Modified Capabilities

- `live-controller`: After the audio chain is shown, Controller shows a two-column control panel for each enabled effect slot (model select + that model’s controls) through the device session. Panels hide when the slot is off, NS-bypassed (AMP/CAB), or the session disconnects. Same presentation on USB and Bluetooth.
- `device-connection`: The connected snapshot carries each effect slot’s loaded model and control values from the current-preset dump. User model/control edits update the snapshot on-change and send a parameter-write SET on the open link. Slider control writes are coalesced. Bluetooth (`liveFromPedal`) applies inbound live model and live control notifies. USB does not apply those reports. Unknown dump fields must not be written back. Disconnect drops that state.

## Impact

- `src/device/`: new catalog types + factory data; extend `AudioChainSlot` (or a sibling snapshot field) with model id and values; extend the existing current-preset decoder beyond order + on/off; new SET encoders for model swap and parameter write (same CRC-8 + nibble family as chain-order SET). `DeviceSession` applies dump fields and sends edits. UI never calls raw MIDI.
- `src/features/controller/ControllerPage.tsx`: panels under the chain row. Editor/Library pages unchanged.
- `docs/architecture.md` and `openspec/config.yaml`: current-patch **model + parameter** read/write for the ten effect slots becomes in-scope SysEx (still not library, IRs/NAM, or the Editor route).
- No new Tauri commands, HTTP backend, or transport contract changes. Exact dump offsets and SET bodies are an apply-time fill-in from Patone captures plus `reference/` as a behavioral guide (`docs/protocol-references.md`).
