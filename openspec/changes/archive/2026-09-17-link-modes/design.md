## Context

See `proposal.md` for why. Connect today is USB-MIDI only (`ConnectionStatus` copy: “Bluetooth is not supported yet”) and `docs/architecture.md` forbids a USB vs Bluetooth radio, assuming BLE would be another `MidiTransport` backend of the same contract. Captures show USB inbound SysEx on patch load, not when the user moves onboard controls. `DeviceSession` already owns patch CC and an inbound log. Dump decode is a later change.

## Goals / Non-Goals

**Goals:**

- User-visible link choice (USB vs Bluetooth tabs) with honest tradeoff copy.
- One `DeviceSession` and one control surface; link mode is a capability mask, not a UI fork.
- USB connect path unchanged except for the new chooser and copy.
- Keep the USB inbound pipe (Log) without decoding dumps.

**Non-Goals:**

- A BLE/GATT transport, even as a throwing stub.
- Dump assembler / request-on-connect (later change).
- Per-control disable lists for features that are not on screen yet.

## Decisions

### 1. Tabs choose the link; session is still shared

**Choice:** Disconnected modal is two tabs (USB | Bluetooth). USB tab is the current MIDI list. Connected snapshot adds `linkMode: "usb" | "bluetooth"`. Controls keep going through `DeviceSession`. Features that need pedal→app live state read a small capability helper derived from `linkMode` (USB: command out + opportunistic inbound; Bluetooth later: duplex) and disable themselves instead of duplicating screens.

**Why:** Same session, different truthfulness. The user picks the method because the experience differs.

**Alternative:** Mixed device list with `kind` on each row, no tabs. Rejected; USB and Bluetooth are not interchangeable, so the method comes first.

**Alternative:** Fork Controller/Editor per link. Rejected; most controls should stay shared.

### 2. User-facing model is one-way vs two-way, even if USB is not mute

**Choice:** Copy says USB is a one-way connection and super fast; Bluetooth is two-way and slower. Internally USB still subscribes to inbound MIDI. Patch-load dumps are kept for a later change. Onboard knob/module moves are treated as no USB telemetry.

**Why:** That is the product limitation the user needs. Wire-level dumps on patch change can still be used later without promising a full sync.

**Alternative:** Advertise USB as “partial two-way.” Rejected for this slice; harder to scan, easy to over-promise.

### 3. Bluetooth tab is UI-only

**Choice:** Selectable tab, tradeoff copy, English “not available yet.” No `discover()` on that tab, no BLE crate, no transport that throws.

**Why:** Architecture still forbids a fake BLE backend. The tab teaches the choice before the GATT work exists.

**Alternative:** Hide Bluetooth until the backend ships. Rejected; the user asked to choose the method and see the tradeoff now.

### 4. Capability seam, not protocol in this change

**Choice:** Put `linkMode` plus a derived capability object on the device layer (for example `liveFromPedal: false` on USB). Do not decode SysEx or change CC maps here. USB endpoints stay `kind: "usb-midi"`.

**Why:** Encoder/session stay the protocol seam; the link only answers “can this session observe the pedal.” Dump decoding remains a later change (captures already exist).

**Alternative:** Fold dump decode into this change because USB inbound exists. Rejected; dump decode and Bluetooth full sync are later work, and BLE is a different backend.

### 5. Architecture doc catches up

**Choice:** Rewrite the “no radio in the modal / BLE is the same contract” paragraph in `docs/architecture.md` (and the matching `openspec/config.yaml` context) so later changes do not re-assert the old rule.

**Why:** This change’s whole point is that the links are asymmetric.

## Risks / Trade-offs

- [Users tap Bluetooth expecting a scan] → Copy states it is not available yet; no empty MIDI list that looks like a BLE miss.
- [Capability helper is unused until modules/names exist] → Ship the seam now so those features do not invent a second flag.
- [USB dump later contradicts “one-way” copy] → Keep the slogan; document in architecture that USB may apply unsolicited patch dumps without becoming duplex.
- [app-shell main spec still says Controller is reserved] → `live-controller` is unarchived; this delta only changes the Connect modal scenario.

## Migration Plan

Additive UI + snapshot field. Rollback is reverting the change. No MIDI wire format change.

## Open Questions

None that block this slice. How USB patch-load dumps update the snapshot is for a later change, not this one.
