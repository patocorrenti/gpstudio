## Why

A patch change can still apply a dump of the previous patch, especially over Bluetooth, and the screen then shows the new slot with the old chain. Comparing that first dump to the chain already on screen cannot tell a stale dump from a real clone, so that check stays gone. A second dump, requested after the first one is already shown, can: the same chain means we were in sync, and a different chain means the first apply was stale.

## What Changes

- After the dump for a user or pedal patch change is applied and shown, the session requests one confirmation dump of the current patch. It does not send patch recall.
- If that confirmation decodes to the same chain already shown, it is discarded. The shown chain, baseline, and modified state stay as they are.
- If it decodes to a different chain and the user has not edited the working patch, the session replaces the shown chain with the confirmation, holds that dump, recaptures the baseline, and reports not modified.
- The confirmation does not bring back the busy overlay. USB and Bluetooth both do this; on USB the confirmation is expected to match and be discarded.
- One confirmation per patch change. Applying a mismatch does not request another. Connect, Reload, download, and upload do not start one.

## Non-goals

- Discarding the first dump of a patch change because it matches the chain already on screen. Clones and untouched factory patches still apply that first dump (`accept-identical-patch-dump`).
- A confirmation after connect, Reload, download, or upload.
- A second busy overlay, a toast, or patch recall (CC 0) for the confirmation.
- Overwriting a working edit that happened before the confirmation arrived.
- Library, Editor, copied SysEx, or mobile packaging (`docs/architecture.md`).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `device-connection`: After a user or pedal patch-change dump is applied, the session requests one confirmation dump. A match is discarded. A mismatch replaces the chain and recaptures the baseline when the working patch is still unmodified. No patch recall, no further confirmation, and no confirmation for connect, Reload, download, or upload.
- `live-controller`: The chain-refresh overlay still clears when the first dump arrives. A matching confirmation leaves that chain on screen. A mismatch updates the chain without covering the patch controls again. Same behavior on USB and Bluetooth.

## Impact

- `src/device/session.ts`: after applying a patch-change dump, send one more current-preset request and compare it to the shown chain. No new MIDI command, no React control, no `docs/architecture.md` change beyond a sentence if the patch-change sync description should mention the quiet confirmation.
