import { ChevronLeft, ChevronRight, Copy, Download, Pencil, RefreshCw, Save, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { displayModelName, type DeviceModel } from "@/device/models";
import { decodePrstFile } from "@/device/patch-store";
import {
  type DeviceSession,
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
} from "@/device/session";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { useRef, useState, type ChangeEvent, type ReactElement } from "react";
import { toast } from "sonner";

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

const patchChipClass =
  "rounded-[4px] bg-muted dark:bg-muted/40 dark:hover:bg-muted/50";
const patchActionClass = `${patchChipClass} px-3`;
const patchActionIconClass = "size-3 text-muted-foreground";

const unsavedPatchHint = "Unsaved changes will be lost";

function toastError(fallback: string) {
  return (cause: unknown) => (cause instanceof Error ? cause.message : fallback);
}

async function runWhileConnected(
  session: DeviceSession,
  action: () => Promise<void>,
): Promise<void> {
  await action();
  if (session.getSnapshot().status !== "connected") {
    throw new Error("Pedal disconnected.");
  }
}

function waitUntilChainIdle(session: DeviceSession): Promise<void> {
  const snapshot = session.getSnapshot();
  if (snapshot.status !== "connected") {
    return Promise.reject(new Error("Pedal disconnected."));
  }
  if (snapshot.chainSync !== "syncing") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const unsubscribe = session.subscribe(() => {
      const next = session.getSnapshot();
      if (next.status !== "connected") {
        unsubscribe();
        reject(new Error("Pedal disconnected."));
        return;
      }
      if (next.chainSync !== "syncing") {
        unsubscribe();
        resolve();
      }
    });
  });
}

function savePatchWithToast(
  session: DeviceSession,
  before?: () => Promise<void>,
) {
  return toast.promise(
    runWhileConnected(session, async () => {
      if (before) {
        await before();
      }
      await session.savePatch();
    }),
    {
      loading: "Saving patch…",
      success: "Patch saved",
      error: toastError("Could not save patch."),
    },
  );
}

function PatchNavTooltip({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactElement;
}) {
  if (!enabled) {
    return children;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        <TriangleAlert className="size-3 text-amber-600 dark:text-amber-400" aria-hidden />
        {unsavedPatchHint}
      </TooltipContent>
    </Tooltip>
  );
}

