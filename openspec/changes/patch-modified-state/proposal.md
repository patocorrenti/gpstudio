## Why

Live edits already go to the pedal’s working buffer (module CC, chain-order SET, model/control SETs, upload), but they are not stored into a 00–99 slot until Save / rename (`docs/architecture.md`). Recalling another patch drops that buffer. Controller has no working-state signal, so the user cannot tell whether the current patch still matches what was last loaded or stored.

## What Changes

- After a current-preset dump lands for the selected patch, `DeviceSession` keeps a **baseline copy** of that working chain in memory (order, on/off, factory model, control values — the same fields already on the snapshot). The chain is 10–11 slots; cloning it is cheap, so this is value comparison, not a sticky “touched” flag.
- The connected snapshot exposes **modified**: false until the working chain differs from that baseline. Toggling a module off and on, or dragging a knob away and back to the original value, MUST clear modified. Any in-scope working-buffer change that still differs (toggle, reorder, model, control, Bluetooth live follow, upload) MUST set modified.
- **Save** and **rename** (store of the current slot) take a new baseline from the current working chain and clear modified. **Duplicate** stores onto another slot and MUST NOT clear modified for the current patch. **Download** MUST NOT recapture the baseline. **Upload** loads the working buffer without storing, so the dump refresh MUST leave modified true unless that file already matches the baseline.
- Changing patch (user or pedal) or disconnecting drops the baseline. The next dump for the new patch starts clean. While `chainSync` is syncing, or when no dump has been captured yet, modified is false.
- Controller does not show a Modified label. **Save** sits before Rename: disabled while the working chain matches the baseline, usable with an emerald style when `modified` is true. Same presentation on USB and Bluetooth. UI still MUST NOT send raw MIDI.

## Non-goals

- A confirm / discard dialog when changing patch, disconnecting, or uploading. Modified is the signal; intercepting navigation is a later change if needed.
- A local-only edit buffer that withholds CC/SET from the pedal until Save. Live writes to the working buffer stay as they are.
- A separate Modified label on the patch bar (Save itself is the signal).
- Tracking volume, tuner, BPM, Patch/Stomp, or onboard name as modified. Those are not in the current chain snapshot; rename is a store of the current slot, so it recaptures and clears.
- Revert-to-baseline / discard edits, Library, Editor, copied SysEx, IRs/NAM, or mobile packaging.

## Capabilities

### New Capabilities

- None. This is the next live-controller slice after current-patch store and `.prst` upload, not a new spec domain.

### Modified Capabilities

- `live-controller`: Connected Controller’s Save control sits before Rename. It is disabled until the working chain differs from the last loaded or stored baseline, then uses an emerald style. Save / rename of the current slot, restoring the baseline, a patch change, and disconnect disable it again. No separate Modified label. Same USB and Bluetooth presentation.
- `device-connection`: The connected snapshot carries `modified`. The session owns a per-patch baseline cloned from the current-preset dump (and recaptured after a successful current-slot store). Working-chain divergence sets `modified`; equality clears it. Patch change and disconnect drop that baseline. Download dump refresh and duplicate MUST NOT recapture. Upload dump refresh MUST NOT recapture as a clean baseline.

## Impact

- `src/device/session.ts`: private baseline chain, `modified` on the connected snapshot, recapture on load dump and current-slot Save / rename, compare with the existing slot equality helper after chain mutations (including Bluetooth live follow).
- `src/features/controller/PatchBar.tsx`: Save before Rename; disabled when clean; emerald when `snapshot.modified`. No raw MIDI.
- `docs/architecture.md` and `openspec/config.yaml`: Controller patch bar includes working modified state. No new SysEx, Tauri command, or transport contract.
