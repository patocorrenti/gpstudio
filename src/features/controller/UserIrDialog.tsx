import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
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
import {
  type DeviceSession,
  type SessionSnapshot,
  type UserIrFile,
  type UserIrSlot,
} from "@/device/session";
import {
  isUserIrNameChar,
  sanitizeUserIrName,
  USER_IR_FIRST, USER_IR_LAST, USER_IR_NAME_MAX,
} from "@/device/user-ir-table";

const UNKNOWN_SLOT = "This IR slot is unknown until the IR list is read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";
const LINK_ERROR = "Bluetooth cannot send an IR file. Connect with USB.";

type Phase = "ready" | "sending" | "error";

type Draft = {
  slot: number;
  fileName: string;
  ir: UserIrFile;
  name: string;
  phase: Phase;
  message: string;
};

function pad(slot: number): string {
  return String(slot).padStart(2, "0");
}

function slotName(slot: number, entry: UserIrSlot | undefined, fallback: string | null): string | null {
  if (entry?.flag === 0) {
    return entry.name && entry.name.length > 0 ? entry.name : `User IR ${pad(slot)}`;
  }
  if (entry?.flag === 1) {
    return null;
  }
  // Table not read (flag null): fall back to the IR-name dump.
  return fallback && !/^User IR \d+$/.test(fallback) ? fallback : null;
}

function slotLabel(slot: number, entry: UserIrSlot | undefined, fallback: string | null): string {
  return slotName(slot, entry, fallback) ?? "Empty";
}

/** Typing filter: Suite's printable set, at most 10. Unlike the stored form, blank is allowed while typing. */
function typedName(value: string): string {
  return [...value].filter(isUserIrNameChar).join("").slice(0, USER_IR_NAME_MAX);
}

function describeSource(ir: UserIrFile): string {
  const khz = `${(ir.sourceRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz`;
  const channels = ir.sourceChannels === 1 ? "mono" : `${ir.sourceChannels} ch (first channel used)`;
  return `${khz} · ${ir.sourceBits}-bit · ${channels}`;
}

