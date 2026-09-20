## 1. Toast primitive

- [x] 1.1 Add the shadcn Sonner primitive (`npx shadcn add sonner` or the equivalent for this repo's `components.json`) so `src/components/ui/sonner.tsx` and the `sonner` package exist, and verify `package.json` lists `sonner` and that file is a shadcn primitive (not a feature widget)
- [x] 1.2 Mount `<Toaster />` in `src/app/AppShell.tsx` under the existing `ThemeProvider`, with English-capable default positioning, and verify `npx tsc -b --pretty false` typechecks
- [x] 1.3 Note in `docs/architecture.md` and `openspec/config.yaml` that the shell hosts global English toasts for connect/disconnect and patch Save/rename/duplicate/upload (promise spinner then success/error; upload success may offer Save), and verify those files still forbid copied SysEx, Library import, and treating USB and Bluetooth as interchangeable

## 2. Connect and disconnect

- [x] 2.1 Wrap `ConnectionStatus.connectWith` in `toast.promise` with English loading / success / error copy (same path for USB and Bluetooth), keep closing the modal only on success, leave it open on failure, and verify discovery errors still use the modal inline error with no connect toast
- [x] 2.2 On a snapshot transition from `connected` to `disconnected`, close the Connect modal, clear pending model/error, show one English disconnect toast, and do not toast again from the Disconnect button, and verify a first-load disconnected snapshot does not toast
- [x] 2.3 Stop rescanning USB after `session.disconnect()`, keep `session.disconnect()` as the only Disconnect write, and verify `npx tsc -b --pretty false` typechecks

## 3. Patch bar

- [x] 3.1 Wrap Save, confirmed rename, and confirmed duplicate in `toast.promise` (English loading then success or error) through the existing session methods, fail the toast if the session is disconnected after the await, leave the confirm Dialogs in place, and verify download still has no toast
- [x] 3.2 Wrap confirmed `uploadCurrentPatch` in a promise toast; treat `{ ok: false }` as error with no Save action; on success offer English Save on that toast; invalid/wrong-model files stay on the existing error Dialog with no upload toast; and verify no store write runs solely because upload succeeded
- [x] 3.3 Make the upload-toast Save wait until `chainSync` is not `syncing` (or the session disconnects), then call `savePatch` with its own promise toast, and verify `npx tsc -b --pretty false` typechecks

## 4. Check

- [x] 4.1 Run `npx tsc -b --pretty false` and fix type errors from this change
