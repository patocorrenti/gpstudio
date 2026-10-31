import { useEffect, useRef, useState } from "react";
import { SearchIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type DeviceSession, type NamInspection, type SessionSnapshot } from "@/device/session";

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
  const [query, setQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const toldRef = useRef(false);
  const finishedRef = useRef(false);
  const previewRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(50);

  useEffect(() => session.subscribe(() => setSnapshot(session.getSnapshot())), [session]);

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
    if (draft?.phase === "sending") {
      if (!toldRef.current) {
        toldRef.current = true;
        toast(UNKNOWN_SLOT);
      }
    }
    onOpenChange(false);
  }, [draft?.phase, onOpenChange, open, snapshot.status]);

  if (snapshot.status !== "connected") {
    return null;
  }

  const accepts = snapshot.snapFileLink;
  const busy = draft?.phase === "converting" || draft?.phase === "sending";
  const factory = session.factorySnapToneLabels();

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
        toast.success(`SnapTone ${slot} is now ${result.name}.`);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && draft?.phase === "sending") {
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
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={draft?.phase !== "sending"}
        className="max-h-[85vh] overflow-hidden sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>SnapTones</DialogTitle>
        </DialogHeader>
        {accepts || preview ? null : (
          <p className="text-sm text-muted-foreground">
            Bluetooth cannot send a SnapTone file. Connect with USB.
          </p>
        )}
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
        {preview ? null : (
        <TooltipProvider delayDuration={300}>
        <div className="flex flex-col gap-2">
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
            <div key={row.index} className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-1">
                <SlotIndex index={row.index} />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Factory</span>
            </div>
          ))}
          {factory.every((row) => !matchesQuery(query, row.index, row.label)) &&
          snapshot.userSnapSlots.every((entry, index) => !matchesQuery(query, 50 + index, slotLabel(entry.name, 50 + index))) ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">No matches.</p>
          ) : null}
          {snapshot.userSnapSlots.map((entry, index) => {
            const protocol = 50 + index;
            const label = slotLabel(entry.name, protocol);
            if (!matchesQuery(query, protocol, label)) {
              return null;
            }
            return (
              <div
                key={protocol}
                className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm"
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
              </div>
            );
          })}
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
      </DialogContent>
    </Dialog>
  );
}