function triggerPatchDownload(filename: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PatchBar({
  patch,
  patchNames,
  busy,
  canExportPatch,
  modified,
  model,
}: {
  patch: number;
  patchNames: (string | null)[];
  busy: boolean;
  canExportPatch: boolean;
  modified: boolean;
  model: DeviceModel;
}) {
  const session = useDeviceSession();
  const currentName = patchNames[patch];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDest, setDuplicateDest] = useState(String((patch + 1) % PATCH_COUNT));
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<Uint8Array | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const destIndex = Number.parseInt(duplicateDest, 10);
  const destName =
    Number.isInteger(destIndex) && destIndex !== patch ? patchNames[destIndex] : null;
  const destOccupied = Boolean(destName);

  function openRename() {
    setRenameValue(currentName ?? "");
    setRenameOpen(true);
  }

  function openDuplicate() {
    setDuplicateDest(String((patch + 1) % PATCH_COUNT));
    setOverwriteOpen(false);
    setDuplicateOpen(true);
  }

  function confirmRename() {
    const name = renameValue;
    setRenameOpen(false);
    void toast.promise(
      runWhileConnected(session, () => session.renamePatch(name)),
      {
        loading: "Renaming patch…",
        success: "Patch renamed",
        error: toastError("Could not rename patch."),
      },
    );
  }

  function confirmDuplicate() {
    if (!Number.isInteger(destIndex) || destIndex === patch) {
      return;
    }
    if (destOccupied && !overwriteOpen) {
      setOverwriteOpen(true);
      return;
    }
    const slot = destIndex;
    setDuplicateOpen(false);
    setOverwriteOpen(false);
    void toast.promise(
      runWhileConnected(session, () => session.duplicatePatch(slot)),
      {
        loading: "Duplicating patch…",
        success: "Patch duplicated",
        error: toastError("Could not duplicate patch."),
      },
    );
  }

  async function downloadPatch() {
    const file = await session.downloadCurrentPatch();
    if (!file) {
      return;
    }
    triggerPatchDownload(file.filename, file.bytes);
  }

  async function onPickUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoded = decodePrstFile(bytes);
    if (!decoded) {
      setPendingUpload(null);
      setUploadError("This file is not a valid Valeton preset.");
      return;
    }
    if (decoded.model !== model) {
      setPendingUpload(null);
      setUploadError(
        `This preset is for ${displayModelName(decoded.model)}. Connect a ${displayModelName(decoded.model)} to upload it.`,
      );
      return;
    }
    setUploadError(null);
    setPendingUpload(bytes);
  }

  function confirmUpload() {
    if (!pendingUpload) {
      return;
    }
    const bytes = pendingUpload;
    setPendingUpload(null);
    void toast.promise(
      (async () => {
        const result = await session.uploadCurrentPatch(bytes);
        if (!result.ok) {
          throw new Error(
            result.reason === "disconnected"
              ? "Pedal disconnected."
              : result.reason === "busy"
                ? "The patch is still syncing."
                : result.reason === "wrong-model"
                  ? "This preset is for a different pedal."
                  : "This file is not a valid Valeton preset.",
          );
        }
        if (session.getSnapshot().status !== "connected") {
          throw new Error("Pedal disconnected.");
        }
      })(),
      {
        loading: "Uploading patch…",
        success: () => ({
          message: "Patch loaded into the working slot",
          action: {
            label: "Save",
            onClick: () => {
              void savePatchWithToast(session, () => waitUntilChainIdle(session));
            },
          },
        }),
        error: toastError("Could not upload patch."),
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <TooltipProvider delayDuration={0}>
        <PatchNavTooltip enabled={modified}>
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous patch"
              disabled={busy}
              className={patchChipClass}
              onClick={() => void session.stepPatch(-1)}
            >
              <ChevronLeft />
            </Button>
          </span>
        </PatchNavTooltip>
        <Select
          value={String(patch)}
          onValueChange={(value) => {
            void session.setPatch(Number.parseInt(value, 10));
          }}
        >
          <PatchNavTooltip enabled={modified}>
            <SelectTrigger
              aria-label="Select patch"
              size="default"
              className={`${patchChipClass} w-72 min-w-72 justify-center border-transparent py-0 text-lg font-semibold tabular-nums dark:border-transparent`}
            >
              <SelectValue>
                {currentName ? formatPatchOption(patch, currentName) : formatPatch(patch)}
              </SelectValue>
            </SelectTrigger>
          </PatchNavTooltip>
          <SelectContent position="popper" className="max-h-72 min-w-72">
            {patchOptions.map((option) => (
              <SelectItem
                key={option}
                value={String(option)}
                className="font-medium tabular-nums"
              >
                {formatPatchOption(option, patchNames[option])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PatchNavTooltip enabled={modified}>
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next patch"
              disabled={busy}
              className={patchChipClass}
              onClick={() => void session.stepPatch(1)}
            >
              <ChevronRight />
            </Button>
          </span>
        </PatchNavTooltip>
      </TooltipProvider>
      <div className="ml-2 flex items-center gap-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  className={patchChipClass}
                  aria-label="Reload patch"
                  onClick={() => {
                    session.reloadCurrentPatch();
                  }}
                >
                  <RefreshCw />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reload patch</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !modified}
          className={
            modified && !busy
              ? "rounded-[4px] border-transparent bg-emerald-100 px-3 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900 dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700 dark:hover:text-emerald-100 [&_svg]:text-emerald-800 hover:[&_svg]:text-emerald-900 dark:[&_svg]:text-emerald-200 dark:hover:[&_svg]:text-emerald-100"
              : patchActionClass
          }
          aria-label="Save patch"
          onClick={() => {
            void savePatchWithToast(session);
          }}
        >
          <Save className={modified && !busy ? "size-3" : patchActionIconClass} />
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className={patchActionClass}
          aria-label="Rename patch"
          onClick={openRename}
        >
          <Pencil className={patchActionIconClass} />
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className={patchActionClass}
          aria-label="Duplicate patch"
          onClick={openDuplicate}
        >
          <Copy className={patchActionIconClass} />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !canExportPatch}
          className={patchActionClass}
          aria-label="Download patch"
          onClick={() => void downloadPatch()}
        >
          <Download className={patchActionIconClass} />
          Download
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className={patchActionClass}
          aria-label="Upload patch"
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          <Upload className={patchActionIconClass} />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".prst"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            void onPickUpload(event);
          }}
        />
      </div>
      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename patch</DialogTitle>
            <DialogDescription>
              At most 10 characters. Letters, digits, space, and hyphen.
            </DialogDescription>
          </DialogHeader>
          <Input
            id="rename-patch"
            value={renameValue}
            maxLength={10}
            autoFocus
            aria-label="Patch name"
            onChange={(event) => {
              setRenameValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmRename();
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={duplicateOpen}
        onOpenChange={(open) => {
          setDuplicateOpen(open);
          if (!open) {
            setOverwriteOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {overwriteOpen ? "Overwrite patch" : "Duplicate patch"}
            </DialogTitle>
            <DialogDescription>
              {overwriteOpen
                ? `Slot ${formatPatch(destIndex)} already has ${destName}. Overwrite it?`
                : "Copy the current working patch onto another slot. The selected patch stays the same."}
            </DialogDescription>
          </DialogHeader>
          {overwriteOpen ? null : (
            <Select
              value={duplicateDest}
              onValueChange={(value) => {
                setDuplicateDest(value);
                setOverwriteOpen(false);
              }}
            >
              <SelectTrigger aria-label="Destination slot" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {patchOptions
                  .filter((option) => option !== patch)
                  .map((option) => (
                    <SelectItem
                      key={option}
                      value={String(option)}
                      className="font-medium tabular-nums"
                    >
                      {formatPatchOption(option, patchNames[option])}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (overwriteOpen) {
                  setOverwriteOpen(false);
                  return;
                }
                setDuplicateOpen(false);
              }}
            >
              {overwriteOpen ? "Back" : "Cancel"}
            </Button>
            <Button type="button" onClick={confirmDuplicate}>
              {overwriteOpen ? "Overwrite" : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingUpload !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingUpload(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load file into current patch?</DialogTitle>
            <DialogDescription>
              <span className="block">
                This will load the file into patch{" "}
                {formatPatchOption(patch, currentName)}.
              </span>
              <span className="mt-2 block">It will overwrite any unsaved changes.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingUpload(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmUpload}>
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={uploadError !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUploadError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot upload patch</DialogTitle>
            <DialogDescription>{uploadError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setUploadError(null);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
