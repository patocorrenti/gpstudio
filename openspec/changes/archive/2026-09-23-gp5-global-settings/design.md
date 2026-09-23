## Context

See `proposal.md` for why. Specs: `live-controller` (modal rows) and `device-connection` (GP-5 read, immediate write, no patch `modified`).

GP-50 globals already live in `src/device/globals.ts` and `src/device/session/globals.ts`. The session asks only when `model === "gp50"`, and the snapshot stores `globals: null` on GP-5. The modal in `src/features/connect/GlobalSettingsModal.tsx` renders every GP-50 row whenever `snapshot.globals` is set.

Both GP-5 editors send the same ask Patone already owns: `F0 0B 09 00 01 00 00 00 02 01 02 01 00 F7`. Their dump, effect/flag pairs, and footswitch write are not the GP-50 ones. Read `_reference/GP5bluetooth.html` and `_reference/gp5usb.html` for shape. Do not paste that JavaScript into `src/`.

## Goals / Non-Goals

**Goals:**

- One modal. GP-5 shows only the rows those editors control, in the same sections as GP-50.
- GP-5 decode and writes never reuse a GP-50 offset or a GP-50 effect/flag pair that means a different row.
- Bluetooth follow uses the live packets those editors apply. USB stays command-out.

**Non-Goals:**

- A second session, a new feature folder, or moving the modal. It stays beside the connection status.
- Global BPM. The editors compute it from delay time (`60000 / delay`) and write a delay parameter. It is not in the globals dump.

## Decisions

### 1. Same ask, model-specific dump

The ask bytes do not change. `sendGlobalsRequest` runs for GP-5 on the same schedule as GP-50: once per connect, after the first current-preset dump has landed, not in that burst, not on Reload or patch change.

The reply is a different packet. Classify it apart from the GP-50 dump and apart from current-preset fragments.

Editor packets on Bluetooth are BLE-wrapped (`80 80` before `F0`). Patone sees unwrapped MIDI, so F0-aligned offsets are the editor index minus 2. USB concatenates each fragment's payload from byte 9; those offsets are the F0-aligned offsets minus 9. That shift matches every field the USB editor reads.

| | GP-5 Bluetooth (F0-aligned) | GP-5 USB payload |
| --- | --- | --- |
| Classify | command `00 01`, path `01 02 01`, length 164 | command `00 05`, data length 48, terminator length 12 |
| Global volume | nibbles at 53 | 44 |
| Screen brightness | nibbles at 79 | 70 (derived; the USB editor does not read it) |
| Input level | nibbles at 89 | 80 |
| REC level | nibbles at 99 | 90 |
| Monitor level | nibbles at 109 | 100 |
| BT REC | nibbles at 139 | 130 |
| No CAB | byte at 150 | 141 |
| Footswitch | byte at 160 | 151 |

GP-50 stays command `00 02` / length 210 on Bluetooth and command `00 08` or `00 09` (terminator 20 or 22) on USB. A packet that classifies as one model must not decode as the other. Unknown headers stay fail-open and must not feed the chain assembler.

Levels are signed −20…+20. Global volume is 0–100. Footswitch is the raw byte 0–4. No CAB is nonzero = on. If a required field is out of range, the dump does not apply (values stay unknown). Screen brightness is 1–100. If that byte is missing or out of range, the other fields still apply and screen brightness stays unknown.

**Choice:** Lock these offsets from the two editors, the same way GP-50 locked its table. Do not wait for a separate Patone capture before the modal can edit.

**Alternative:** Keep GP-5 at `globals: null` until an operator log lands. Rejected: that is the gate this change exists to remove, and both editors already agree on the ask and on every shared offset.

### 2. Writes are GP-5 pairs, still family `1111` except the footswitch

Re-derive with `src/device/sysex-nibble.ts` (CRC-8 ATM, poly `0x07`, init 0, nibble-expand, path `01 01 04`). Do not paste the editors' string builder.

Packed `01 00 0a 11 11`, effect, flag, then the value byte:

| Row | effect | flag | value |
| --- | --- | --- | --- |
| Global volume | 2 | 2 | 0–100 |
| Input level | 1 | 3 | signed −20…+20 |
| No CAB | 3 | 3 | 0 off, 1 on |
| REC level | 1 | 4 | signed −20…+20 |
| BT REC | 5 | 4 | signed −20…+20 |
| Monitor level | 2 | 4 | signed −20…+20 |
| Screen brightness | 3 | 2 | 1–100 |