export function UserIrDialog({
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
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(USER_IR_FIRST);
  const toldRef = useRef(false);

  useEffect(() => session.subscribe(() => setSnapshot(session.getSnapshot())), [session]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // The connect-time IR-name dump already fills the table on USB; read again in case it was missed.
    const now = session.getSnapshot();
    if (now.status === "connected" && now.snapFileLink && now.userIrSlots.some((entry) => entry.flag === null)) {
      void session.refreshUserIrSlots();
    }
  }, [open, session]);

  useEffect(() => {
    if (!open || snapshot.status === "connected") {
      return;
    }
    if (draft?.phase === "sending" && !toldRef.current) {
      toldRef.current = true;
      toast(UNKNOWN_SLOT);
    }
    onOpenChange(false);
  }, [draft?.phase, onOpenChange, open, snapshot.status]);

  if (snapshot.status !== "connected") {
    return null;
  }

  const accepts = snapshot.snapFileLink;
  const sending = draft?.phase === "sending";
  const busy = sending || snapshot.snapFileSend;
  const names = snapshot.userIrNames;

  async function onFile(slot: number, file: File) {
    if (!accepts || busy) {
      return;
    }
    let ir: UserIrFile;
    try {
      ir = await session.prepareUserIr(await file.arrayBuffer());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This IR could not be read.");
      return;
    }
    setDraft({
      slot,
      fileName: file.name,
      ir,
      name: typedName(file.name.replace(/\.wav$/i, "")),
      phase: "ready",
      message: "",
    });
    toldRef.current = false;
    onOpenChange(true);
  }

  async function startSend() {
    if (!draft || !accepts || busy) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    toldRef.current = false;
    const slot = draft.slot;
    const name = sanitizeUserIrName(draft.name);
    setProgress(0);
    setDraft({ ...draft, name, phase: "sending", message: "Uploading the IR to the Multi-Effects…" });
    const result = await session.uploadUserIr(slot, name, draft.ir.data, controller.signal, setProgress);
    if (result.ok) {
      toast.success(`${result.name} uploaded into User IR ${pad(slot)}.`);
      setDraft(null);
      onOpenChange(false);
      return;
    }
    let message: string;
    if ((result.reason === "cancelled" || result.reason === "closed") && result.sent) {
      toldRef.current = true;
      message = UNKNOWN_SLOT;
    } else if (result.reason === "cancelled") {
      setDraft((current) => (current ? { ...current, phase: "ready", message: "" } : current));
      return;
    } else if (result.reason === "port") {
      message = PORT_ERROR;
    } else if (result.reason === "link") {
      message = LINK_ERROR;
    } else if (result.reason === "busy") {
      message = "The pedal is busy. Try again in a moment.";
    } else {
      message = "The IR was not stored under the submitted name.";
    }
    setDraft((current) => (current ? { ...current, phase: "error", message } : current));
  }

  const occupied = draft ? snapshot.userIrSlots[draft.slot - USER_IR_FIRST] : undefined;
  const overwriteName = draft ? slotName(draft.slot, occupied, names[draft.slot - USER_IR_FIRST] ?? null) : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && sending) {
            return;
          }
          if (!next) {
            abortRef.current?.abort();
            setDraft(null);
            setProgress(0);
          }
          onOpenChange(next);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={!sending}
          className="max-h-[85vh] overflow-hidden sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>IRs</DialogTitle>
          </DialogHeader>
          {accepts || draft ? null : <p className="text-sm text-muted-foreground">{LINK_ERROR}</p>}
          {draft && sending ? (
            <div className="flex flex-col items-center gap-5 px-4 py-14 text-center">
              <p className="text-sm">{draft.message}</p>
              <div
                className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label={draft.message}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
          {draft && !sending ? (
            <div className="flex flex-col gap-3 py-1">
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
                <span className="text-sm text-muted-foreground">File</span>
                <div className="min-w-0">
                  <p className="truncate text-sm">{draft.fileName}</p>
                  <p className="text-xs text-muted-foreground">{describeSource(draft.ir)}</p>
                </div>
                <span className="self-start pt-1.5 text-sm text-muted-foreground">In Slot</span>
                <div className="min-w-0">
                  <Select
                    value={String(draft.slot)}
                    onValueChange={(next) => {
                      const slot = Number(next);
                      if (Number.isInteger(slot)) {
                        setDraft((current) => (current ? { ...current, slot } : current));
                      }
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="IR slot" className="h-8 w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-72">
                      {Array.from({ length: USER_IR_LAST - USER_IR_FIRST + 1 }, (_, index) => {
                        const slot = USER_IR_FIRST + index;
                        return (
                          <SelectItem key={slot} value={String(slot)}>
                            {`${pad(slot)} · ${slotLabel(slot, snapshot.userIrSlots[index], names[index] ?? null)}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {overwriteName ? (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      {`${overwriteName} will be overwritten`}
                    </p>
                  ) : null}
                </div>
                <span className="text-sm text-muted-foreground">As</span>
                <Input
                  aria-label="IR name"
                  value={draft.name}
                  maxLength={USER_IR_NAME_MAX}
                  className="rounded-sm"
                  onChange={(event) => {
                    const name = typedName(event.target.value);
                    setDraft((current) => (current ? { ...current, name } : current));
                  }}
                />
              </div>
              {draft.ir.audibleCut ? (
                <p className="text-xs text-muted-foreground">
                  The pedal uses the first 11.6 ms of each IR, like Valeton Suite. This file has some sound after that,
                  which is left out.
                </p>
              ) : null}
              {draft.message ? <p className="text-sm">{draft.message}</p> : null}
            </div>
          ) : null}
          {draft ? null : (
            <TooltipProvider delayDuration={300}>
              <div className="max-h-[60vh] divide-y divide-foreground/10 overflow-y-auto">
                {Array.from({ length: USER_IR_LAST - USER_IR_FIRST + 1 }, (_, index) => {
                  const slot = USER_IR_FIRST + index;
                  const entry = snapshot.userIrSlots[index];
                  const name = slotName(slot, entry, names[index] ?? null);
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm hover:bg-muted/50"
                      onDragOver={(event) => {
                        if (accepts && !busy) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        if (!accepts || busy) {
                          return;
                        }
                        event.preventDefault();
                        const file = event.dataTransfer.files[0];
                        if (file) {
                          void onFile(slot, file);
                        }
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="w-5 shrink-0 font-normal tabular-nums text-muted-foreground">
                          {pad(slot)}
                        </span>
                        <span className={name ? "truncate" : "truncate text-muted-foreground"}>
                          {name ?? "Empty"}
                        </span>
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Load a WAV into User IR ${pad(slot)}`}
                            disabled={!accepts || busy}
                            onClick={() => {
                              slotRef.current = slot;
                              fileRef.current?.click();
                            }}
                          >
                            <Upload />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Load WAV</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
          {draft && !sending ? (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setProgress(0);
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void startSend()} disabled={!accepts || busy}>
                Confirm
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
      <input
        ref={fileRef}
        type="file"
        accept=".wav,audio/wav,audio/x-wav"
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
    </>
  );
}
