## 1. USB dump wait after CC 0

- [x] 1.1 After USB `setPatch` / CC 0, defer the first current-preset dump until a matching current-patch identity notify arrives or a short timeout (same order of magnitude as `RECALL_ACK_TIMEOUT_MS`) elapses; do not wait for the Bluetooth `1143` ACK; verify session checks cover notify-then-dump and timeout-then-dump on USB
- [x] 1.2 Keep arming the confirmation dump after the first dump applies on USB (unchanged busy-through-confirm); verify existing USB confirmation checks still pass
- [x] 1.3 Ensure a matching current-patch identity that finishes the wait does not send a second dump ask or a second CC 0; verify with a session check

## 2. Refresh timeout clears stuck load

- [x] 2.1 On chain-refresh timeout, clear `pendingPatchLoad` / `pendingPatchSource` (and cancel any USB identity wait) when returning `chainSync` to idle; verify a later pedal current-patch report can update the index after a timed-out app recall

## 3. Docs

- [x] 3.1 Update `docs/protocol-references.md` pacing note: USB waits for matching current-patch identity (or short timeout) after CC 0 before the first dump; confirmation still follows; CC 0 unchanged; do not paste reference JavaScript; verify the note matches the implemented behavior
