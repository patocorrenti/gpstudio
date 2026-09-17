## Context

See `proposal.md` for why. `DeviceSession.connect` marks the session connected at patch `0` and does not query the pedal. `handleInbound` ignores bytes unless Log capture is on, so dumps never reach the snapshot (`src/device/session.ts`). Controller then shows `00` with numeric labels (`src/features/controller/ControllerPage.tsx`). Official CC cannot read the current patch or names (`openspec/changes/live-controller/design.md`). USB already requests Web MIDI SysEx (`src/midi/web.ts`); Bluetooth already unwraps BLE-MIDI SysEx (`src/bluetooth/ble-midi.ts`). Patch recall stays official CC 0 on both links (`src/device/encode.ts`). Third-party GP-5 / GP-50 editors perform a post-connect request/response pipeline and a loading overlay; Patone must not copy their source or payloads (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- Connected snapshot carries `sync` (`syncing` | `ready`) and optional names for 00–99.
- After `connect`, request current patch + name list on the open link; apply decoded identity; never send CC 0 for connect, sync end, or inbound patch reports.
- Controller: loading while `syncing`, patch bar when `ready`. Chrome stays connected.
- Inbound identity decode runs even when Log capture is off. Log still does not apply traffic.
- Permanent protocol-reference doc plus architecture/context updates.

**Non-Goals:**

- Full preset / global / IR / NAM dumps or editor writes.
- Changing `MidiTransport` / `BluetoothLink` contracts or adding Tauri commands.
- Treating USB as duplex for knobs or flipping `liveFromPedal` true on USB.
- Vendoring third-party editor JavaScript or SysEx hex.

## Decisions

### 1. Connected then sync; modal already closed

**Choice:** `connect()` still opens the link, emits `status: "connected"` with `sync: "syncing"`, and returns. The Connect modal can close. Controller reads `sync` and shows loading. A generation token aborts the pipeline on disconnect or a newer connect.

**Why:** Matches the intended UX (modal done, Controller loading) and keeps chrome on the device name (`device-connection`).

**Alternative:** Keep the modal open until dumps finish. Rejected; connection and identity sync are different phases.

### 2. Patone-owned identity codec; editors are references only

**Choice:** Add a device-layer codec that encodes two request kinds (name list, current patch) and decodes three inbound kinds (name-list fragments + terminator, current-patch identity, later pedal-initiated patch change). Frame bytes come from Patone captures on USB and Bluetooth, not from pasted third-party source. Document the working editors in `docs/protocol-references.md` and link them from `docs/architecture.md`:

- GP-50 Bluetooth: https://rvalladares.com/gp5/gp50editor/
- GP-50 USB: https://rvalladares.com/gp5/gp50editor/usb.html
- GP-5 Bluetooth: https://rvalladares.com/gp5/gp5editor/
- GP-5 USB: https://rvalladares.com/gp5/gp5editor/usb.html

Those pages are runtime/behavioral references (post-connect loading, name list then current patch, USB vs Bluetooth). If GP-5 and GP-50 frames differ, branch on session `model`.

**Why:** `docs/architecture.md` forbids copying reverse-engineered SysEx. The encoder seam already lives in `DeviceSession`. Observed pipeline: request name dump (fragmented SysEx, 100 names), then current patch; stop. Do not follow their later IR/NAM/global steps.

**Alternative:** Paste request hex from the third-party inline script. Rejected.

### 3. Sequential names then current patch, bounded timeout, fail open

**Choice:** While `syncing`, send the name-list request, accumulate fragments until the dump is complete or the step times out, then send the current-patch request, then set `sync: "ready"`. Bluetooth timeouts MAY be longer than USB. If names miss, still query current patch. If current patch misses, keep snapshot `patch: 0` and do not send CC 0. If Web MIDI fell back to `sysex: false`, skip requests and go `ready` immediately.

**Why:** Names are needed to label the current index; current patch is the user-visible win. Controller must not load forever (`live-controller`).

**Alternative:** One parallel blast of every editor dump. Rejected; extra traffic and out of scope.

### 4. Always decode identity; Log stays a viewer

**Choice:** Split `handleInbound`: always run the identity decoder while connected; append to the Log buffer only when capture is on. Applying a decoded patch index or name list notifies snapshot listeners. Log listeners stay separate.

**Why:** Today identity is dropped whenever Log is closed. Spec: Log MUST NOT apply traffic; the session MAY (`inbound-log`).

**Alternative:** Arm Log capture during sync. Rejected; would fill or require the Log page and still forbid snapshot apply.

### 5. Same snapshot on USB and Bluetooth; `liveFromPedal` unchanged

**Choice:** Both links run the same sync pipeline. USB bytes go through `MidiTransport.send` as raw SysEx. Bluetooth bytes go through the existing BLE-MIDI wrap in the encoder (`encode.ts`), same as CC 0. `liveFromPedal` stays true only for Bluetooth (live knob/module telemetry still later). Requested patch identity is not that flag.

**Why:** USB remains one-way for live controls (`docs/architecture.md`) but already carries dumps. Do not fork Controller.

**Alternative:** Bluetooth-only sync. Rejected; the user needs USB as well.

### 6. Snapshot fields and Controller branches

**Choice:** Connected snapshot adds `sync: "syncing" | "ready"` and `patchNames: (string | null)[]` (length 100, null = unknown). Controller: disconnected → empty; connected+syncing → English loading; connected+ready → patch bar. Selector label is `00`–`99`, list rows are `42 - Name` when a name exists. `setPatch` / `stepPatch` unchanged (CC 0). Inbound patch reports after `ready` update `patch` without sending.

**Why:** Smallest session shape that satisfies loading, current index, and names.

**Alternative:** A third `status: "syncing"` next to connected. Rejected; chrome would look disconnected.

## Risks / Trade-offs

- [Name dump is slow or incomplete on Bluetooth] → Per-step timeout; show numbers; still try current patch.
- [GP-5 vs GP-50 frames differ] → Model-specific requests from captures; shared decode where the shape matches.
- [Web MIDI SysEx denied] → Fail open to numeric `00`; do not send CC 0.
- [Inbound SysEx split across USB events] → Reassemble F0…F7 in the device layer if a backend delivers fragments; BLE-MIDI already reassembles.
- [No browser verification] → `tsc`; the user tests USB and Bluetooth on a real pedal. Use the documented editors only as a side-by-side reference, not as a source drop.

## Migration Plan

Additive snapshot fields. Disconnect still drops patch state. Rollback is reverting the change. Update `docs/architecture.md` and `openspec/config.yaml` in the same apply so agents stop treating patch-identity apply as forbidden.

## Open Questions

None for this slice. Exact request bytes are an apply-time capture fill-in, not a spec fork.
