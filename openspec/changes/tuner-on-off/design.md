## Context

See proposal.md for why. Official MIDI lists (GP-5 and GP-50) assign Tuner On/Off to CC 58 with the same off/on bands as modules: 0–63 off, 64–127 on. `gp5Cc.tuner` is already 58. Architecture still lists applying inbound tuner and a full tuner UI as later. Stomp press just shipped as one CC through `DeviceSession` with a Controller sibling; tuner is the same shape with an on/off pair instead of a one-shot 127.

## Goals / Non-Goals

**Goals:**

- One session action toggles the pedal tuner via CC 58 and keeps enough state for the button to show on vs off.
- Controller exposes that toggle next to the other pedal controls.

**Non-Goals:**

- A write-queue sibling (one CC on click, like `pressStomp`).
- Pitch decode, reference frequency, or mute/bypass tuner modes in the app.

## Decisions

### CC 58, values 0 and 127

Writes use 0 (off) and 127 (on), matching module on/off. Encode through the existing link wrap (USB raw, Bluetooth BLE-MIDI).

**Alternative:** always send 127 and rely on the pedal to toggle. Rejected; the chart is on/off, not a relative step.

### Snapshot `tunerOn: boolean`, app-owned only

While connected, the snapshot carries `tunerOn` (default `false` on connect). Toggle flips it and sends the matching CC. Disconnect drops it. Inbound CC 58 is ignored on USB and Bluetooth so a stale or missing notify cannot fight the button. Opening the tuner on the pedal by footswitches will not update the app until the user toggles twice (off then on) or reconnects — accepted for this slice.

**Alternative:** no snapshot field, React-local pressed state. Rejected; UI must not own MIDI truth.

**Alternative:** apply inbound CC 58 when `liveFromPedal` is true. Deferred; architecture still parks inbound tuner.

### No `modified`, no dump, no overlay

Tuner is a device mode, not a patch field. `setTuner` must not call the working-patch modified path, must not request a chain dump, and must not set `chainSync` to syncing.

### Patch change forces tuner off

App `setPatch` and pedal current-patch changes (including retarget while a load is in flight) clear `tunerOn` and send CC 58 = 0 when it was on. App recall sends that off before the patch CC. Navigating with the tuner open is unstable on the pedal.

### Controller control beside stomp presses

A feature sibling under `src/features/controller/` (or an addition next to `StompPressRow`). English label `Tuner`, `aria-pressed` from `tunerOn`, disabled while `chainSync` is syncing, hidden when disconnected. Same control on USB and Bluetooth. No pitch meter.

## Risks / Trade-offs

- [Pedal ignores 0/127 and needs 64 as the on threshold only] → Writes already use 127; if off needs a non-zero value, change only the off constant after a capture.
- [User opens tuner on the pedal; app still shows off] → Documented. A later change can apply inbound CC 58 or a SysEx notify if one exists.
- [Tuner write interacts with GP-5 footswitch mode `Tuner`] → Still send CC 58. Mode gating stays out.

## Migration Plan

No stored data. Ship encoder, session field + toggle, Controller control, and doc/context updates together. Rollback is reverting that slice.

## Open Questions

None. CC 58 and the on/off bands are in both manuals.
