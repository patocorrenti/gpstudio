## Why

Save, rename, duplicate, upload, connect, and disconnect already go through `DeviceSession`, but they finish with almost no confirmation: store and upload fire-and-forget, connect success only closes the modal, and disconnect leaves that modal open on the scan screen. Users need a spinner-then-result toast for those slow or easy-to-miss actions, and disconnect must not strand them in the Connect dialog.

## What Changes

- Add the shadcn Sonner toast (the promise variant: loading spinner, then success or error) as a global overlay hosted by the app shell. Copy stays English (`docs/architecture.md`).
- Show a promise toast while the user **Saves**, **renames**, or **duplicates** a patch, and when a confirmed **upload** of a `.prst` into the working patch finishes applying.
- After a successful upload, that success toast MUST offer a **Save** action so the user can store the working patch on the current slot. It MUST NOT store automatically. Save on the toast still goes through the device session (store SET `114a`), the same as the patch-bar Save.
- Show a promise toast while connecting a pedal, and a toast when the session disconnects (user-initiated or lost link).
- When the session becomes disconnected, the Connect modal MUST close. It MUST NOT stay open on the scan/connected panel.

## Non-goals

- Toasts for every live edit (module on/off, drag reorder, model/control sliders), patch previous/select/next, or download.
- Replacing the existing rename/duplicate/upload confirm Dialogs, or the invalid/wrong-model upload error Dialog, with toasts.
- Auto-Save after upload. The toast only offers Save; the user still chooses.
- A new spec domain, HTTP backend, Tauri toast plugin, or treating USB and Bluetooth as interchangeable (`docs/architecture.md`).
- Editor/Library routes, Library `.prst` import, IRs/NAM, or mobile packaging.
- Changing MIDI, SysEx codecs, or store/upload write paths.

## Capabilities

### New Capabilities

- None. Toast chrome belongs on the existing shell; connect/disconnect and patch-bar actions stay in their current domains.

### Modified Capabilities

- `app-shell`: The shell hosts a global toast region so connect and Controller can surface status without changing route.
- `device-connection`: Connect and disconnect report status with toasts. Becoming disconnected closes the Connect modal.
- `live-controller`: Save, rename, duplicate, and confirmed upload report status with promise toasts. A successful upload toast offers Save for the current slot.

## Impact

- `src/components/ui/`: add the shadcn Sonner primitive (`sonner` dependency).
- `src/app/AppShell.tsx`: mount the toaster in shell chrome.
- `src/features/connect/`: promise toast around connect; toast + close dialog on disconnect (user Disconnect and lost-link `dropLink`).
- `src/features/controller/PatchBar.tsx`: promise toasts around save/rename/duplicate/upload; upload success includes a Save action.
- `src/device/session.ts` only if store/upload need a result the UI can treat as success vs error for `toast.promise`. No new MIDI, SysEx, or Tauri commands.
- `docs/architecture.md` / OpenSpec context: note global toasts for those actions; MIDI constraints unchanged.
