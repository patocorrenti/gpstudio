## Why

On the pedal, turning NS (SnapTone) on does not flip AMP or CAB on/off. It bypasses those two modules and marks them with a prohibition sign, while their stored on/off stays the same. Controller currently treats every slot as a plain on/off switch, so the SnapTone exception is invisible.

## What Changes

- When NS is on, Controller MUST mark the AMP and CAB slots as disabled (prohibition overlay, matching the pedal), on both USB and Bluetooth. The mark MUST appear whether those slots are on or off. Their on/off switches and snapshot `enabled` MUST stay as they are.
- Turning NS off MUST remove the mark. AMP and CAB MUST then look on or off from their stored state. Toggling NS MUST send only NS's module CC. It MUST NOT send AMP or CAB CCs and MUST NOT rewrite those slots' `enabled`.
- AMP and CAB switches stay usable while marked: flipping them still updates that slot's on/off through the session (for when NS is later off). The mark is independent of that on/off.
- The same row is used on USB and Bluetooth. React still MUST NOT send raw MIDI (`docs/architecture.md`).

## Non-goals

- Turning AMP or CAB off (or on) in the snapshot or on the pedal when NS is toggled.
- Auto-turning NS off when the user turns AMP or CAB on.
- Changing MIDI encode, chain dumps, or inbound live-module apply.
- IR / SnapTone / NAM upload (`docs/architecture.md`).
- Drag-and-drop reorder, full preset parameters, volume, tuner, or Patch/Stomp UI.
- Treating USB as duplex.
- Copying reverse-engineered SysEx from third-party editors.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. This is a live-controller chain-display rule, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, NS on MUST mark AMP and CAB as disabled (prohibition overlay) without changing those slots' on/off presentation. NS off MUST clear the mark. USB and Bluetooth share the same presentation.
- `device-connection`: Toggling NS MUST update only NS on/off and MUST send only NS's official module CC. AMP and CAB `enabled` MUST stay unchanged.

## Impact

- `src/device/chain.ts`: a pure helper that derives AMP/CAB disabled-from-NS from the current chain (NS on), without mutating `enabled`.
- `src/features/controller/ControllerPage.tsx`: prohibition overlay on AMP and CAB when that helper is true; on/off switch still reflects `enabled` and still toggles.
- `src/device/session.ts`: `toggleChainSlot` stays one-slot; do not rewrite AMP/CAB when NS changes.
- `docs/architecture.md` and `openspec/config.yaml`: note that NS bypasses AMP/CAB visually; it does not rewrite their on/off.
- No new Tauri commands, MIDI messages, or HTTP backend.
