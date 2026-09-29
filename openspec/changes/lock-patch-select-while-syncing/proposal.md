## Why

With Bluetooth patch recall (`1143`) and the confirmation dump still in place, rapid app→pedal navigation can stack recalls and dump requests and drop the GATT link. Specs still allow the 00–99 selector to stay usable while `chainSync` is syncing; `stepPatch` already refuses while syncing, but `setPatch` does not, so a second select can fire another recall while dumps/confirms are in flight. Locking all app patch navigation until the refresh (including confirmation) finishes matches “no spam recalls while a dump is in flight” without removing confirmation.

## What Changes

- While a patch-change chain refresh is in progress (first dump and/or confirmation outstanding, or refresh timeout not yet reached), Controller MUST NOT allow previous, next, **or** the 00–99 selector to change the patch.
- `DeviceSession.setPatch` / app recall MUST NOT send another patch recall while that refresh is syncing (same gate `stepPatch` already uses).
- Pedal-initiated current-patch reports may still update the shown index and retarget the in-flight dump path; they MUST NOT unlock app recall early.
- Confirmation dump behavior stays.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-controller`: Patch bar selector MUST stay unusable through syncing/confirmation (remove “selector MAY stay usable”).
- `device-connection`: App recall MUST NOT send while `chainSync` is syncing for an in-flight patch load/confirm.

## Non-goals

- Removing confirmation dumps.
- The Bluetooth ACK-before-dump experiment (`bluetooth-patch-recall-ack`); treat as separate / stashable.
- Blocking pedal→app index follow during an in-flight load.
- Changing Reload/Save rules beyond keeping them busy until confirm finishes (already required).

## Impact

- `DeviceSession.setPatch` early-return while syncing; Controller `PatchSelect` / patch bar (ensure open popover cannot select while busy); live-controller and device-connection scenarios; session checks for double-select while syncing.
