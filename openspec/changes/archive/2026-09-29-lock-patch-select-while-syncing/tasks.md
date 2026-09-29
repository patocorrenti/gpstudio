## 1. Session and UI gate

- [ ] 1.1 Make `DeviceSession.setPatch` a no-op (no recall, no `refreshChain`) while `chainSync` is syncing on a ready session, keep `stepPatch` consistent, and verify session checks that a second select/next while syncing sends no extra recall or dump ask
- [ ] 1.2 Ensure Controller patch previous / 00–99 select / next stay unusable for the whole syncing period (including confirmation): close an open patch popover when busy becomes true and ignore select while busy; verify the bar cannot start another recall until syncing clears

## 2. Validation

- [ ] 2.1 Run typecheck / device session checks and verify they pass without in-browser UI testing
