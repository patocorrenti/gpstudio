## Why

After connect, Patone already syncs patch index and names (`docs/architecture.md`), but Controller still has no picture of the current preset’s audio chain. Users need to see which modules sit in which slots and whether each one is on, for the patch that is already selected and whenever that patch changes.

## What Changes

- After the existing post-connect identity sync (names + current patch index), `DeviceSession` also requests the current patch’s audio-chain dump on the open link (USB or Bluetooth) and applies it to the snapshot. Chrome stays connected; Controller MAY keep its English loading state until that dump arrives or the step times out.
- When the user changes patch (official CC 0) or the pedal reports a patch change after sync, the session refreshes the chain for the new patch. It MUST NOT send extra patch recall solely to obtain the dump.
- Controller draws the chain as ordered slots: **10** effect modules on GP-5, **11** on GP-50 (the same 10 plus EXP at the end). Each slot shows the module that occupies it and a visible on/off state. Unknown dumps fail open (default order, unknown/off) without stomping the pedal.
- Official module set and default order come from the Valeton manuals: NR (noise gate) → PRE → DST → NS (N→S / SnapTone) → AMP → CAB → EQ → MOD → DLY → RVB. GP-50 adds EXP after RVB. Moveable vs fixed positions are modeled now (NR, PRE, MOD, DLY, RVB move; DST, NS, AMP, CAB, EQ stay fixed) but this change does not let the user reorder or toggle.
- The dump codec is Patone-owned, from Patone captures, same rule as identity SysEx. Third-party editors stay behavioral references only (`docs/protocol-references.md`). Full preset parameters, IR/NAM, and editor writes stay later.

## Non-goals

- Phase 2 of this work: turning modules on/off from the UI, drag-and-drop reorder (even within the documented rules), or sending chain edits on-change.
- Full preset read/write, rename, parameter knobs, globals, IR / SnapTone / NAM (`docs/architecture.md`).
- Applying liveFromPedal inbound volume/module CC while the user stays on the same patch (USB is still not duplex for knobs; Bluetooth telemetry of live toggles stays later).
- Copying reverse-engineered SysEx or JavaScript from third-party editors.
- Volume, tuner, CTL, GP-50 master/BPM/Patch|Stomp controls.
- Treating USB and Bluetooth as interchangeable, or reverting Connect to USB-only.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. The chain is the next live-controller slice after patch identity, not a new spec domain.

### Modified Capabilities

- `live-controller`: After identity sync, Controller draws the current patch’s audio chain in model-specific slots (10 on GP-5, 11 on GP-50) with each module’s on/off state. The chain updates when the selected patch changes. Slots are display-only in this change.
- `device-connection`: The connected snapshot carries the current audio chain. Initial sync MAY request that dump after patch identity; patch changes MAY refresh it. Chrome still stays connected during sync. Sync still MUST NOT send patch recall by itself.
- `inbound-log`: Log still MUST NOT apply traffic. `DeviceSession` MAY apply a decoded audio-chain dump to the snapshot independently of Log capture, same pattern as patch identity.

## Impact

- `src/device/session.ts`: connected snapshot gains chain state; post-connect pipeline adds a bounded chain dump after names + current patch; patch change (user CC 0 or inbound `patch-changed`) refreshes the chain; inbound decode runs even when Log is off.
- New device-layer chain codec (request/decode module order + on/off for the current patch). Encoder still wraps Bluetooth as BLE-MIDI. USB still uses `MidiTransport.send`. Exact request bytes are an apply-time capture fill-in.
- Device model/profile: slot count, default order, moveable vs fixed modules, GP-50 EXP slot. Official CC maps in `src/device/cc.ts` stay for later on/off writes; this change does not send CC 48–57.
- `src/features/controller/ControllerPage.tsx`: chain row under the patch bar once `sync` is `ready`.
- `docs/architecture.md` and `openspec/config.yaml`: current-patch chain (order + on/off) is in-scope SysEx, still not a full editor dump.
- No new Tauri commands or HTTP backend.
