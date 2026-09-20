## Context

See `proposal.md` for why. Live edits already mutate the pedal’s working buffer and the connected snapshot chain (`AudioChain`: 10 effect slots, plus EXP on GP-50). Save / rename store that buffer into a 00–99 slot (`114a`); recalling another patch drops it (`docs/architecture.md`). `DeviceSession` already compares two chains in `chainSlotsEqual` (stale-dump guard). UI never sends raw MIDI. Specs: `live-controller` (Save follows `modified`) and `device-connection` (baseline + `modified` on the snapshot).

## Goals / Non-Goals

**Goals:**

- One cloned baseline chain per selected patch, compared by value after every in-scope chain mutation.
- `modified` on the connected snapshot; Controller only reads it.
- Recapture after a load dump and after a successful current-slot store. Drop on patch change and disconnect.

**Non-Goals:**

- Sticky “touched” dirty that stays true after the user restores dumped values.
- Confirm / discard on patch change.
- A withheld local buffer (CC/SET still go out on-change).
- New SysEx, Tauri commands, or moving equality into a public module unless apply needs it.

## Decisions

### 1. Clone the dumped chain; do not use a sticky flag

**Choice:** Keep a private `baseline: AudioChain | null` on `DeviceSession`. After each chain write (toggle, reorder, model, control, Bluetooth live follow, dump apply), set `snapshot.modified` to whether `chainSlotsEqual(snapshot.chain, baseline)` is false. Clone with a shallow slot copy plus `values.slice()` (11 slots, a handful of numbers). Recapture by cloning the current working chain.

**Why:** The user asked for restore-to-clean when a module or knob returns to the dumped values. That comparison is already in the session. The payload is tiny; a boolean “touched” flag would be cheaper only by lying.

**Alternative:** Sticky dirty. Rejected; restoring DST or a knob would stay Modified. **Alternative:** Hash the dump bytes. Rejected; download/upload re-request dumps of the working buffer, and live edits never replace those bytes until a dump lands.

### 2. Recapture only on a newly selected patch dump and current-slot store

**Choice:** Arm a private `captureBaselineFromDump` flag when requesting the chain for connect, user `setPatch`, or a pedal-initiated patch change. `applyChain` clones the decoded chain into `baseline`, sets `modified: false`, and disarms. `storePatch` of the **current** slot (Save / rename) clones the current working chain and sets `modified: false` without a dump. `duplicatePatch` (other slot) does not recapture. `downloadCurrentPatch` and `uploadCurrentPatch` refresh the dump with the flag **off**, so `applyChain` updates the working chain and re-compares against the existing baseline (download stays modified; upload is modified unless the file already matched).

While `chainSync === "syncing"`, or `baseline === null`, `modified` is false. Patch change and `dropLink` null the baseline.

**Why:** A dump of the working buffer is not a store. Upload already refreshes the dump so the snapshot matches the pedal RAM, not slot N. Using the same recapture path as a patch load would clear Modified after download or upload.

**Alternative:** Recapture on every successful `applyChain`. Rejected; download would launder dirty. **Alternative:** Compare against the last stored `.prst`. Rejected; we do not keep a second dump, and volume/BPM are out of the chain snapshot.

### 3. Snapshot boolean, not a React-only derivation

**Choice:** Add `modified: boolean` to the connected `SessionSnapshot`. Every existing `this.snapshot = { ...this.snapshot, chain }` path (and live follow) goes through one helper that writes chain + `modified`. `PatchBar` reads `snapshot.modified`: Save sits before Rename, is disabled when clean, and uses an emerald style when modified. There is no separate Modified label.

**Why:** Bluetooth live follow mutates the chain without a Controller click. Deriving dirty in React from “last user gesture” would miss stomp/knob reports and would fork USB vs Bluetooth. Save as the only chrome keeps `modified` on the snapshot for later controls.

**Alternative:** Session event `onDirty`. Rejected; the snapshot is already the UI contract. **Alternative:** Keep Save always enabled. Rejected; the user asked for dirty-only Save.

### 4. Compared fields are the in-scope chain

**Choice:** Equality is order + `enabled` + `modelId` + `values` (same as `chainSlotsEqual` today). EXP on/off is included on GP-50. Onboard name, volume, tuner, and BPM are not. Rename still recaptures because it is a current-slot store, not because the name is compared.

**Why:** Those extras are not on the Controller chain snapshot (`docs/architecture.md`). Inventing dirty from them would require new session fields this change does not add.

## Risks / Trade-offs

- [Download dump flicker already sets `chainSync` syncing, which briefly hides Modified] → Accept; same busy gate as today. After the dump, re-compare so a dirty patch stays Modified.
- [A dump timeout leaves `baseline` null, so edits to the default-order chain never show Modified] → Accept; without a dump there is no stored picture to compare. A late dump for that patch still captures a clean baseline (existing dump-apply replaces the chain).
- [Bluetooth live follow marks Modified even though the user did not touch Controller] → Intended; that still diverges the working buffer from the last loaded/stored chain.
- [Optimistic Save recapture if the pedal ignored `114a`] → Same class as today’s optimistic `patchNames`. No ACK in this protocol slice.
- [Upload of a file that matches the baseline stays clean] → Correct; comparison is by value.

## Migration Plan

Additive snapshot field. Disconnect still drops session state. Rollback is reverting the change.

## Open Questions

None. Confirm-on-patch-change stays a later change.
