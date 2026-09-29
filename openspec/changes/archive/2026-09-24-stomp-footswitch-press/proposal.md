## Why

Controller can assign modules to stomps and, on Bluetooth, follow a physical footswitch. It still cannot press the stomp itself. Users need the app to send the same signal as stepping on the footswitch so the pedal toggles the assigned modules: one stomp on GP-5, Stomp A and Stomp B on GP-50.

## What Changes

- After the audio chain is shown, Controller MUST offer a stomp press through the device session. GP-5 exposes one press. GP-50 exposes two: A and B. The same controls appear on USB and Bluetooth. React MUST NOT send raw MIDI.
- The session MUST send one official MIDI CC per press, the published CTRL/CTL entries (`docs/architecture.md` official CC maps; manuals in `_reference/`): GP-5 CC 69 (CTL), GP-50 CC 69 (CTRL 1 / A) and CC 70 (CTRL 2 / B). The pedal applies the stomp. The session MUST NOT imitate the press by sending module on/off CC 48–57, MUST NOT send a stomp-assignment SET (`114d`), and MUST NOT send patch recall or a chain dump solely because the user pressed a stomp.
- On press, the session MUST update the current chain on-change by toggling each effect assigned to that stomp (NR…RVB). EXP MUST NOT change. An empty assignment still sends the CC and leaves the chain as shown. The working patch MUST become modified when those on/off bits differ from the baseline, the same way a slot toggle does. Controller MUST NOT show the chain-refresh busy overlay solely because of the press.
- Bluetooth live stomp reports (existing command `0E` mask) remain the pedal's follow-up and MAY correct that chain. USB MUST keep ignoring unsolicited live stomp reports; the on-change update is what USB shows.
- The press MUST NOT depend on GP-50 Patch|Stomp mode (CC 28) or on the GP-5 footswitch mode (`1115`). Those settings stay as they are.

## Non-goals

- Editing which modules a stomp owns (already shipped: dump decode + SET `114d`).
- Gating the press on Patch vs Stomp, or on GP-5 modes `0-99` / `0-9` / `A-Z` / `CTL` / `Tuner`.
- Tuner, looper, drum, bank, or relative-step CCs (`docs/architecture.md`).
- Applying USB inbound live-module, stomp, or assignment reports.
- A SysEx stand-in for the press, or copying reference-editor JavaScript into `src/`.
- Library browse/import, IR/NAM file upload, the Editor route, and mobile packaging.

## Capabilities

### New Capabilities

- None. A stomp press is the next live-controller / session slice on the official CC map, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, Controller offers one stomp press on GP-5 and Stomp A / B on GP-50 through the device session. USB and Bluetooth share that UI. The chain-refresh overlay MUST NOT appear solely because of the press.
- `device-connection`: A press sends official CC 69 (GP-5 and GP-50 A) or CC 70 (GP-50 B), updates assigned module on/off on-change, and does not recall a patch or request a chain dump for that press alone. USB still ignores unsolicited live stomp reports.

## Impact

- `src/device/cc.ts`: name GP-50 CC 70 (CTRL 2). CC 69 is already `ctl` on the GP-5 map.
- `src/device/encode.ts` and `src/device/session/`: a press action encodes one CC on the open link and flips assigned slots in the snapshot. No new transport.
- `src/features/controller/`: press controls beside the chain (feature sibling). Assignment marks stay assign-only.
- `docs/architecture.md`, `docs/protocol-references.md`, and `openspec/config.yaml`: stomp press (CC 69 / CC 70) in scope on USB and Bluetooth.
