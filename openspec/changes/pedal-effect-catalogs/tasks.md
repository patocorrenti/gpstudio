## 1. Catalog membership

- [x] 1.1 Add optional `devices` on `FxControl` (omit means both pedals) and a helper that returns a model's controls for one pedal. Verify a shared control is returned for GP-5 and GP-50, and a GP-50-only control is returned only for GP-50.
- [x] 1.2 Set `devices` to GP-50 only on PRE C-Wah, PRE AC Sim, and CAB AC. Leave user IR slots and the other factory models on both pedals. Verify `modelsForKind` omits those three on GP-5 and includes them on GP-50, and that startup still accepts one wire per kind.
- [x] 1.3 Tag Sync, S-Sync, and D-Sync as GP-50 only. Walk the GP-5 and GP-50 effect-list parameter columns and tag any other shared knob the manuals name differently, without splitting the model. Verify a GP-5 control list for A-Chorus has no Sync and a GP-50 list does.
- [x] 1.4 Keep one B-Boost entry on wire `0b 00 00 00` with Gain, VOL, Bass, and Treble for both pedals (confirmed in the GP-50 reference editor `defaultsPRE`; do not paste that source). Verify both pedals' control lists show those four labels and no Tone.

## 2. Session and panels

- [x] 2.1 Use the pedal's control list for slot panels and for session control writes. Verify a GP-5 session does not send a model write for C-Wah, AC Sim, or CAB AC, and does not send a Sync control write. Verify a GP-50 session can still select C-Wah and AC Sim.
- [x] 2.2 Keep dump decode on the existing wire map. Verify a wire that is not in the connected pedal's catalog stays unwritable, and a shared model such as Tweedy still loads on both pedals.

## 3. Check

- [x] 3.1 Run the project typecheck and confirm it passes. No in-browser pass; USB and Bluetooth share this catalog filter, so no separate MIDI-backend check.
