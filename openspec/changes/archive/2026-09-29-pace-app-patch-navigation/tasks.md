## 1. No app recall while dump/confirm in flight

- [x] 1.1 Make `DeviceSession.setPatch` a no-op (no recall, no chain refresh) while `chainSync` is syncing on a ready session; keep `stepPatch` aligned; verify checks that a second select/next while syncing sends nothing extra
- [x] 1.2 Lock Controller previous / 00–99 / next for the whole syncing period including confirmation (close open patch popover when busy; ignore select while busy); verify the bar cannot start another recall until syncing clears

## 2. Bluetooth ACK before first dump

- [x] 2.1 Add a detector for the Bluetooth command-received ACK after parameter write (unwrapped equivalent of the reference length-18 BLE frame) with a self-check fixture
- [x] 2.2 On Bluetooth `setPatch`, after `1143`, defer the first dump ask until ACK or short timeout; keep confirmation after first apply; verify ACK-then-dump and timeout-then-dump checks; USB dump-after-CC-0 unchanged when idle

## 3. Docs and validation

- [x] 3.1 Note in `docs/protocol-references.md` the Bluetooth ACK-before-dump and the no-app-recall-while-syncing rule; verify no reference JS is pasted
- [x] 3.2 Run typecheck / device session checks and verify they pass without in-browser UI testing
