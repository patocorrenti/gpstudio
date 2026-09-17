## Context

See `proposal.md` for why. `DeviceSession` already runs a post-connect identity pipeline (name list, then current patch index) and applies inbound identity even when Log is off (`src/device/session.ts`, `src/device/identity.ts`). Controller shows loading while `sync: "syncing"`, then the patch bar (`src/features/controller/ControllerPage.tsx`). Official CC maps already name the ten effect modules (`src/device/cc.ts`) but cannot read order or on/off. USB is still one-way for knobs; requested dumps and opportunistic patch-load dumps do not make it duplex (`docs/architecture.md`). Third-party editors remain behavioral references only (`docs/protocol-references.md`).

Valeton manuals (GP-50 firmware V1.0.5; GP-5 MIDI list): ten effect modules in default order NR → PRE → DST → NS (N→S / SnapTone) → AMP → CAB → EQ → MOD → DLY → RVB. GP-50 adds EXP at the end of the edit chain. Movable: NR, PRE, MOD, DLY, RVB. Fixed: DST, NS, AMP, CAB, EQ. Enabling NS disables AMP and CAB on the pedal. Marketing “up to 9 modules simultaneously” is that constraint, not a ninth slot.

## Goals / Non-Goals

**Goals:**

- Connected snapshot carries a model-specific audio chain (order + on/off).
- Initial sync shows the patch bar after identity (names + current index), then loads the chain behind a busy overlay.
- Patch changes refresh the chain without extra CC 0 just to dump.
- Controller draws display-only slots from the snapshot.
- Device-layer profile encodes slot count, default order, and move rules for later edits.

**Non-Goals:**

- UI on/off, drag-and-drop, or any chain write (CC 48–57 or SysEx).
- Decoding or showing effect parameters, IRs, NAM, globals.
- Applying liveFromPedal module CC while staying on the same patch.
- Changing MidiTransport / BluetoothLink contracts.

## Decisions

### 1. Chain lives on the snapshot, not in React

**Choice:** Connected snapshot gains `chain: AudioChain`. `AudioChain` is an ordered list of slots `{ id, enabled }`. `id` is one of `nr | pre | dst | ns | amp | cab | eq | mod | dly | rvb` plus `exp` only on GP-50. Missing dump uses `defaultChain(model)` with every `enabled: false`. Disconnect drops it. Controller only reads the snapshot.

**Why:** Same seam as patch index/names. UI never talks MIDI (`docs/architecture.md`).

**Alternative:** Controller infers a static NR…RVB row from `cc.ts`. Rejected; order is per-patch.

### 2. Profiles own slots and move rules

**Choice:** Add a small device profile (next to `src/device/models.ts`) with:

- Effect ids and English short labels (NR, PRE, DST, NS, AMP, CAB, EQ, MOD, DLY, RVB, EXP).
- Default order as above; EXP last and GP-50-only.
- `movable`: NR, PRE, MOD, DLY, RVB.
- `fixed`: DST, NS, AMP, CAB, EQ.
- EXP is neither dragged nor inserted between effects; it stays the trailing GP-50 slot.

This change does not enforce move rules in the UI. It stores them so phase 2 does not rediscover the manual.

**Why:** Model vs protocol vs link stay separate. GP-5 and GP-50 share the ten effects; only EXP differs.

**Alternative:** Treat NS vs AMP/CAB exclusivity as a slot-count change. Rejected; manuals still draw ten effect modules.

### 3. Patone-owned chain dump codec; editors are references only

**Choice:** New device-layer codec encodes one request kind (`current-chain`) and decodes inbound dumps into `{ id, enabled }[]`. Frame bytes come from Patone USB/Bluetooth captures, not pasted third-party source. Decode only order + on/off; ignore other preset fields. USB vs Bluetooth differ only by the existing BLE-MIDI wrap in `encode.ts`. If GP-5 and GP-50 frames differ, branch on session `model`.

Exact request bytes and field offsets are an apply-time capture fill-in, same as identity.

**Why:** `docs/architecture.md` forbids copying reverse-engineered SysEx. Official CC 48–57 can later *write* on/off; they cannot read order.

