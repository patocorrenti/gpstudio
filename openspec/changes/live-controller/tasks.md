## 1. DeviceSession patch

- [x] 1.1 Add `patch` (0–99) to the connected session snapshot, default `0` on connect, drop it on disconnect, and verify `npx tsc -b --pretty false` still typechecks callers
- [x] 1.2 Add `setPatch` that clamps 0–99, updates the snapshot, and sends `[0xB0, CC 0, value]` through the transport (no send on `connect`)
- [x] 1.3 Add `stepPatch` that wraps 99→00 and 00→99 by calling `setPatch`

## 2. Controller UI

- [x] 2.1 Show an English empty state (`No pedals connected`) on Controller when disconnected, with no patch controls
- [x] 2.2 When connected, show previous, a two-digit selectable `00`–`99` label, and next, wired to `stepPatch` / `setPatch`
- [x] 2.3 Hide the patch bar after disconnect and restore the empty state

## 3. Check

- [x] 3.1 Run `npx tsc -b --pretty false` and fix any type errors from this change
