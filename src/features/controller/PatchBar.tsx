import { ChevronLeft, ChevronRight, Copy, Download, Pencil, Save } from "lucide-react";
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
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
} from "@/device/session";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { useState } from "react";

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

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
}: {
  patch: number;
  patchNames: (string | null)[];
  busy: boolean;
  canExportPatch: boolean;
}) {
  const session = useDeviceSession();
  const currentName = patchNames[patch];
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDest, setDuplicateDest] = useState(String((patch + 1) % PATCH_COUNT));
  const [overwriteOpen, setOverwriteOpen] = useState(false);
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
    void session.renamePatch(renameValue);
    setRenameOpen(false);
  }

  function confirmDuplicate() {
    if (!Number.isInteger(destIndex) || destIndex === patch) {
      return;
    }
    if (destOccupied && !overwriteOpen) {
      setOverwriteOpen(true);
      return;
    }
    void session.duplicatePatch(destIndex);
    setDuplicateOpen(false);
    setOverwriteOpen(false);
  }

  async function downloadPatch() {
    const file = await session.downloadCurrentPatch();
    if (!file) {
      return;
    }
    triggerPatchDownload(file.filename, file.bytes);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Previous patch"
        disabled={busy}
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(-1)}
      >
        <ChevronLeft className="size-6" />
      </Button>
      <Select
        value={String(patch)}
        onValueChange={(value) => {
          void session.setPatch(Number.parseInt(value, 10));
        }}
      >
        <SelectTrigger
          aria-label="Select patch"
          size="default"
          className="h-12 min-h-12 w-72 min-w-72 justify-center border-transparent bg-muted py-0 text-xl font-semibold tabular-nums data-[size=default]:h-12 dark:border-transparent dark:bg-muted/40 dark:hover:bg-muted/50"
        >
          <SelectValue>
            {currentName ? formatPatchOption(patch, currentName) : formatPatch(patch)}
          </SelectValue>
        </SelectTrigger>
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
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Next patch"
        disabled={busy}
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(1)}
      >
        <ChevronRight className="size-6" />
      </Button>
      <div className="ml-2 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          onClick={() => void session.savePatch()}
        >
          <Save />
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Rename patch"
          onClick={openRename}
        >
          <Pencil />
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Duplicate patch"
          onClick={openDuplicate}
        >
          <Copy />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !canExportPatch}
          className="h-12 bg-muted px-3 dark:bg-muted/40 dark:hover:bg-muted/50"
          aria-label="Download patch"
          onClick={() => void downloadPatch()}
        >
          <Download />
          Download
        </Button>
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
    </div>
  );
}
