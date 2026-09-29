## Why

Rapid app→pedal patch changes hang the GP-5/GP-50 over Bluetooth until a reboot. The official Valeton app survives by not flooding the pedal (it can drift and catch up). Patone keeps confirmation dumps and should **not** adopt Valeton’s “desync while UI stays open” model. Instead: never start another recall or dump ask while a dump path is in flight (UI locked), and on Bluetooth wait for the `1143` command-received ACK before the first dump ask. Trying ACK alone or UI lock alone still hung the pedal; this change does both.

## What Changes

- **No app patch change while a dump is in flight:** while `chainSync` is syncing (first dump and/or confirmation outstanding), previous / 00–99 / next MUST NOT send recall, MUST NOT start another dump request, and MUST stay unusable in Controller until confirmation finishes or the refresh times out.
- **Bluetooth ACK before dump:** after app SET `1143`, wait for the command-received ACK (or a short timeout) before the first current-preset dump request. Confirmation dump after the first apply stays.
- USB keeps CC 0 recall and the same “no spam while syncing” UI/session gate; USB does not wait for a `1143` ACK.
- Pedal-initiated current-patch reports may still update the shown index and retarget the in-flight dump; they MUST NOT unlock app recall early.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `device-connection`: App recall blocked while chain syncing; Bluetooth `1143` dump ask waits for command-received ACK (or timeout).
- `live-controller`: Patch bar previous / selector / next locked through syncing and confirmation (remove “selector MAY stay usable”).

## Non-goals

- Valeton-style free UI that queues or drops recalls while the pedal catches up.
- Removing confirmation dumps.
- Copying Valeton or reference editor source.
- Changing pedal→app index follow / dump retarget beyond not starting app recalls during sync.

## Supersedes

Planning-only predecessors (abandon when this lands): `bluetooth-patch-recall-ack`, `lock-patch-select-while-syncing`.

## Impact

- `DeviceSession.setPatch` / Bluetooth dump sequencing after ACK; ACK detector; Controller patch bar / `PatchSelect` busy behavior; session checks; `docs/protocol-references.md`.
