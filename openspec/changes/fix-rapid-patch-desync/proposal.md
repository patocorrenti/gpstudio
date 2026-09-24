## Why

When the pedal patch is stepped quickly over Bluetooth, the app often lands one or two patches behind: the shown index freezes on an intermediate slot while the chain dump reflects a later patch. The working hypothesis is that `pendingPatchLoad` discards newer pedal `current-patch` reports until the first dump finishes, then attaches that dump (and its confirmation) to the frozen index. USB already runs the same confirmation path but clears the busy overlay after the first dump; this change unifies both links so the same retarget and confirm rules apply.

## What Changes

- Treat a newer pedal `current-patch` that arrives while a patch load is in flight as a retarget: update the selected index, reset the chain decoder, and request one dump for the latest slot instead of discarding the report.
- Keep discarding stale `current-patch` reports that disagree with an in-flight **app** recall (`setPatch`), so a user/app selection cannot be reverted by an older pedal index.
- Keep the one-shot confirmation dump after a patch-change apply on both USB and Bluetooth.
- **Unify USB with Bluetooth confirmation UX**: hold `chainSync: "syncing"` (busy overlay) until the confirmation dump is applied or the refresh times out on both links. Today only Bluetooth holds the overlay; USB ends busy after the first dump while the quiet confirmation still runs.
- Add a fake-transport spike/regression that reproduces rapid pedal `patch-changed` + staggered `current-patch` + dumps and asserts the final index matches the last report.

## Non-goals

- Changing dump codecs, BLE-MIDI unwrap, or fragment assembly.
- Dropping confirmation entirely, or confirming connect / Reload / download / upload.
- Applying USB live-from-pedal knobs or other duplex behavior (see `docs/architecture.md`).
- Library, Editor, or IR/NAM upload work.
- Heuristics that guess dump contents without an identity index.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `device-connection`: Pedal-originated patch identity during an in-flight load must retarget to the latest current-patch index; confirmation busy overlay rules become the same on USB and Bluetooth.
- `live-controller`: Controller busy overlay during a patch change stays until confirmation completes on USB as well as Bluetooth.

## Impact

- `src/device/session/device-session.ts` (`applyIdentity`, `applyChain`, `applyPatchConfirmation`, `requestPatchConfirmation`, `holdBusyForConfirm`).
- Session checks / fake-transport coverage under `src/device/session/`.
- Specs: `openspec/specs/device-connection/spec.md`, `openspec/specs/live-controller/spec.md`.
