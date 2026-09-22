## Why

After a patch change, `DeviceSession` drops a current-preset dump when the decoded chain equals the chain already on screen, treating it as the previous patch still in flight. A legitimate identical patch (a clone, or an untouched GP-50 factory patch) never gets applied. The chain stays syncing until the refresh times out, the baseline is never captured, download stays disabled, and later edits do not mark the patch modified.

## What Changes

- Apply the current-preset dump that arrives for a newly selected patch even when its decoded chain matches the chain already shown. Equality with the on-screen chain is not a reason to discard it.
- That apply finishes the refresh the same way a differing dump does: `chainSync` idle, baseline captured, not modified, dump held so download can run, busy overlay cleared.
- Remove the equality discard. Do not replace it with another comparison of chain contents.
- Accepted risk: a complete dump of the previous patch that arrives after the decoder reset can be applied as the new patch. No new guard covers that race.

## Non-goals

- A replacement heuristic (wait for the current-patch ack before requesting the dump, skip exactly one inbound dump, or a request id on the wire).
- Changing how stale current-patch index reports are ignored while a patch load is in flight.
- Changing equality used to decide whether the working chain differs from the stored baseline (`modified` / Save).
- New SysEx, a new transport, Controller layout, Library, Editor, or mobile packaging (`docs/architecture.md`).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `device-connection`: A current-preset dump for a newly selected patch (user recall or pedal-initiated) MUST be applied even when the decoded chain equals the chain already shown. That apply captures the baseline, reports not modified, and holds the dump for download. A later working edit reports modified.
- `live-controller`: When that identical dump is applied, the chain-refresh busy overlay clears and previous / next / Save / rename / duplicate / download / upload are usable again. Save stays disabled until a later edit differs from the new baseline.

## Impact

- `src/device/session.ts`: drop the post-patch-change discard that compares the inbound dump to the on-screen chain. The success path (baseline, held dump, `chainSync` idle) runs for an identical chain. No new MIDI, no React changes, no `docs/architecture.md` update.
