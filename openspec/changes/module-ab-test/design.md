## Context

Patch A/B already lives on `PatchBar`: a React timer, captured slots, and `session.setPatch`. It re-arms the dwell only while `chainSync === "idle"`. Slot panels live in `SlotControls.tsx` under the chain in `ControllerPage`. The info control is an `Info` button that opens the model description; the kind icon is not a control. Model and control edits go through `session.setSlotModel` and `session.setSlotControl`. `setSlotModel` replaces that slot's values with the model's defaults and sends only the model write. See proposal.md for why, and the live-controller delta for the behavior.

## Goals / Non-Goals

**Goals:**

- Keep both versions in the Controller feature and apply them with the existing slot writes.
- Reuse the patch A/B dwell rule: arm only while the chain is idle, and drop the wait when syncing starts.
- Let the patch cycle and the module cycle stop each other without a session-owned timer.

**Non-Goals:**

- A new session method, a new SysEx family, or a change to `setSlotModel` / `setSlotControl`.
- Forking the block by `linkMode`. Both links call the same session methods.
- A test runner. Verification stays typecheck, same as the rest of Controller.

## Decisions

### The block is a Controller sibling, and the chain row stays

`PatchBody` renders `ModuleAbBlock` between `AudioChainRow` and `SlotControlPanels`. The open slot id is state on `PatchBody`. `SlotControlPanels` omits that id, so the panel leaves the grid and is not duplicated. The chain row still renders every slot, including the one under test.

One block at a time. While an id is set, the other panels' A/B controls are disabled.

The block closes when that slot would no longer have a panel (off, NS-bypassed AMP/CAB, missing model or values), when `chainSync` becomes `syncing` (patch change or Reload covers the body), and when `PatchBody` unmounts on disconnect.

Alternative considered: remove the tile from the audio chain. Rejected. The chain is the signal order; the user asked for a block above the other panels, and the on/off switch has to stay reachable.

### A is live, B is a local copy, and Play keeps both editable

Opening copies `{ modelId, values }` from the slot into side B and does not write. Until Play, the sounding side renders from the session snapshot and its edits call `setSlotModel` / `setSlotControl` as today. The other side renders from local state. Its edits, including a model change, update only that copy. A local model change fills values with `defaultValuesFor`, matching what `setSlotModel` does to the snapshot, and does not call the session.

Play copies both sides into refs. While the cycle runs, both panels stay editable. An edit on the sounding side goes through the session and updates that captured side, with the same throttle and flush as a normal panel. An edit on the other side updates only that capture. A model change on the local side still fills `defaultValuesFor`. The seconds field becomes the patch A/B countdown: the number of seconds left in the dwell, and a line above it that fills toward the other side for that dwell. The sounding side's rule lights while the cycle runs and is idle otherwise. Bluetooth live model or control reports do not move the panels mid-cycle. The next apply overwrites the slot with the captured side, including edits made while the cycle was running. Stop binds the last applied side back to the live snapshot and leaves the other side local. Use A and Use B stop the cycle, write that captured side when it is not already on the pedal, do not save the patch, and close the block.

The sounding panel uses the existing hover highlight and `aria-current="true"`.

Alternative considered: bind both panels to the session and swap by writing on every edit of B. Rejected. Editing B would replace A on the pedal before Play.

### Apply is model, then the controls that still differ

The dwell effect matches patch A/B. It arms a timeout only while playing and `chainSync === "idle"`. When the timeout fires it applies the other captured side:

1. If the slot's model differs, `await session.setSlotModel(kind, modelId)`. That call no-ops while syncing and, on success, stores the model's default values.
2. For each visible control whose snapshot value still differs from the captured value, `await session.setSlotControl(kind, index, value, { flush: true })`.

Same-model applies skip step 1 and write only the controls that differ. Play does not apply the side already sounding. If `setSlotModel` or a control write returns without changing the snapshot (sync started, or the value was already there), bump a dwell epoch when the chain is still idle so the effect arms a new full dwell, same as patch A/B's no-op `setPatch`. Do not bump when the call entered `syncing`.

`setSlotModel` does not send control values. The follow-up flushes are what make the pedal match the captured side after a model change. They are one switch, not a slider drag, so they are not throttled into a single trailing write.

Alternative considered: a session `applySlotSnapshot`. Rejected. The session would grow a second write path for a UI wait, and the façade rule is to keep new write families out unless they are a new protocol family.

### The two cycles share a Controller claim, not the session

`PatchBody` holds a small claim: which cycle is running, and each side's stop function. Starting module Play calls the patch stop, then starts the module cycle, and does not call `setPatch`. Starting patch Play calls the module stop, then starts the patch cycle, and does not apply a module side. Neither stop closes the other setup.

Space is one window listener. While the module block is open it belongs to that block, including when patch setup is also open. `PatchBar` ignores Space in that case. Focus in an input, textarea, button, combobox, or dialog still does not toggle, matching patch A/B.

### Header controls

The info button is removed. When `model.description` is set, the kind icon is a button that opens the existing description dialog (`About` is not the label; the accessible name stays `About ${model label}`). Without a description the icon is not a button.

The A/B control is an outline button labeled `A/B` with tooltip `A/B Test - Compare Modules`, in the header slot the info button used. Use A and Use B are outline buttons too, so they read as buttons before hover. The block uses the patch bar band (`bg-muted`, `dark:bg-black/35`), bleeding to the page edges. `Use A` (tooltip `Set side A and close`) is centered above side A, `Play` / `Stop` is centered above the seconds field, and `Use B` (tooltip `Set side B and close`) is centered above side B. The panels stay in the same column as the grid.

The seconds input is the same control patch A/B uses: accessible name `Seconds`, integers 2–200, default 5, empty allowed while typing, clamp on blur and Play. Lift that input into a sibling under `src/features/controller/` and use it from `PatchBar` and the block so the range cannot drift. UI imports `@/device/session` only.

On a wide row the order is side A, seconds, side B. Narrow widths stack in that same order.

## Risks / Trade-offs

- [A model switch plus one flush per differing control is a burst on Bluetooth] → Accepted. It happens once per side change, and skipping unchanged controls keeps it smaller than rewriting every knob. Overlapping the next dwell would apply while the previous writes are still in flight.
- [Bluetooth live edits during the cycle land on the snapshot, then the next apply overwrites them] → The panels stay on the captured copies, so the UI does not flicker. The overwrite is the point of the cycle.
- [Heard time is dwell plus the writes, not dwell from the click] → Same trade-off as patch A/B. The delta specs the idle dwell.
- [`setSlotModel` resets snapshot values to defaults before the control flushes] → The captured copy is in a ref, not read back from the snapshot. The flushes restore the captured controls.
- [Chain refresh unmounts the body and would reopen a stale block if the id survived] → Entering `syncing` clears the open slot. The overlay already makes the panels unusable.
- [A timeout fires after Stop if cleanup is missed] → The effect cleanup is the only timer. Stop, Use A, Use B, and unmount clear playing before any further cycle apply.

## Migration Plan

UI only. No stored preference and no protocol change. Reverting the panel and block removes module A/B; writes already sent are ordinary model and control SETs.

## Open Questions

None. The chain row stays, B starts as a copy and writes only when it becomes the sounding side or the user chooses Use B, and the dwell matches patch A/B. Those are fixed in the delta spec.