**Alternative:** Parse live CC 48–57 as chain state. Rejected; USB does not telemetry knobs, and CC has no order.

### 4. Extend the sequential sync pipeline

**Choice:** Keep `sync: "syncing" | "ready"`. After names then current-patch (existing timeouts), set `ready` and show the patch bar. Then request the chain dump in the background with a per-step timeout (Bluetooth MAY be longer) and `chainSync: "syncing"`. Skip all SysEx if USB `sysexEnabled()` is false and go `ready` immediately. Generation token still aborts on disconnect / newer connect. Chrome stays on the device name the whole time.

**Why:** Waiting for the chain dump before `ready` added a full Bluetooth timeout when no dump arrived (GP-50 capture: only a 22-byte current-patch identity after patch change). The patch selector should not wait on that.

**Alternative:** Keep one loading state until chain dump or timeout. Rejected; it made connect feel much slower than patch-sync.

### 5. Refresh on patch change; opportunistic dump + request

**Choice:** After `ready`, `setPatch` still sends only official CC 0, then requests `current-chain` (generation-scoped). Inbound `patch-changed` still re-requests current patch, then also requests the chain. If a patch-load dump arrives unsolicited (USB/Bluetooth), apply it when it decodes as a chain. Do not send CC 0 to provoke a dump. Until the new dump arrives, keep the previous chain (spec MAY).

**Why:** Architecture already says the pedal dumps on patch load. A follow-up request covers Bluetooth slowness and missed opportunistic frames.

**Alternative:** Rely only on opportunistic dumps. Rejected; identity already taught us to ask.

### 6. Requested chain dumps are not `liveFromPedal`

**Choice:** `liveFromPedal` stays true only for Bluetooth and is still unused for knobs/modules. Applying a *requested* or patch-load chain dump is the same class as identity apply, on USB and Bluetooth. Do not apply inbound CC 48–57 (or other live module telemetry) while the patch stays the same.

**Why:** USB remains one-way for live controls. Physical module toggles on the pedal will look stale until the next patch dump; that is accepted for phase 1.

**Alternative:** Flip `liveFromPedal` and start applying module CC. Rejected; out of scope and USB-incompatible.

### 7. Display-only chain under the patch bar

**Choice:** When `ready`, Controller renders the patch bar, then a body below it for the chain (and later patch controls). While `chainSync` is `syncing`, an English busy overlay covers that whole body so stale slots cannot be seen or used. GP-5: 10 slots. GP-50: 11, EXP last. Same layout on USB and Bluetooth.

**Why:** A spinner beside visible (and wrong) all-off slots is misleading. The patch bar stays usable; everything under it is blocked until the dump lands or times out.

**Alternative:** Put the chain on Editor. Rejected; the user asked for the live chain after patch sync.

### 8. Architecture / context: chain SysEx is in scope, full editor is not

**Choice:** In the same apply, update `docs/architecture.md` and `openspec/config.yaml` so the in-scope SysEx subset is identity **plus** current-patch chain (order + on/off). Full preset parameters, IR/NAM, and editor writes stay later. Protocol-references copy can note that working editors dump the current preset after names; Patone still must not copy their payloads.

**Why:** Stop the next agent from treating chain dumps as forbidden editor SysEx.

## Risks / Trade-offs

- [Chain dump frames are long or split] → Reuse `SysexAssembler`; capture-driven decode like the name list; timeout fail-open.
- [GP-5 vs GP-50 dump layout differs] → Branch on `model`; shared ids where the shape matches.
- [Opportunistic dump races the request] → Apply whichever valid chain arrives; generation token drops stale sessions.
- [On-pedal module toggle is invisible until the next patch dump] → Accepted; liveFromPedal module CC is a later change.
- [NS on disables AMP/CAB] → Display the dump; do not invent extra slots or auto-rewrite state.
- [No browser verification] → `tsc`; the user tests USB and Bluetooth on a real pedal. Use documented editors only as a side-by-side reference.

## Migration Plan

Additive snapshot field and one extra sync step. Disconnect still drops live state. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

None that fork the specs. Exact `current-chain` request bytes and on/off/order offsets are an apply-time capture fill-in.
