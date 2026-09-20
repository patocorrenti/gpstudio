## Context

See `proposal.md` for why. Specs: `app-shell` (global toast region), `device-connection` (connect promise toast; disconnect toast + close modal), `live-controller` (Save / rename / duplicate / confirmed upload promise toasts; upload success offers Save).

Today `PatchBar` fire-and-forgets `savePatch` / `renamePatch` / `duplicatePatch` / `uploadCurrentPatch`. `ConnectionStatus.connectWith` already closes the modal on success and keeps it open on error. `disconnect()` leaves the modal open and rescans USB, so a user or lost-link drop lands on the scan panel. `DeviceSession.dropLink` already turns a dead USB/Bluetooth pipe into `status: "disconnected"`. There is no toast primitive. UI still must not send MIDI (`docs/architecture.md`).

## Goals / Non-Goals

**Goals:**

- shadcn Sonner (`toast.promise`) as the only toast surface, mounted once in the shell.
- Feature code wraps existing session calls; store SET `114a` and upload writes stay as they are.
- One connected→disconnected watcher closes the Connect modal and emits the disconnect toast (user Disconnect and lost link).

**Non-Goals:**

- A shared `src/features/toast` module or a domain widget under `src/components/`.
- Changing dump/store/upload codecs, or relaxing USB vs Bluetooth capabilities.
- Waiting for initial chain sync before the connect success toast (connect resolves when the session is connected).

## Decisions

### 1. shadcn Sonner, not Radix Toast

**Choice:** Add the shadcn `sonner` primitive (`src/components/ui/sonner.tsx` via the project's shadcn CLI) and the `sonner` package. Mount `<Toaster />` in `AppShell` so it sits under the existing `ThemeProvider` in `App` (`next-themes` is already a dependency). Copy is English. Default position is fine.

Connect, Controller, and later features import `toast` from that primitive (or `sonner`). That is a shadcn primitive, not a second-feature widget to promote.

**Why:** The user asked for the promise toast (spinner, then success or error). Radix Toast has no `toast.promise`. A Tauri notification is the wrong surface for in-app MIDI actions.

**Alternative:** `@radix-ui/react-toast`. Rejected; no promise/spinner API. **Alternative:** A custom overlay. Rejected; shadcn already owns the UI kit.

### 2. Wrap session promises in the features; do not fork MIDI

**Choice:** `ConnectionStatus.connectWith` and `PatchBar` confirm handlers await the existing `DeviceSession` methods inside `toast.promise` (or an equivalent loading toast that is updated to success/error if the installed Sonner API cannot attach an action on the promise success state).

`uploadCurrentPatch` already returns `{ ok: true } | { ok: false; reason }`. Treat `ok: false` as a thrown error so the toast shows error and does not offer Save. Invalid / wrong-model files stay on the existing error Dialog and MUST NOT start an upload toast.

`savePatch` / `renamePatch` / `duplicatePatch` still resolve on no-op. After they return, if the snapshot is `disconnected`, fail the toast (the disconnect toast still appears). Do not change the `114a` encoder. Discovery errors stay inline on the Connect modal.

**Why:** Specs require observable spinner-then-result without new SysEx. Upload already has a result type; store writes fail in practice when `dropLink` runs.

**Alternative:** Return `{ ok }` from every store method. Deferred unless the wrap is not enough at apply. **Alternative:** Toast from inside `DeviceSession`. Rejected; the session must stay UI-free.

### 3. Upload success toast offers Save; it does not store

**Choice:** Confirmed upload uses a promise toast. On success, that same toast includes an English **Save** action. The action MUST NOT run `savePatch` until `chainSync !== "syncing"` (upload already calls `refreshChain(false)`, and `storePatch` no-ops while syncing). Then it runs the same Save path as the patch bar (`savePatch` → `114a`), with its own promise toast. Dismissing the upload toast does nothing. Auto-Save stays out.

**Why:** Upload writes the working buffer only; Save is still the store. Immediate Save would hit the post-upload dump gate and look like a no-op.

**Alternative:** Auto-Save when the dump lands. Rejected; the user asked to be asked. **Alternative:** Skip the dump refresh so Save is immediately legal. Rejected; the snapshot would lie until the next dump.

### 4. Close the Connect modal on any connected→disconnected transition

**Choice:** In `ConnectionStatus` (the owner of `open` / `setOpen`), keep a ref of the previous snapshot status. On a transition from `connected` to `disconnected`: `setOpen(false)`, clear pending model/error, and show one English disconnect toast (not a promise). Do not rescan USB after disconnect. User Disconnect still calls `session.disconnect()`; it MUST NOT toast on its own, or the watcher would double-fire.

Connect success keeps closing the modal as today, plus the promise toast. Failed connect leaves the modal open.

**Why:** Lost-link and Disconnect both end on `disconnected`. Closing from that edge covers the cable-unplug case where the modal was showing `ConnectedPanel` and flipping to `ScanPanel`. Scanning after close is wasted work.

**Alternative:** Close only from the Disconnect button. Rejected; it leaves the modal open on `dropLink`. **Alternative:** Toast + close inside `DeviceSession.disconnect`. Rejected; session stays UI-free.

## Risks / Trade-offs

- [Post-upload `chainSync` makes an instant Save no-op] → Toast Save waits for idle (or disconnect) before `savePatch`.
- [Store methods resolve even when they no-op] → Fail the toast if the session dropped; keep Save disabled in the bar so a normal click still stored.
- [Connect success toast plus modal close feels busy] → Accept; the toast is the durable confirmation after the modal is gone.
- [Connect success and an immediate lost-link produce two toasts] → Intended; they are two events.
- [Sonner action API on `toast.promise` success may differ by version] → Prefer promise; if the CLI version cannot attach Save there, replace the loading toast with `toast.success(..., { action })`.

## Migration Plan

Additive UI + `sonner` dependency. No snapshot, MIDI, or Tauri contract change. Rollback is reverting the change and removing the package.

## Open Questions

None. Exact English strings are apply-time as long as they match the specs.
