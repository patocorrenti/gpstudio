## 1. Session connect await

- [x] 1.1 Make `DeviceSession.connect` await a real name-list identity event (not empty-string heuristics), keep current-patch + chain after success, and verify a fixture that injects name-list lets `connect()` resolve while chain may still be in flight
- [x] 1.2 On name-list timeout, disconnect and reject `connect` with USB power-on English copy vs Bluetooth no-response English copy; on USB with SysEx unavailable, fail connect instead of empty ready — verify with silent USB/Bluetooth fixtures (or fake timers) and assert session ends disconnected
- [x] 1.3 Update `src/device/session/checks.ts` helpers (`connectUsbReady` / BLE connect paths) so they inject name-list before assuming connect resolved, and verify session self-checks still pass (`npm`/project typecheck or whatever runs those checks)

## 2. Connect UI toasts

- [x] 2.1 Suppress the generic “Pedal disconnected” toast when a failed connect aborts the link, and verify only the connect error toast remains for a silent name-list failure
- [x] 2.2 Confirm `toast.promise` around `connect` still shows loading through the name wait and success only after names — verify copy paths match USB power hint vs Bluetooth no-response (code review / typecheck; no browser automation)
- [x] 2.3 Close the Connect modal as soon as connect starts (before name-list), and verify failure still surfaces only via the connect error toast with the modal already closed

## 3. Verify

- [x] 3.1 Run project typecheck/lint for touched files and fix any issues introduced by this change
