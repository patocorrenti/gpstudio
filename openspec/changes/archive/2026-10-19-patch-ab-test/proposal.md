## Why

Comparing two onboard patches means switching by hand and losing the timing. Controller should alternate the current patch with a second slot on a fixed interval so the user can hear them back to back, on USB and Bluetooth, without a new recall path.

## What Changes

- Add an **A/B** control at the left of the patch bar. Its tooltip reads `A/B Test - Patches`.
- Activating it enters A/B setup on the same bar:
  - The control becomes an **X** that closes the mode and restores the normal bar.
  - Save, Options (rename, duplicate, download, upload), Reload, P-Vol, and BPM leave the bar.
  - Previous, the current-patch selector, and next stay. Choosing or stepping still recalls that patch through the device session, with the existing unsaved-changes tooltip and no extra confirm.
  - To the right of that selector: a seconds input, default **5**, then a second patch selector, default **one slot ahead** of the current patch (wrap `99` → `00`), then **Play**.
- The seconds input is the dwell between switches (integer seconds, 2–200, default 5; empty while editing is allowed and resolves on blur or Play). The second selector only chooses the comparison slot. It does not recall a patch.
- **Play** becomes **Stop** and alternates the loaded patch (A) and the comparison slot (B): dwell, recall B, dwell, recall A, and so on. Each recall uses the existing session patch change (USB CC 0, Bluetooth SET family 1143, per `docs/architecture.md`). No recall is sent while a chain dump is in flight; the dwell waits until the chain is idle, then counts.
- **Stop** ends the cycle, leaves the pedal on the patch that is loaded, and returns to A/B setup (Play), not to the normal bar.
- Closing with **X**, or disconnecting, ends the cycle. Close restores Save, Options, levels, and Reload. Disconnect hides the bar as it does today.
- While the cycle is running, previous, next, both selectors, and the seconds input are not usable. Stop and X stay usable, including while the chain is syncing. They do not send a recall by themselves.
- If A and B are the same slot, Play is not usable.
- The same bar is used on USB and Bluetooth. React does not send raw MIDI.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-controller`: Patch bar gains an A/B setup and a timed alternation between the current patch and a comparison slot, using the existing session recall and the existing chain-sync lock.

## Non-goals

- A visible countdown, progress fill, or audio crossfade. The seconds control is the dwell length only.
- Remembering the last interval or comparison slot across sessions.
- Comparing more than two slots, random order, or a fade of patch volume.
- Editing the chain, levels, or store actions during the cycle.
- A new MIDI message, a DeviceSession timer, or a second session. Recall stays `setPatch` / `stepPatch`.
- Library browse, IR/NAM upload, or copying reference-editor source.
- Blocking Play when the working patch is modified. Recall discards unsaved edits the same way manual navigation does.

## Impact

- Controller patch bar (`src/features/controller/PatchBar.tsx`, and a sibling under `src/features/controller/` if the A/B controls need their own file). UI imports `@/device/session` only.
- `openspec/specs/live-controller/spec.md` when archived.
- No transport, codec, or `docs/architecture.md` protocol change. USB and Bluetooth keep their current recall encodings.
