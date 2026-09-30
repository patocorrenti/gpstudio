## Why

A Valeton GP-50 can appear as a USB-MIDI device while the pedal is powered off. Opening that port succeeds, so Connect today shows “Connected…” and leaves an empty session with no patch identity. USB enumeration cannot tell power state (`docs/architecture.md`: endpoints are labels + open/send bytes). We need a post-open check, and the success toast should mean the pedal actually answered.

## What Changes

- `DeviceSession.connect` **awaits the onboard name-list identity response** (USB and Bluetooth) before the connect promise resolves, so the existing Connect `toast.promise` success (“Connected to …”) only fires after names arrive.
- On **USB**, if no name-list arrives within the existing name timeout, the session **disconnects** and the connect promise **rejects** with an English message telling the user to verify the pedal is powered on (no separate success-then-disconnect toast pair).
- On **Bluetooth**, if no name-list arrives within the existing name timeout, the session likewise **disconnects** and connect **rejects** with an English unreachable/no-response message (same await contract; message is not the USB power hint).
- Connect UI must not also show the generic “Pedal disconnected” toast for that intentional abort.
- Current-patch identity and the chain dump continue after a successful name-list as today (background after connect resolves).
- **Non-goals:** filtering powered-off devices from the USB scan list; detecting power before `open`; changing Bluetooth discovery; changing chain-dump timeout behavior after a successful name-list; new protocol codecs; Library/Editor work.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `device-connection`: Connect success waits for name-list on USB and Bluetooth; USB silent name-list is a failed connect with a power-on hint; Bluetooth silent name-list is a failed connect with a no-response message; chrome/sync wording stays consistent with “connected” meaning the link is open and identity progressed past names.

## Impact

- `src/device/session/device-session.ts` — `connect` / `runIdentitySync` await and fail paths
- `src/features/connect/ConnectionStatus.tsx` — disconnect-toast suppression on failed connect; longer “Connecting…” while waiting for names
- `src/device/session/checks.ts` — session self-tests that assume connect resolves at open
- Specs under `openspec/specs/device-connection/` and any toast-feedback wording that assumes connect success at link open
