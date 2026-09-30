## Context

See proposal.md — Why. Today `DeviceSession.connect` opens USB-MIDI or Bluetooth, marks `status: "connected"`, fires `runIdentitySync` without awaiting it, and resolves. Connect UI wraps that in `toast.promise`, so “Connected to …” appears even when the GP-50 is USB-present but powered off and never answers SysEx. Name-list waiters time out silently and sync continues to “ready” with empty names.

USB discovery (`MidiTransport.discover` / `midi_list_ports`) only lists ports; there is no power signal before `open` (`docs/architecture.md`).

## Goals / Non-Goals

**Goals**

- Make `connect()` resolve only after a real name-list identity event.
- Fail USB (and Bluetooth) connect on name-list silence; USB error copy = power-on hint.
- Keep a single user-facing outcome toast per attempt (success or error), no success + “Pedal disconnected” pair.
- Leave current-patch + chain dump after a successful name-list as background work.

**Non-Goals (design)**

- New snapshot status enum (`connecting`).
- Pre-list SysEx ping during discover.
- Changing `NAME_TIMEOUT_MS` values unless tests force a tweak.

## Decisions

1. **Await name-list inside `connect`, not only in the UI**  
   `connect()` opens the link, starts identity, and awaits until `applyIdentity` releases the name-list waiters (success) or the existing name timeout elapses without that release (failure → disconnect + throw).  
   *Why:* One contract for Connect UI and any future callers; `toast.promise` success stays honest.  
   *Rejected:* UI-only post-check after resolved connect — still risks a success toast before the check.

2. **Success signal = name-list event received, not “any non-null name string”**  
   Track whether a name-list identity event arrived (waiter released by inbound decode), not whether slots are non-empty strings.  
   *Why:* A powered pedal can return blank names; silence means no response.  
   *Rejected:* `patchNames.every(n => n === null)` alone if that can collide with never-applied vs applied-empty without an explicit received flag.

3. **USB vs Bluetooth failure messages**  
   USB: English power-on verification (e.g. “Check that the pedal is powered on.”). Bluetooth: English no-response for names (not a power hint). Same fail/disconnect shape.  
   *Why:* User request for USB power case; Bluetooth silence is a different physical story.

4. **Suppress disconnect toast on failed-connect abort**  
   `ConnectionStatus` today toasts “Pedal disconnected” on any `connected` → `disconnected`. During a failed name-list wait the session may briefly be connected. Use a connect-in-flight / intentional-abort guard so only the connect error toast shows. Close the Connect modal as soon as connect starts (not after success), so the long name wait is toast-only; on failure the modal stays closed and the user reopens Connect to retry.  
   *Why:* Spec requires no dual toasts; user wants the modal out of the way immediately.  
   *Rejected:* Deferring `status: "connected"` until names arrive — `sendBytes` / sync already assume connected while asking. Keeping the modal open until success — conflicts with the requested UX.

5. **USB SysEx unavailable**  
   If USB SysEx is not enabled, treat connect as failed (disconnect + English error) rather than `finishSync` with empty identity.  
   *Why:* Aligns with “connect means names arrived”; empty ready session is the bug we are closing. Exact error string can be distinct from the power hint.

6. **Chain path after names**  
   After name-list success, keep asking current-patch then chain as today; `connect()` may resolve before those complete. Chromium “syncing” UI and chrome label during remaining sync stay valid.

## Risks / Trade-offs

- [Longer Connecting spinner (8s USB / 15s BT on silence)] → Acceptable; clearer than a false Connected. Keep existing timeouts.
- [Brief `connected` snapshot during wait while modal still open] → Chrome may show the endpoint label before success toast; acceptable. Disconnect during wait must cancel connect (generation / disconnect already aborts waiters).
- [checks.ts assumes `connect` returns at open] → Tests must deliver a name-list fixture (or advance timers + inject) before asserting post-connect state; update `connectUsbReady` / BLE connect helpers.

## Migration Plan

Ship with the app build; no data migration. Rollback = revert the change. No protocol versioning.

## Open Questions

None — toast success timing and USB/Bluetooth fail messages are settled in the proposal.
