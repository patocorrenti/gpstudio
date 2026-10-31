## 1. Panel header

- [x] 1.1 In `SlotControls.tsx`, remove the info button. When the loaded model has a description, the kind icon opens that same dialog and its accessible name stays `About ${model label}`. When it has no description, the icon is not a button. Verify the panel header no longer renders the info icon, and that activating the icon does not call `setSlotModel` or `setSlotControl`.
- [x] 1.2 Add an `A/B` button in that header slot, tooltip `A/B Test - Compare Modules`. Activating it only selects that slot for module A/B. Verify the click handler does not call `setSlotModel` or `setSlotControl`.

## 2. A/B block

- [x] 2.1 Lift the patch-bar seconds input into a sibling under `src/features/controller/` (accessible name `Seconds`, integers 2–200, default 5, empty while typing, clamp on blur and Play). Point `PatchBar` at it. Verify patch A/B still opens at 5 and still clamps below 2 and above 200, and that `npx tsc -b --pretty false` passes.
- [x] 2.2 Render `ModuleAbBlock` in `PatchBody` between `AudioChainRow` and `SlotControlPanels`. Header is Close (tooltip `Close A/B test`) and Play. Under it, in order: side A, the seconds field, side B, on one row when width allows. Opening copies the slot into side B, removes that panel from the grid, and leaves the slot in the audio chain. Verify opening does not call `setSlotModel` or `setSlotControl`.
- [x] 2.3 The sounding side edits through the session. The other side is local: a model change fills `defaultValuesFor` and a control edit updates only that copy. Other panels' A/B buttons are disabled while the block is open. The sounding side is highlighted and `aria-current="true"`. Verify a side-B edit does not call `setSlotModel` or `setSlotControl`, and a sounding-side edit does.

## 3. Cycle

- [x] 3.1 Play captures both sides, shows Stop, and does not apply the sounding side. A timeout armed only while `chainSync === "idle"` then applies the other side: `setSlotModel` when the model differs, then `setSlotControl` with `flush: true` for each control that still differs. A no-op while still idle re-arms a full dwell; entering `syncing` does not. Stop leaves the last applied side sounding and returns Play. Close drops the side that is not on the pedal and returns the panel to the grid. Verify Play's handler does not apply immediately, and that neither Stop nor Close calls `setSlotModel` or `setSlotControl` by itself.
- [x] 3.2 End the block when that slot would lose its panel (off, or AMP/CAB while NS bypasses it), when `chainSync` becomes `syncing`, and on unmount. Verify those paths clear the open slot so the block does not return with the previous side B after the overlay hides.
- [x] 3.3 A Controller claim lets starting one cycle stop the other without closing the other setup. Module Play must not call `setPatch`. Patch Play must not apply a module side. While the module block is open, Space starts and stops the module cycle and `PatchBar` ignores Space. Verify the module block does not read `linkMode`.

## 4. Check

- [x] 4.1 Run `npx tsc -b --pretty false` and confirm it exits 0. USB and desktop share this UI path, so there is no separate MIDI-backend check.
