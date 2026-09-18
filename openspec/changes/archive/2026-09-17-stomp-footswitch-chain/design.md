## Context

See `proposal.md` for why. Bluetooth already applies live-module SysEx (identity-family command `09`) and GP-50 EXP SysEx (command `02`) in `DeviceSession.applyLiveModule` when `liveFromPedal` is true (`src/device/session.ts`, `src/device/chain-codec.ts`, `src/device/link.ts`). That path was captured from pedal/editor module toggles, not named as Stomp footswitches. `handleInbound` always runs `IdentityDecoder` first; `patch-changed` (`src/device/identity.ts`) starts `refreshChain()`, which sets `chainSync: "syncing"` and covers Controller with the busy overlay (`src/features/controller/ControllerPage.tsx`). USB still must not apply live module reports (`docs/architecture.md`). Specs: `live-controller` (slots follow stomps, no overlay) and `device-connection` (stomp is not a patch change).

## Goals / Non-Goals

**Goals:**

- Bluetooth Stomp-mode footswitches that change module on/off update the snapshot chain through the existing live-module apply path.
- Those frames never start a chain dump / overlay, and never change `snapshot.patch`.
- USB still ignores the same inbound.
- If captures show a frame other than command `09` / `02`, extend the Patone-owned decoder; do not copy third-party SysEx.

**Non-Goals:**

- Snapshot or UI for Patch vs Stomp mode, or sending CC 28.
- Sending MIDI because a footswitch was pressed.
- Controller layout changes; the chain row already binds to snapshot on/off.
- Applying volume/tuner/CTL or treating USB as duplex.

## Decisions

### 1. Follow the inbound module report, do not track Stomp mode

**Choice:** Do not add Patch/Stomp to the snapshot. If the pedal is in Stomp mode, footswitches emit live module on/off and the session applies them. If it is in Patch mode, footswitches keep using today's pedal-initiated patch reports and chain refresh. GP-5 footswitches that toggle modules use the same apply path.

**Why:** Specs require following chain state, not displaying mode. Official Patch/Stomp CC is a later GP-50 extra (`docs/architecture.md`).

**Alternative:** Sync CC 28 and apply stomps only while mode is Stomp. Rejected; extra state, and Patch-mode traffic is already a different inbound class.

### 2. Classify stomp frames as live module, never as `patch-changed`

**Choice:** A message that decodes as live-module or EXP on/off MUST NOT emit `patch-changed`. In `handleInbound`, apply live-module/EXP before identity when that decode succeeds; skip identity for that message. Tighten `IdentityDecoder` if a captured stomp frame would otherwise match the length-22 `01 0B` `patch-changed` pattern. USB still runs identity/chain dumps and still skips live-module apply.

**Why:** Identity-family SysEx is shared. A false `patch-changed` is what would flash the chain overlay while the patch did not change.

**Alternative:** Re-dump the chain on every footswitch. Rejected; Bluetooth-slow and hides the row for a one-bit (or few-slot) change. **Alternative:** Change only the identity matcher and leave apply order. Weaker; session order is the reliable guard.

### 3. Reuse `applyLiveModule`; extend the decoder from captures if needed

**Choice:** Keep `setChainSlotEnabled` (order unchanged, idempotent). First assume command `09` / `02` (and leftover CC 48–57 / CC 13) are what Stomp sends. At apply, capture a real Bluetooth stomp on Log. If the frame differs, extend `decodeLiveModule` / `decodeLiveExp` from that capture. One press MAY be several sequential reports; apply each. If one SysEx carries several modules, decode all of them in that fill-in. Third-party editors stay behavioral references only (`docs/protocol-references.md`).

**Why:** Avoid inventing a second apply path. Exact bytes are an apply-time capture, same as identity/chain codecs.

**Alternative:** Always request a current-chain dump after a footswitch. Rejected; see decision 2.

### 4. No echo, no Controller fork

**Choice:** Do not send CC or SysEx because a stomp arrived. Controller keeps the same chain row; on/off follows the snapshot. `liveFromPedal` stays Bluetooth-only.

**Why:** Specs: app is follower. `docs/architecture.md` already forbids forking UI per link.

**Alternative:** Echo official module CC back to the pedal. Rejected; can fight the stomp.

### 5. Architecture / context catch up

**Choice:** In the same apply, update `docs/architecture.md` and `openspec/config.yaml` so Bluetooth stomp-originated module on/off is in scope as `liveFromPedal`. Patch/Stomp UI, USB live stomps, and other knobs stay later.

**Why:** Stop the next agent from treating footswitch follow as still forbidden or as USB-duplex.

## Risks / Trade-offs

- [Stomp SysEx is not command `09`] → Capture on Log during apply and extend the decoder; do not copy third-party payloads.
- [Stomp frame matches `patch-changed`] → Apply live-module first and skip identity for that message; tighten the identity matcher from the same capture.
- [One footswitch toggles NS and the pedal also turns AMP/CAB off] → Apply every reported module; do not invent exclusivity on the client (same as chain-on-off).
- [User is in Patch mode and expects stomps] → Out of scope; Patch-mode footswitches still change patches.
- [No browser verification] → `tsc`; the user tests Bluetooth stomps on a real pedal.

## Migration Plan

Additive inbound classification. Disconnect still drops chain state. Rollback is reverting the change. Update architecture and OpenSpec context in the same apply.

## Open Questions

None that fork the specs. Exact stomp SysEx bytes are an apply-time capture fill-in if they are not already command `09` / `02`.
