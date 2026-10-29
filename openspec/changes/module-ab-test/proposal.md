## Why

Patch A/B already alternates two onboard patches on a fixed interval. Comparing two settings of the same effect still means editing, listening, undoing, and editing again. Controller should hold two versions of one module and alternate them the same way, on USB and Bluetooth, using the existing model and control writes.

## What Changes

- Each visible effect panel (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB) gains an **A/B** button where the info button sits today. Tooltip: `A/B Test - Compare Modules`.
- The model description dialog moves to the module icon in that panel header. Activating the icon opens the same dialog the info button opens today. The icon stays non-interactive when the loaded model has no description. The info button goes away.
- Activating A/B opens one module A/B block directly under the audio chain and above the other panels. The chosen panel leaves the panel grid and becomes side A in that block. The audio chain row does not change: the slot stays in the chain with its on/off switch.
- The block sits on the same darker band as patch A/B, edge to edge. **Use A** sits centered above panel A, **Play** sits centered above the seconds input, and **Use B** sits centered above panel B. Use A and Use B set that version on the pedal through the existing model and control writes, do not save the patch, and close the block. Left to right: panel A, a seconds input, panel B.
- The seconds input matches patch A/B: integer dwell from 2 through 200, showing 5 when the block opens. Empty while editing is allowed; blur or Play resolves an empty value to 5 and clamps out-of-range values into that range.
- Panel B starts as a copy of A (same model and control values). Both panels use the same controls as a normal panel, including model select when that kind has more than one model. Edits on the side that is sounding go through the device session. Edits on the other side stay local until that side becomes the one sounding. Opening the block does not send a write.
- **Play** becomes **Stop** and alternates the two captured sides for the captured dwell. Play does not re-apply the side already sounding. After each idle dwell it applies the other side, then repeats. Each apply uses the existing session model and control writes (`docs/architecture.md`: model/control SETs of family 1147 / 1148). No apply is sent while the chain is syncing; a sync during a dwell cancels that dwell, and the next dwell starts only once the chain is idle.
- **Stop** ends the cycle, leaves the pedal on the side that is sounding, and returns the block to setup with Play.
- **Use A** or **Use B** ends the cycle, sets that side on the pedal if it is not already there, does not save the patch, discards the other side, and returns that module's panel to the grid. Disconnect, a patch change, turning that slot off, or NS bypass hiding that panel ends the mode without choosing and leaves the pedal on the side last applied.
- While the cycle is running, both panels stay usable. An edit on the side that is sounding goes through the session and updates that captured side. An edit on the other side updates only that captured side. The seconds input becomes a countdown, with a progress line above it that runs toward the other side, and the sounding side's rule lights the same way as patch A/B. Use A, Use B, and Stop stay usable. Only one module is in A/B at a time; other panels keep their A/B button, and it does not open a second block.
- A running patch A/B cycle and a running module A/B cycle do not overlap. Starting one stops the other without closing the other setup. While the module block is open, Space starts or stops the module cycle and does not start the patch cycle.
- The same block is used on USB and Bluetooth. React does not send raw MIDI.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-controller`: Effect panels replace the info button with module A/B, move the model description to the module icon, and gain a block under the audio chain that alternates two versions of one slot through the existing model and control writes. Patch A/B Space yields to that block while it is open, and the two cycles do not run together.

## Non-goals

- Pulling the slot out of the audio chain, or comparing two different effect kinds.
- More than one module in A/B at a time, or more than two versions of that module.
- A/B on GP-50 EXP, on a slot that has no panel, or on a panel hidden because the slot is off or NS-bypassed.
- Remembering the other side, or the seconds value, after Use A, Use B, or across patches.
- Saving the patch from Use A or Use B. Those actions set the working slot only.
- A new MIDI message, a DeviceSession timer, or a second session.
- Crossfade, random order, or a visible countdown beyond the seconds control the patch A/B bar already uses.
- Library browse, IR/NAM upload, or copying reference-editor source.

## Impact

- Controller panels (`src/features/controller/SlotControls.tsx`, `src/features/controller/ControllerPage.tsx`, and a sibling under `src/features/controller/` for the A/B block). UI imports `@/device/session` only.
- Patch bar Space handling in `src/features/controller/PatchBar.tsx`, so the two cycles do not run together.
- `openspec/specs/live-controller/spec.md` when archived.
- No transport, codec, or `docs/architecture.md` protocol change. Applies stay the existing slot model and control writes.
