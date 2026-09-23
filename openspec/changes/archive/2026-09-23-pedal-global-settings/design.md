## Context

See `proposal.md` for why. Specs: `live-controller` (modal) and `device-connection` (read, immediate write, patch `modified` stays untouched).

Controller already edits the current patch, which needs Save. The pedal’s GLOBAL menu does not. GP-5 and GP-50 do not share that menu, and the published CC charts (`src/device/cc.ts`, both manuals’ MIDI lists) cover almost none of it. `docs/architecture.md` still lists GP-50 master volume and Patch | Stomp as later, and it says USB must not apply live knob reports.

The local third-party editor in `_reference/` is the GP-50 build. Read it for shape. Do not paste it into `src/`. There is no local GP-5 editor.

## Goals / Non-Goals

**Goals:**

- One modal, model-specific, for every global this change can read and write.
- Immediate writes through `DeviceSession`. No Save, and no change to patch `modified`.
- GP-50 only, until a GP-5 capture locks the shared rows.

**Non-Goals:**

- Menu rows with no CC and no editor control (calibration, bypass type, EXP/FS assign, display, MIDI routing, Auto CAB, language, factory reset, firmware About, GP-5 footswitch modes `0-99` / `0-9` / `A-Z` / `CTL` / `Tuner`).
- Moving patch volume or BPM into the modal. Family `1142` stays the upload path.

## Decisions

### 1. Survey, then show only the reachable rows

Manuals: GP-5 *Global Settings* (firmware V1.0.3, pp. 12–13) and GP-50 *Global Settings* (pp. 19–24). Both say edits apply immediately and do not follow the patch.

| Setting | GP-5 manual | GP-50 manual | MIDI |
| --- | --- | --- | --- |
| Input level −20…+20 dB | yes | yes | not a CC; GP-50 editor writes it |
| No CAB | yes | yes | same |
| REC level, BT REC, monitor level −20…+20 dB | yes | yes | same |
| REC mode L/R Dry or Wet (default Wet) | no | yes | same |
| Footswitch | `0-99`, `0-9`, `A-Z`, `CTL`, `Tuner` | Patch or Stomp, plus analog/DSP bypass | GP-50 Patch \| Stomp is CC 28. GP-5 modes and bypass type are not in either CC chart or the editor modal |
| Master volume 0–100 | no | not in the GLOBAL menu; it is the panel knob, CC 1 | official CC 1. Relative step CC 17 stays unused |
| EXP calibrate, EXP/FS jack and FS3/FS4, display sleep and brightness, MIDI source and channels, Auto CAB match, language, factory reset, About | language, reset, About on GP-5; the rest on GP-50 | | no CC, and the editor’s Global Settings modal does not include them |

GP-5’s MIDI list also has song-list CC 29 and 30. Those are not global settings and stay unused.

**Choice:** The modal lists the GP-50 rows in the “MIDI” column above. Everything else is documented here and omitted. GP-5 shows a row only after a GP-5 capture accepts that read and write; until then it shows no Global settings control and the session does not send the GP-50 request.

**Alternative:** Ship every manual row as a disabled control. Rejected: a control that cannot be read or written looks like a bug. **Alternative:** Put master volume on the patch bar. Rejected: it is not stored in the patch, and `docs/architecture.md` already keeps it off that bar.

### 2. Official CC where the manual publishes one

GP-50 master volume is CC 1, value 0–100. GP-50 footswitch mode is CC 28, Patch as 0 and Stomp as 127 (the list’s 0–63 / 64–127 split). The editor also sends a SysEx for both. Do not send that SysEx. One write path, the one in the manual.

The other GP-50 rows have no CC. The editor writes them as a parameter SET in the family Patone already owns: packed `01 00 0a 11 11`, path `01 01 04`, CRC-8 ATM (poly `0x07`, init 0), nibble-expand. Observed effect / flag pairs, value last:

