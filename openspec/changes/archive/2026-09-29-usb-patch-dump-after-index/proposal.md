## Why

On USB (especially GP-5), Patone asks for the current-preset dump immediately after CC 0 recall. That races the pedal while it is still switching slots: dumps stall or never assemble, the UI stays busy for seconds, and a stuck `pendingPatchLoad` can stop following later pedal patch changes. The reference USB editors wait for the pedal to report the new index (or a command ACK after SET recall) before the preset ask. Bluetooth already waits for the `1143` command-received ACK; USB should get the same pacing shape without changing the recall message.

## What Changes

- After an allowed USB app→pedal patch recall (official CC 0), defer the **first** current-preset dump until a matching current-patch identity notify arrives, or a short timeout elapses (same role as the Bluetooth ACK wait).
- Keep the existing **confirmation dump** after that first apply on USB and Bluetooth (`chainSync` stays syncing until confirm or refresh timeout).
- USB patch recall stays official **CC 0**. Do not switch USB to SET `1143` or to prev/next CC `0x18`/`0x19` in this change.
- When a chain refresh times out without a finished dump, clear the in-flight app/pedal patch-load gate so later pedal current-patch reports are not ignored.
- Note the USB pacing change in `docs/protocol-references.md` (no pasted reference JavaScript).

## Non-goals

- Replacing USB CC 0 with SysEx `1143`, or changing prev/next to CC `0x18` / `0x19` (separate change if wanted later).
- Removing or skipping confirmation dumps on USB or Bluetooth.
- Valeton-style free navigation that stacks recalls while a dump is in flight.
- Changing Bluetooth `1143` ACK pacing, connect IR/globals asks, or live USB follow.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `device-connection`: USB app recall MUST wait for a matching current-patch identity notify (or short timeout) before the first current-preset dump; confirmation dump stays; CC 0 unchanged.

## Impact

- `DeviceSession.setPatch` / USB dump sequencing after CC 0; chain-refresh timeout cleanup of `pendingPatchLoad`; session checks for USB; `docs/protocol-references.md`.
- Bluetooth recall path unchanged. Controller UI stays gated by `chainSync` through confirmation.
