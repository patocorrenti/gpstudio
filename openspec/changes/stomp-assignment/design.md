## Context

See `proposal.md` for why. The current-preset dump already runs after identity and on patch change (`DeviceSession`, `ChainDecoder` in `src/device/chain-codec.ts`). That decoder only reads enable bits and order (`GP50_LAYOUT` / `GP5_LAYOUT`). Stomp assignment is per patch on the pedal (one footswitch on GP-5, two on GP-50; one stomp can toggle several modules, as footswitch follow already showed). EXP is not a stomp target. Official CC cannot read or write those assignments. `chain-reorder` is a separate in-flight change (order, not assignment). Specs: `live-controller` (show/edit 1 vs 2 stomps) and `device-connection` (dump decode + write, no extra dump on edit).

## Goals / Non-Goals

**Goals:**

- Decode stomp assignment from the dump we already request; put it on the snapshot.
- Controller edits it through the session; send a Patone-owned assignment write on USB and Bluetooth.
- GP-5 one stomp, GP-50 two; EXP never assignable.

**Non-Goals:**

- A second dump request, full preset write, or Patch/Stomp mode (CC 28).
- Copying third-party SysEx. Exact offsets/write bytes are apply-time captures.

## Decisions

### 1. Same dump, new fields on the snapshot

**Choice:** Extend the existing chain-dump parse. Snapshot grows `stomps: EffectId[][]` (length 1 on GP-5, 2 on GP-50). Each inner list is the modules that stomp toggles. Empty list is valid. Missing dump → empty lists, do not send a write. Patch change replaces assignment from the new dump, same as chain.

**Why:** Specs require using the dump already in the pipeline. Assignment is per patch.

**Alternative:** New SysEx request just for stomps. Rejected; extra Bluetooth round-trip when the preset dump already carries it.

### 2. Capture-driven offsets and write, not a third-party drop

**Choice:** At apply, change a stomp assignment on the pedal, request the current dump, and diff against the previous dump of the same patch to find assignment bits. Then capture the **app→pedal** write (or the bytes the pedal accepts when Patone sends a candidate). Keep USB vs Bluetooth wrap on the existing encoder seam. Do not copy third-party payloads (`docs/protocol-references.md`).

**Why:** Same fill-in as identity and chain codecs. Official CC has no assignment map.

**Alternative:** Write the whole preset blob. Rejected; out of scope and easy to clobber unrelated fields.

**Fill-in (2026-09-17):** Dump offsets are locked (GP-50 1006/1014). Pedal→app live command `0D` is locked as an assignment **notify**. Three SET candidates (host `05`, live `0D` with checksum `00 00`, host `0D`) were ignored on the pedal, including USB, so BLE-MIDI size is not the only cause. Lab log and next experiment: `spike-assignment-write.md`. Encoder still sends the last failed host-`0D` frame until a candidate is accepted.

### 3. Optimistic edit, no chain overlay

**Choice:** `setStompAssignment` updates the snapshot then sends the write. Do not call `refreshChain` / `chainSync: "syncing"`. Toggles and footswitch follow stay on `chain[].enabled`.

**Why:** Specs forbid overlay solely because assignment changed. Assignment is not on/off.

**Alternative:** Re-dump after every edit. Rejected; slow on Bluetooth and hides the row.

### 4. Count from model, not from Patch/Stomp mode

**Choice:** GP-5 always one stomp UI; GP-50 always two. Do not gate on CC 28. The pedal still only *uses* those assignments in Stomp mode; Patch-mode footswitches stay patch changes.

**Why:** Specs require count by model. Mode display is a later extra (`docs/architecture.md`).

**Alternative:** Show assignment only while mode is Stomp. Rejected; extra state we do not sync yet, and users need to edit assignment before switching mode.

### 5. USB one-way for live assignment; Bluetooth dump is enough unless a notify is captured

**Choice:** USB never applies unsolicited assignment frames. Bluetooth apply of a live assignment notify is optional fill-in if Log shows one; otherwise dumps after patch change remain the source of truth. `liveFromPedal` stays Bluetooth-only.

**Why:** USB is not duplex (`docs/architecture.md`). Footswitch follow already taught us not to guess frames.

**Alternative:** Treat assignment like live-module command `0E`. Rejected until a capture exists; `0E` is on/off mask, not which modules belong to which stomp.

### 6. Architecture / context catch up

**Choice:** In the same apply, document that this assignment slice is in scope. Full editor, IRs/NAM, Patch/Stomp UI, and chain reorder stay their own work.

**Why:** Stop the next agent from treating assignment as forbidden editor SysEx or as USB-duplex.

## Risks / Trade-offs

- [Assignment bits sit in the dump but we guess the wrong offset] → Mitigated: GP-50 dump diff locked 1006/1014. GP-5 920 still QA.
- [Inbound live `0D` is not a SET] → Confirmed: exact notify echo, host `0D`, XOR-CS, CC 28+H1 all ignored. Next is H7 (CRC-8 + nibble-expand per effect), not more live envelopes.
- [Write clobbers order or on/off] → Encode only assignment fields; verify a round-trip dump still matches chain order/on/off.
- [One module on both GP-50 stomps] → Allow it unless a capture shows the pedal forbids it; do not invent exclusivity.
- [User is in Patch mode and the footswitch still changes patches] → Out of scope; assignment still stored on the patch.
- [No browser verification] → `tsc`; the user tests dump decode and write on a real pedal.

## Migration Plan

Additive snapshot field and dump parse. Disconnect drops it. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

Dump offsets are filled in. Live `0D` is notify-only (exact captures ignored). The assignment **SET** is likely a checksummed nibble-packed per-effect parameter write (behavioral note from the public GP-50 editor UI; no payload copy). That does not fork the specs. See `spike-assignment-write.md` H7. Do not apply inbound `0D` until that write works.
