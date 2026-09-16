## Context

See `proposal.md` for why. Controller can send CC 0 but starts at optimistic `00`. The Log page already records inbound MIDI. A GP-5/GP-50 patch load over USB produced: a 22-byte SysEx, an 18-byte SysEx, then 27 × 48-byte SysEx with indices `00 00` … `01 0A`. Bytes in those frames stay in `00`–`0F` (nibble encoding). In-patch effect toggles produced no MIDI. Web MIDI already requests `sysex: true` for the pilot; desktop `midir` uses `Ignore::None`. `docs/architecture.md` forbids copying third-party SysEx decoders; this phase-2 protocol is documented here from Patone captures.

## Goals / Non-Goals

**Goals:**

- Reassemble one dump from header + indexed chunks; nibble-decode the payload.
- Map slot, then name, then module on/off from diffs of our dumps.
- Session snapshot distinguishes `unread` vs decoded preset; Controller does not fake `00`.
- Identify a dump-request and send it on connect; until then wait for a dump.

**Non-Goals:**

- Writing presets, editor UI, IRs.
- Treating third-party editor source as the spec.
- Streaming in-patch hardware edits (pedal does not send them).

## Decisions

### 1. Own captures, not cloned protocol code

**Choice:** Document framing and field offsets only from Log captures and diffs. Keep notes in `src/device/sysex/` (or `docs/` next to that code) as comments + this design.

**Why:** Architecture forbids copying reverse-engineered editors. Our dump is enough to start.

**Alternative:** Port an existing web editor's decoder. Rejected.

### 2. Assembler in the device layer

**Choice:** `DeviceSession` feeds inbound SysEx to a dump assembler. Only a complete dump updates the snapshot. React never sees bytes.

**Why:** Same seam as CC: session owns protocol.

**Alternative:** Parse in the Log page. Rejected; Log is a capture UI, not the decoder of record.

### 3. Observed framing (from the 2026-09-16 capture)

**Choice:** Treat a dump as:

```
22-byte SysEx     announcement
18-byte SysEx     header / meta
27 x 48-byte      data, index nibble-pair 00 00 .. 01 0A
                  shape: F0 [ck] 01 0B [index] 01 03 [38 nibble bytes] F7
```

Nibble-decode payload bytes pairwise into ~19 binary bytes per chunk (~513 bytes total). Field offsets for slot/name/modules are found by diffing dumps, not guessed in this design.

**Why:** Matches the captured sequence (Log shows newest first; chronological order is the reverse).

**Alternative:** Assume CC 0 inbound. The capture had none.

### 4. Unread vs decoded snapshot

**Choice:** Connected snapshot includes `preset: { status: "unread" } | { status: "ready", slot, name?, modules? }`. Controller shows an unread state until the first complete dump. Sending CC 0 from the user still updates slot optimistically and typically triggers a new dump.

**Why:** Spec forbids presenting `00` as the pedal's patch.

**Alternative:** Keep showing `00`. Rejected; that is the current lie.

### 5. Dump request is a later task in this change

**Choice:** Ship assembler + slot mapping first. Capture what *we* send vs what the pedal emits, and what (if anything) another app sends on connect *as MIDI bytes in our Log*, then hard-code that request. Do not read foreign source.

**Why:** "Vamos de a poco." Connect-without-CC-0 is already true.

**Alternative:** Block the whole change on the request. Rejected; hardware load already dumps.

## Risks / Trade-offs

- [GP-50 dump differs from GP-5] → Capture both; keep model on the session.
- [Checksum / nibble order wrong] → Unit-test round-trip on saved captures in the repo (hex fixtures, no hardware).
- [Dump-request never found] → Leave unread until the user loads a patch; do not invent CC 0.
- [40-line Log ring buffer drops a dump] → Assembler is independent of the Log UI buffer; raise the Log cap so captures stay usable.
- [Copying a third-party decoder by accident] → Review: no files from those repos in the tree.

## Migration Plan

Additive. Optimistic `00` goes away. Rollback is reverting the change.

## Open Questions

None that block the plan. Slot/name/module offsets and the dump-request bytes are implementation findings recorded into the protocol notes as tasks complete.
