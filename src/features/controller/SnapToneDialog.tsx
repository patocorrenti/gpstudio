import { useEffect, useRef, useState } from "react";
import { Pencil, SearchIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type DeviceSession, type NamInspection, type SessionSnapshot } from "@/device/session";
import { getTone3000Account } from "@/features/tone3000/account";
import { Tone3000Catalog } from "@/features/tone3000/Tone3000Catalog";
import { holdTone3000Popup, openTone3000Popup } from "@/features/tone3000/popup";
import { publishableKey } from "@/features/tone3000/oauth";
import { isNativeDesktop, isTone3000ControlVisible } from "@/features/tone3000/visibility";

const UNKNOWN_SLOT = "This slot is unknown until SnapTone names are read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";

type Phase = "ready" | "converting" | "sending" | "error";

type Draft = {
  slot: number;
  fileName: string;
  file: ArrayBuffer;
  inspection: NamInspection;
  name: string;
  phase: Phase;
  message: string;
};

type DeleteAsk = {
  slot: number;
  name: string;
  phase: "confirm" | "deleting" | "error";
  message: string;
};

type RenameAsk = {
  slot: number;
  name: string;
  phase: "edit" | "renaming" | "error";
  message: string;
};

function storedName(value: string): string {
  const cut = value.replaceAll(".nam", "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return cut === "" ? "X" : cut;
}

function slotLabel(name: string | null, protocol: number): string {
  return name && name.length > 0 ? name : `SnapTone ${protocol}`;
}

function matchesQuery(query: string, index: number, label: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const padded = String(index).padStart(2, "0");
  return (
    label.toLowerCase().includes(needle) ||
    padded.includes(needle) ||
    String(index).includes(needle)
  );
}

function SlotIndex({ index }: { index: number }) {
  return (
    <span className="w-5 shrink-0 font-normal tabular-nums text-muted-foreground">
      {String(index).padStart(2, "0")}
    </span>
  );
}

type SnapListFilter = "custom" | "factory" | "all";

export function SnapToneDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: DeviceSession;
}) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => session.getSnapshot());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [shownProgress, setShownProgress] = useState(0);
  const realProgress = useRef(0);
  const [listFilter, setListFilter] = useState<SnapListFilter>("custom");
  const [query, setQuery] = useState("");
  const [deleteAsk, setDeleteAsk] = useState<DeleteAsk | null>(null);
  const [renameAsk, setRenameAsk] = useState<RenameAsk | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const deletingRef = useRef(false);
  const renamingRef = useRef(false);
  const toldRef = useRef(false);
  const finishedRef = useRef(false);
  const previewRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(50);
  const [toneSlot, setToneSlot] = useState<number | null>(null);

  useEffect(() => session.subscribe(() => setSnapshot(session.getSnapshot())), [session]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setListFilter("custom");
    setQuery("");
  }, [open]);

  useEffect(() => {
    if (draft?.phase !== "converting" && draft?.phase !== "sending") {
      return;
    }
    const cap = 0.98;
    let previous = -1;
    let quietSince = performance.now();
    const timer = window.setInterval(() => {
      const real = realProgress.current;
      const now = performance.now();
      if (real > previous + 0.001) {
        previous = real;
        quietSince = now;
      }
      const quiet = now - quietSince > 400;
      setShownProgress((current) => {
        const next = Math.max(current, real);
        const crept = quiet && next < cap ? next + (cap - next) * 0.025 : next;
        return Math.abs(crept - current) < 0.0005 ? current : crept;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [draft?.phase]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (snapshot.status === "connected") {
      return;
    }
    if (draft?.phase === "sending" || deleteAsk?.phase === "deleting" || renameAsk?.phase === "renaming") {
      if (!toldRef.current) {
        toldRef.current = true;
        toast(UNKNOWN_SLOT);
      }
    }
    setToneSlot(null);
    onOpenChange(false);
  }, [deleteAsk?.phase, draft?.phase, onOpenChange, open, renameAsk?.phase, snapshot.status]);

  if (snapshot.status !== "connected") {
    return null;
  }

  const accepts = snapshot.snapFileLink;
  const offerTone3000 = isTone3000ControlVisible({
    connected: true,
    usb: snapshot.linkMode === "usb",
    publishableKey: publishableKey(),
    tauri: isNativeDesktop(),
  });
  const deleting = deleteAsk?.phase === "deleting";
  const renaming = renameAsk?.phase === "renaming";
  const busy = draft?.phase === "converting" || draft?.phase === "sending" || deleting || renaming;
  const factoryAll = session.factorySnapToneLabels();
  const showFactoryRows = listFilter === "factory" || listFilter === "all";
  const showCustomRows = listFilter === "custom" || listFilter === "all";
  const factory = showFactoryRows ? factoryAll : [];

  function tellUnknown() {
    if (toldRef.current) {
      return;
    }
    toldRef.current = true;
    toast(UNKNOWN_SLOT);
  }

  async function onFile(slot: number, file: File) {
    if (!accepts || busy) {
      return;
    }
    const bytes = await file.arrayBuffer();
    const inspection = await session.inspectNam(bytes);
    const fromFile = inspection.name ?? file.name.replace(/\.nam$/i, "");
    setDraft({
      slot,
      fileName: file.name,
      file: bytes,
      inspection,
      name: fromFile.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10),
      phase: "ready",
      message: "",
    });
    toldRef.current = false;
  }

  function leavePreview() {
    if (draft?.phase === "sending") {
      return;
    }
    previewRef.current += 1;
    if (draft?.phase === "converting") {
      abortRef.current?.abort();
    }
    realProgress.current = 0;
    setConvertProgress(0);
    setShownProgress(0);
    setDraft(null);
  }

  function cancelDelete() {
    if (deleteAsk?.phase === "deleting") {
      return;
    }
    deletingRef.current = false;
    setDeleteAsk(null);
  }

  async function startDelete() {
    if (deletingRef.current || !deleteAsk || deleteAsk.phase !== "confirm" || busy) {
      return;
    }
    deletingRef.current = true;
    toldRef.current = false;
    const slot = deleteAsk.slot;
    const name = deleteAsk.name;
    setDeleteAsk({ slot, name, phase: "deleting", message: "Deleting SnapTone…" });
    try {
      const result = await session.deleteUserSnapTone(slot);
      if (result.ok) {
        toast.success(`SnapTone ${String(slot).padStart(2, "0")} deleted.`);
        setDeleteAsk(null);
        return;
      }
      const now = session.getSnapshot();
      const entry = now.status === "connected" ? now.userSnapSlots[slot - 50] : undefined;
      const unknown = now.status !== "connected" || entry?.flag == null;
      const message =
        result.reason === "link"
          ? "Bluetooth cannot send a SnapTone file. Connect with USB."
          : result.reason === "port"
            ? PORT_ERROR
            : result.reason === "busy"
              ? "The pedal is busy."
              : unknown
                ? UNKNOWN_SLOT
                : "The SnapTone was not deleted.";
      if (unknown && result.reason !== "link" && result.reason !== "port" && result.reason !== "busy") {
        tellUnknown();
      }
      setDeleteAsk({ slot, name, phase: "error", message });
    } catch {
      setDeleteAsk({ slot, name, phase: "error", message: "The SnapTone was not deleted." });
    } finally {
      deletingRef.current = false;
    }
  }

  function cancelRename() {
    if (renameAsk?.phase === "renaming") {
      return;
    }
    renamingRef.current = false;
    setRenameAsk(null);
  }

  async function startRename() {
    if (renamingRef.current || !renameAsk || renameAsk.phase !== "edit" || busy) {
      return;
    }
    renamingRef.current = true;
    toldRef.current = false;
    const slot = renameAsk.slot;
    const name = storedName(renameAsk.name);
    setRenameAsk({ slot, name, phase: "renaming", message: "Renaming SnapTone…" });
    try {
      const result = await session.renameUserSnapTone(slot, name);
      if (result.ok) {
        toast.success(`SnapTone ${String(slot).padStart(2, "0")} renamed to ${result.name}.`);
        setRenameAsk(null);
        return;
      }
      const now = session.getSnapshot();
      const entry = now.status === "connected" ? now.userSnapSlots[slot - 50] : undefined;
      const unknown = now.status !== "connected" || entry?.flag == null;
      const message =
        result.reason === "link"
          ? "Bluetooth cannot send a SnapTone file. Connect with USB."
          : result.reason === "port"
            ? PORT_ERROR
            : result.reason === "busy"
              ? "The pedal is busy."
              : unknown
                ? UNKNOWN_SLOT
                : "The SnapTone was not renamed.";
      if (unknown && result.reason !== "link" && result.reason !== "port" && result.reason !== "busy") {
        tellUnknown();
      }
      setRenameAsk({ slot, name, phase: "error", message });
    } catch {
      setRenameAsk({ slot, name, phase: "error", message: "The SnapTone was not renamed." });
    } finally {
      renamingRef.current = false;
    }
  }

  async function startSend() {
    if (!draft || draft.inspection.kind !== "A2" || !accepts || busy) {
      return;
    }
    const generation = previewRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    toldRef.current = false;
    const slot = draft.slot;
    const name = storedName(draft.name);
    realProgress.current = 0;
    setConvertProgress(0);
    setShownProgress(0);
    setDraft({ ...draft, name, phase: "converting", message: "Converting to SnapTone…" });
    try {
      const file = await session.convertNamToSnapTone(
        draft.file,
        (fraction) => {
          if (previewRef.current === generation) {
            realProgress.current = fraction;
            setConvertProgress(fraction);
          }
        },
        controller.signal,
      );
      if (controller.signal.aborted || previewRef.current !== generation) {
        return;
      }
      setDraft((current) =>
        current ? { ...current, phase: "sending", message: "Uploading it to the Multi-Effects…" } : current,
      );
      const result = await session.uploadUserSnapTone(slot, name, file, controller.signal);
      if (previewRef.current !== generation) {
        return;
      }
      if (result.ok) {
        finishedRef.current = true;
        toast.success(`${result.name} uploaded into the slot ${String(slot).padStart(2, "0")}.`);
        setDraft(null);
        onOpenChange(false);
        return;
      }
      if (result.reason === "cancelled" || controller.signal.aborted) {
        if (result.sent) {
          tellUnknown();
          setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_SLOT } : current));
        }
        return;
      }
      if (result.reason === "port") {
        setDraft((current) => (current ? { ...current, phase: "error", message: PORT_ERROR } : current));
        return;
      }
      if (result.reason === "closed" && result.sent) {
        tellUnknown();
        setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_SLOT } : current));
        return;
      }
      const message =
        result.reason === "link"
          ? "Bluetooth cannot send a SnapTone file. Connect with USB."
          : "The SnapTone was not stored under the submitted name.";
      setDraft((current) => (current ? { ...current, phase: "error", message } : current));
    } catch (error) {
      if (controller.signal.aborted || previewRef.current !== generation) {
        return;
      }
      const message = error instanceof Error ? error.message : "The SnapTone converter stopped.";
      setDraft((current) => (current ? { ...current, phase: "error", message } : current));
    }
  }

  const preview = draft !== null;
  const occupied = draft ? snapshot.userSnapSlots[draft.slot - 50] : undefined;
  const overwriteName =
    draft && occupied?.flag === 0 ? slotLabel(occupied.name, draft.slot) : null;

  const toneEntry = toneSlot === null ? undefined : snapshot.userSnapSlots[toneSlot - 50];
  const existingName =
    toneSlot !== null && toneEntry?.flag === 0
      ? toneEntry.name && toneEntry.name.length > 0
        ? toneEntry.name
        : `SnapTone ${String(toneSlot)}`
      : null;

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (draft?.phase === "sending" || deleteAsk?.phase === "deleting" || renameAsk?.phase === "renaming")) {
          return;
        }
        if (!next && busy && !finishedRef.current) {
          previewRef.current += 1;
          abortRef.current?.abort();
        }
        if (!next) {
          finishedRef.current = false;
          previewRef.current += 1;
          realProgress.current = 0;
          setConvertProgress(0);
          setShownProgress(0);
          setQuery("");
          setDraft(null);
          setDeleteAsk(null);
          setRenameAsk(null);
          setToneSlot(null);
          deletingRef.current = false;
          renamingRef.current = false;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={draft?.phase !== "sending" && deleteAsk?.phase !== "deleting" && renameAsk?.phase !== "renaming"}
        className="max-h-[85vh] overflow-hidden sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>SnapTones</DialogTitle>
        </DialogHeader>
        {accepts || preview || deleteAsk || renameAsk ? null : (
          <p className="text-sm text-muted-foreground">
            Bluetooth cannot send a SnapTone file. Connect with USB.
          </p>
        )}
        {deleteAsk?.phase === "deleting" ? (
          <p className="px-4 py-14 text-center text-sm">{deleteAsk.message}</p>
        ) : null}
        {renameAsk?.phase === "renaming" ? (
          <p className="px-4 py-14 text-center text-sm">{renameAsk.message}</p>
        ) : null}
        {renameAsk && renameAsk.phase !== "renaming" ? (
          <div className="flex flex-col gap-3 py-1">
            {renameAsk.phase === "edit" ? (
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
                <span className="text-sm text-muted-foreground">Slot</span>
                <span className="text-sm tabular-nums">{String(renameAsk.slot).padStart(2, "0")}</span>
                <span className="text-sm text-muted-foreground">Name</span>
                <Input
                  aria-label="SnapTone name"
                  value={renameAsk.name}
                  maxLength={10}
                  className="rounded-sm"
                  onChange={(event) => {
                    const name = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
                    setRenameAsk((current) => (current ? { ...current, name } : current));
                  }}
                />
              </div>
            ) : (
              <p className="text-sm">{renameAsk.message}</p>
            )}
          </div>
        ) : null}
        {deleteAsk && deleteAsk.phase !== "deleting" ? (
          <div className="flex flex-col gap-3 py-1">
            {deleteAsk.phase === "confirm" ? (
              <p className="text-sm">{`Delete SnapTone ${String(deleteAsk.slot).padStart(2, "0")} (${deleteAsk.name})?`}</p>
            ) : (
              <p className="text-sm">{deleteAsk.message}</p>
            )}
          </div>
        ) : null}
        {preview && draft && busy ? (
          <div className="flex flex-col items-center gap-5 px-4 py-14 text-center">
            <p className="text-sm">{draft.message}</p>
            <div
              className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.max(shownProgress, convertProgress) * 100)}
              aria-label={draft.message}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.min(98, Math.round(Math.max(shownProgress, convertProgress) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}
        {preview && draft && !busy ? (
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <span className="text-sm text-muted-foreground">Upload</span>
              <span className="truncate text-sm">{draft.fileName}</span>
              <span className="text-sm text-muted-foreground">In Slot</span>
              <span className="min-w-0 text-sm">
                <span className="tabular-nums">{String(draft.slot).padStart(2, "0")}</span>
                {overwriteName ? (
                  <span className="ml-2.5 text-xs text-amber-600 dark:text-amber-400">
                    {`(${overwriteName} will be overwritten)`}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">As</span>
              <Input
                aria-label="SnapTone name"
                value={draft.name}
                maxLength={10}
                className="rounded-sm"
                disabled={busy || draft.inspection.kind !== "A2"}
                onChange={(event) => {
                  const name = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
                  setDraft((current) => (current ? { ...current, name } : current));
                }}
              />
            </div>
            {draft.inspection.kind === "A2" ? null : (
              <p className="text-sm">{draft.inspection.reason}</p>
            )}
            {draft.message ? <p className="text-sm">{draft.message}</p> : null}
          </div>
        ) : null}
        {preview || deleteAsk || renameAsk ? null : (
        <TooltipProvider delayDuration={300}>
        <div className="flex flex-col gap-2">
          <ButtonGroup aria-label="SnapTone source">
            {(
              [
                ["custom", "Custom"],
                ["factory", "Factory"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => {
              const selected = listFilter === value;
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={selected}
                  className={cn(
                    "h-8 px-3.5",
                    selected
                      ? "bg-muted text-foreground hover:bg-muted dark:bg-input dark:hover:bg-input"
                      : "text-muted-foreground/70",
                  )}
                  onClick={() => setListFilter(value)}
                >
                  {label}
                </Button>
              );
            })}
          </ButtonGroup>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="Search"
              aria-label="Search SnapTones"
              className="rounded-sm pl-8"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </div>
          <div className="max-h-[50vh] divide-y divide-foreground/10 overflow-y-auto">
          {factory.filter((row) => matchesQuery(query, row.index, row.label)).map((row) => (
            <div key={row.index} className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm hover:bg-muted/50">
              <span className="flex min-w-0 items-center gap-1">
                <SlotIndex index={row.index} />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Factory</span>
            </div>
          ))}
          {(!showFactoryRows || factory.every((row) => !matchesQuery(query, row.index, row.label))) &&
          (!showCustomRows ||
            snapshot.userSnapSlots.every(
              (entry, index) => !matchesQuery(query, 50 + index, slotLabel(entry.name, 50 + index)),
            )) ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">No matches.</p>
          ) : null}
          {showCustomRows
            ? snapshot.userSnapSlots.map((entry, index) => {
            const protocol = 50 + index;
            const label = slotLabel(entry.name, protocol);
            if (!matchesQuery(query, protocol, label)) {
              return null;
            }
            return (
              <div
                key={protocol}
                className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm hover:bg-muted/50"
                onDragOver={(event) => {
                  if (!accepts || busy) {
                    return;
                  }
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!accepts || busy) {
                    return;
                  }
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) {
                    void onFile(protocol, file);
                  }
                }}
              >
                <span className="flex min-w-0 items-center gap-1">
                  <SlotIndex index={protocol} />
                  <span className="truncate">{label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {entry.flag === 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Rename SnapTone ${protocol}`}
                          disabled={!accepts || busy}
                          onClick={() => {
                            setRenameAsk({
                              slot: protocol,
                              name: storedName(entry.name && entry.name.length > 0 ? entry.name : label),
                              phase: "edit",
                              message: "",
                            });
                          }}
                        >
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Rename</TooltipContent>
                    </Tooltip>
                  ) : null}
                  {entry.flag === 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Delete SnapTone ${protocol}`}
                          disabled={!accepts || busy}
                          onClick={() => {
                            setDeleteAsk({
                              slot: protocol,
                              name: entry.name && entry.name.length > 0 ? entry.name : label,
                              phase: "confirm",
                              message: "",
                            });
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Delete</TooltipContent>
                    </Tooltip>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Upload NAM"
                        disabled={!accepts || busy}
                        onClick={() => {
                          slotRef.current = protocol;
                          fileRef.current?.click();
                        }}
                      >
                        <Upload />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Upload NAM</TooltipContent>
                  </Tooltip>
                  {offerTone3000 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          aria-label={`Tone3000 SnapTone ${protocol}`}
                          disabled={!accepts || busy}
                          onClick={() => {
                            if (getTone3000Account().status !== "signed-in") {
                              const popup = openTone3000Popup();
                              if (!popup) {
                                toast("Allow popups for GP Studio and try again.");
                                return;
                              }
                              holdTone3000Popup(popup);
                            }
                            setToneSlot(protocol);
                          }}
                        >
                          T3K
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Tone3000</TooltipContent>
                    </Tooltip>
                  ) : null}
                </span>
              </div>
            );
          })
            : null}
          </div>
        </div>
        </TooltipProvider>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".nam,application/json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void onFile(slotRef.current, file);
            }
          }}
        />
        {preview ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={leavePreview} disabled={draft?.phase === "sending"}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void startSend()}
              disabled={!accepts || busy || draft?.inspection.kind !== "A2"}
            >
              Confirm
            </Button>
          </DialogFooter>
        ) : null}
        {deleteAsk && deleteAsk.phase !== "deleting" ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelDelete}>
              {deleteAsk.phase === "error" ? "Back" : "Cancel"}
            </Button>
            {deleteAsk.phase === "confirm" ? (
              <Button type="button" variant="destructive" onClick={() => void startDelete()}>
                Delete
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
        {renameAsk && renameAsk.phase !== "renaming" ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelRename}>
              {renameAsk.phase === "error" ? "Back" : "Cancel"}
            </Button>
            {renameAsk.phase === "edit" ? (
              <Button type="button" onClick={() => void startRename()}>
                Rename
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
    <Tone3000Catalog
      open={toneSlot !== null}
      onOpenChange={(next) => {
        if (!next) {
          setToneSlot(null);
        }
      }}
      slot={toneSlot}
      existingName={existingName}
      session={session}
      onUploaded={() => {
        setToneSlot(null);
        onOpenChange(false);
      }}
    />
    </>
  );
}
