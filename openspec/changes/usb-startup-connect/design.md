## Context

See `proposal.md` for why. Today `preferences.startup` is `{ link: "usb" | "bluetooth", id }` and launch resolve in `ConnectionStatus` calls USB `discover()` or Bluetooth `discover({ interactive: false })`. Web Bluetooth silent discovery uses `navigator.bluetooth.getDevices()`; reconnect after power-off or permission churn often needs a fresh `requestDevice()` gesture, so Bluetooth startup fails frequently. The arming checkbox plus favorite star is hard to understand. Web interactive discover already returns `selectedId`, but Connect only remembers and lists instead of connecting.

## Goals / Non-Goals

**Goals**
- USB-only startup with per-row “Connect on startup” + circular Zap toggle.
- Web BLE: tab / Scan again → picker → connect when model known.
- Clear stored Bluetooth startup on read/write so launch never attempts BLE auto-connect.
- Keep remembered pedals on both tabs; desktop BLE remains scan-then-list.

**Non-goals**
- Changing `BluetoothLink` contract or adding a second session.
- Guaranteeing BLE reconnect without a user gesture on web.
- Redesigning the connected panel or model-ask flow beyond wiring picker → connect.

## Decisions

### 1. Preferences: `startup.link` must be `usb`

In `src/app/preferences.ts`, `parseStartup` / `setStartup` accept only `link: "usb"`. A document with `startup.link === "bluetooth"` reads as `startup: null` (and rewrite persists when the document is next written). `setStartup` with bluetooth is a no-op or assert in tests.

Alternative: keep bluetooth in the type and ignore at launch only. Rejected: leaves a dead preference surface and confuses future agents.

### 2. Drop checkbox / arm flag; toggle writes `startup` immediately

Remove `armStartup` and the ScanPanel checkbox. USB `EndpointList` rows call `setStartup({ link: "usb", id })` or `clearStartup()` from the Zap control. Launch still requires a known `model` on the remembered pedal (unchanged); enabling startup on a live-only row with suggested model should `rememberPedal` with that model so launch can connect.

Alternative: keep arm-until-next-connect. Rejected: user asked for an explicit per-pedal control.

### 3. USB row layout

```
+--------------------------------------------------+
| [thumb] Name                     Connect on      |
|         Model / unknown          startup  (Z) (X)|
+--------------------------------------------------+
```

`(Z)` is a circular outline button like remove `(X)`, with Lucide `Zap`. On = filled / positive styling; off = muted outline. Tooltip (English): try to connect to this pedal when the application opens. Bluetooth rows omit “Connect on startup” and `(Z)`; keep remove for remembered BLE.

### 4. Web BLE pick → connect

In `ConnectionStatus.scanBluetooth(true)` (and tab switch that already calls interactive discover when appropriate): after interactive discover, if `selectedId` resolves to an endpoint, call the same path as `pickDevice` / `connectWith` (suggested model → connect; else model ask). Always open the picker when selecting the Bluetooth tab on web (remove the `!hasListed` gate that skipped the picker when remembered pedals exist). Cancel keeps list behavior.

Desktop: tab still scans without a browser picker; list pick unchanged; no startup UI.

### 5. Launch resolve is USB-only

`resolveStartupEndpoint` only runs the USB branch. Failure toast wording: “Your startup pedal failed or is not connected.” Open Connect on USB tab.

### 6. Copy and docs

USB ModeNotes: “Super responsive — Instant, stable connection.” Update `docs/architecture.md` / OpenSpec context Connect sentence so they no longer claim Bluetooth startup or web picker without connect. Leave About changelog for the next version release.

## Risks / Trade-offs

- [Web Bluetooth tab always opens picker] → Users with only remembered pedals must cancel once to use the list. Acceptable; matches “tap Bluetooth → picker”.
- [Startup enabled without model] → Launch skips (existing rule). Mitigate by remembering suggested model when toggling on a scanned USB pedal.
- [StrictMode double mount] → Keep the existing one-shot `startupAttempt` module promise; only the USB path remains.

## Migration Plan

1. Ship preference parse that drops bluetooth `startup`.
2. UI/flow changes in Connect; update architecture + context (not About changelog).
3. No server migration. Rollback = revert change; old bluetooth startup keys become inert null.

## Open Questions

None that block implementation.
