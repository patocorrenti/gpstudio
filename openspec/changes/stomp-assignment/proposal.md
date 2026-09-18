**Status: paused 2026-09-18.** Decode of GP-50 assignment from the current-preset dump is locked; every SET candidate (W1–W3, nine Controller spike rows, H7 CRC-8 param `0D`) was ignored by the pedal. Product UI and temporary write-spike controls were rolled back. Lab and resume notes: `spike-assignment-write.md`. Bluetooth Stomp footswitch follow stays in product (`stomp-footswitch-chain`).

## Why

Controller already follows Stomp-mode footswitches (on/off of NR…NS). Users still cannot see or change **which modules** each stomp controls. That assignment is per patch; GP-5 has one stomp and GP-50 has two. The current-preset dump already arrives at connect and patch change (`docs/architecture.md`), but Patone only decodes order + on/off — assignment bytes are ignored.

## What Changes

- After the chain is shown, Controller MUST show stomp assignment for the current patch: **one** stomp on GP-5, **two** on GP-50. Each stomp MAY list more than one effect (a press can toggle several modules). EXP MUST NOT appear as an assignable target (factory: EXP is not stomped).
- `DeviceSession` MUST decode those assignments from the **same** current-preset dump already requested after connect and patch change, and keep them on the snapshot. Missing dump → empty/unknown assignment, not invented defaults that write to the pedal.
- The user MUST be able to edit which of the ten effects (NR…NS) belong to each stomp through the session. A valid edit updates the snapshot on-change and sends a Patone-owned assignment write on the open link (`commandToPedal` is already true on USB and Bluetooth). MUST NOT send extra patch recall or a chain dump solely because assignment changed. MUST NOT write full preset parameters.
- Exact dump offsets and write SysEx are an apply-time Patone capture fill-in (change assignment on the pedal, dump, diff; then capture the write). Third-party editors stay behavioral references only (`docs/protocol-references.md`). Do not copy their source or payloads.
- USB MUST NOT apply unsolicited live assignment reports (not duplex). Bluetooth MAY apply a captured live assignment notify when `liveFromPedal` is true; if none is captured, dumps remain the source of truth.
- Architecture / OpenSpec context: stomp assignment read/write is in scope as this slice. Full editor, rename, IRs/NAM, Patch/Stomp mode UI, and `chain-reorder` stay separate.

## Non-goals

- Full preset parameter read/write, rename, library, or IR / SnapTone / NAM (`docs/architecture.md`).
- Writing the whole current-preset dump.
- Assigning EXP to a stomp, or inventing EXP as a footswitch target.
- Patch vs Stomp mode control or display (official CC 28).
- Drag-and-drop chain reorder (`chain-reorder` is its own change).
- Applying inbound volume, tuner, CTL, or other non-module live knobs.
- Treating USB as duplex for assignment telemetry.
- Copying reverse-engineered SysEx from third-party editors.
- Mobile packaging.

## Capabilities

### New Capabilities

- None. Stomp assignment is the next live-controller / session slice after footswitch follow, not a new spec domain.

### Modified Capabilities

- `live-controller`: After the chain is shown, Controller shows and edits per-patch stomp assignment (1 slot GP-5, 2 GP-50) through the device session. USB and Bluetooth share that UI. EXP is not assignable.
- `device-connection`: The session decodes stomp assignment from the current-preset dump already in the sync pipeline, stores it on the snapshot, and sends a Patone-owned assignment write on edit. USB ignores unsolicited live assignment reports.

## Impact

- `src/device/session.ts`: snapshot gains stomp assignment; dump apply fills it; `setStompAssignment` (or equivalent) updates snapshot and sends the write.
- `src/device/chain-codec.ts` / `src/device/encode.ts`: decode assignment from the existing dump payload; encode assignment write (BLE-MIDI wrap on Bluetooth). Offsets/bytes from Patone captures at apply.
- `src/features/controller/ControllerPage.tsx`: assignment UI next to the chain; React still MUST NOT send raw MIDI.
- `docs/architecture.md` and `openspec/config.yaml`: this assignment slice in scope; full editor still later.
- No new Tauri commands or HTTP backend.