| Row | effect | flag | value |
| --- | --- | --- | --- |
| Input level | 1 | 3 | signed −20…+20 |
| No CAB | 3 | 3 | 0 off, 1 on |
| REC level | 1 | 4 | signed −20…+20 |
| BT REC | 2 | 4 | signed −20…+20 |
| Monitor level | 3 | 4 | signed −20…+20 |
| REC mode L | 4 | 4 | 0 Wet, 1 Dry in the editor’s default label |
| REC mode R | 5 | 4 | same |

Re-derive the bytes with `src/device/sysex-nibble.ts`. Do not paste the editor’s string builder. If a capture shows the pedal ignored a SET, stop. Do not invent a second body. Confirm Dry/Wet polarity from that capture; the table’s 0 = Wet is the editor label, not a Patone log.

### 3. One globals dump per connect, GP-50 only

The editor’s sync log `Syncing: Global Parameters` sends `F0 0B 09 00 01 00 00 00 02 01 02 01 00 F7` after the current-preset ask and before preset-status, IR, and NAM. Patone already owns that ask envelope (the IR ask is the sibling with size `02 09` and path `01 02 02`).

**Choice:** After the current-preset ask, GP-50 requests that globals ask once per connect, on USB and Bluetooth, without a waiter. It does not block identity or chain readiness. Reload and patch change do not re-request it. Do not add the preset-status or NAM asks. Decode only the in-scope fields from a capture; the editor’s payload offsets are a hint, not the codec, until a log matches. Unknown headers stay fail-open and must not be parsed as a chain. A current-preset dump must not clear globals. Disconnect drops them.

GP-5 does not send this ask. The shared manual rows may use the same family, but that is not locked, and a GP-50 body must not be aimed at a GP-5.

### 4. Bluetooth follows; USB does not

The editor applies short inbound messages whose effect/flag match the table. That is the same live-notify class as other identity-family reports (path `01 02 04`), not a chain command `07` / `08` / `09`.

**Choice:** On Bluetooth, apply those reports to the exposed snapshot fields. They must not mark the patch modified. On USB, ignore them (`docs/protocol-references.md`: some live global changes are not notified over USB). The modal shows the snapshot, so a USB session can be stale if the user then edits GLOBAL on the pedal. Opening the modal does not re-request the dump.

### 5. Where the code lives

`DeviceSession` stays the façade. UI imports `@/device/session` only.

- Codec in `src/device/globals.ts` (request, decode, `1111` SET). Not inside the session file.
- A new sibling `src/device/session/globals.ts` owns the once-per-connect ask, snapshot apply, throttled level writes, and Bluetooth inbound. That is a new inbound family and a new throttled write family (`docs/architecture.md`).
- Modal UI is a sibling under `src/features/controller/`. Not `src/components/`.

CC 1 and CC 28 are encoded with the existing CC path. Level and toggle SysEx writes throttle like effect sliders (~80 ms, flush on release). Toggles and the two selects send on change.

## Risks / Trade-offs

- [GP-50 SET ignored] → Ship only the rows a capture accepts. Leave the rest out of the modal rather than guessing another body.
- [Dump offsets copied from the HTML] → Lock them against a Patone log before the modal can edit. Unknown values stay disabled and send nothing.
- [USB modal drifts from the pedal] → Accepted. USB is command-out for these knobs. Bluetooth follow covers the two-way link.
- [GP-5 shared rows feel missing] → The manuals differ, and the GP-5 wire is not locked. A later change adds them after a GP-5 log. Do not send the GP-50 ask in the meantime.
- [CC 28 and a SysEx foot write both exist in the editor] → Send only CC 28 so the pedal is not written twice.

## Migration Plan

No stored data to migrate. Apply updates `docs/architecture.md`, `openspec/config.yaml` context, and `docs/protocol-references.md` so master volume, Patch | Stomp, and the GP-50 globals subset are in scope, the omitted menu rows stay out, and USB still does not apply live inbound globals.