GP-50 BT REC is effect 2 / flag 4, which is GP-5 monitor. GP-50 monitor is effect 3 / flag 4. GP-50 REC mode right is effect 5 / flag 4, which is GP-5 BT REC. A GP-5 write must use the GP-5 row. A GP-50 write must not be sent to a GP-5.

Global volume is that SysEx, not CC 1. The editors' Global Vol slider sits on the main page; this modal puts it first, where GP-50 puts master volume, so it is not a second volume on the patch bar.

Footswitch is a shorter packed body, family `1115`, size `0x04`: `01 00 04 11 15 00` plus the mode byte 0–4 (`0-99`, `0-9`, `A-Z`, `CTL`, `Tuner`). Same CRC and nibble-expand. Not CC 28. Not a `1111` body.

Level sliders, global volume, and screen brightness throttle like effect sliders (~80 ms, flush on release). No CAB and the footswitch select send on change.

### 3. Bluetooth live map is per model

The 24-byte identity-family notify (command `00 01`, size `0x07`, path `01 02`, effect at byte 14, flag at byte 16, value nibbles at 21–22) is the same layout GP-50 already decodes. On a GP-5 the pairs mean:

| effect / flag | GP-5 field |
| --- | --- |
| 1 / 3 | input level |
| 3 / 3 | No CAB |
| 1 / 4 | REC level |
| 5 / 4 | BT REC |
| 2 / 4 | monitor level |
| 2 / 2 | global volume |

Decode with the connected model. On GP-5, effect 2 / flag 4 must not land in BT REC, and effect 5 / flag 4 must not land in REC mode.

Two further Bluetooth packets the GP-5 editor applies, and GP-50 does not:

- Global volume, F0 length 30, size `0x0A`, path `01 02`, effect 2 / flag 2.
- Footswitch, F0 length 18, size `0x04`, path `01 02 01 05`, value nibbles at bytes 15–16.

The Bluetooth editor's "Change global" handler does not update screen brightness. Do not invent a live screen packet. The dump and the user's own write still update that row.

USB must not apply any of these. Inbound CC 1 and CC 28 must not change GP-5 globals.

### 4. Snapshot and modal

`globals` becomes a model discriminant: GP-50 keeps master volume, REC mode, and Patch | Stomp; GP-5 has global volume, screen brightness, and the five footswitch modes. Connect stores an empty GP-5 value (fields null) instead of `null`, so the Global control appears and every unknown control stays disabled.

The modal branches on that discriminant. Shared rows reuse the GP-50 sections (Master, Input / Output, USB Audio, Footswitch). Global volume uses the Master section and the label Global volume. No CAB stays a switch. Footswitch stays a select. Screen brightness is its own section between USB Audio and Footswitch. REC mode, Patch, and Stomp are not rendered for GP-5.

`DeviceSession` stays the façade. UI imports `@/device/session` only. Extend the existing globals sibling; do not add another session file.

### 5. Screen brightness stays, because the Bluetooth editor writes it

The USB editor modal has no brightness slider. The Bluetooth editor does (effect 3 / flag 2, 1–100), and the dump field is in that packet. The USB payload offset 70 is the same minus-9 shift as the fields the USB editor does read.

**Choice:** Show it on both links. If a USB dump is too short to contain byte 70, the slider stays disabled and nothing is sent.

**Alternative:** Hide it because the USB HTML omits the control. Rejected: the user asked for every row those programs can control, and the Bluetooth program controls this one. A missing byte stays unknown rather than a guessed write.

## Risks / Trade-offs

- [Editor offsets disagree with a later Patone log] → Ship the table above and cover it with codec fixtures taken from those indices. If a capture shows the pedal ignored a SET or a field, stop. Do not invent a second body.
- [USB screen byte is derived] → Only the Bluetooth editor reads it. A short USB payload leaves screen brightness unknown.
- [Command `00 01` is a busy GP-5 command] → The dump match also requires length 164 and path `01 02 01`. Live notifies stay on their own lengths.
- [Shared 24-byte notify mis-maps BT and monitor] → The decoder takes the session model. A GP-5 monitor report must not change BT REC.
- [USB modal drifts from the pedal] → Accepted, same as GP-50. USB is command-out for these knobs.

## Migration Plan

No stored data to migrate. Apply updates `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md`: GP-5 sends this ask; the rows in the table are in scope; REC mode, CC 1, CC 28, and Global BPM stay out on GP-5; USB still does not apply live inbound globals. GP-50 behavior does not change.
