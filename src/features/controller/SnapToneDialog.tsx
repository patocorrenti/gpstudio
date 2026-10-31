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
import { type DeviceSession, type NamInspection, type SessionSnapshot } from "@/device/session";

const UNKNOWN_SLOT = "This slot is unknown until SnapTone names are read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";

type Phase = "ready" | "ask" | "converting" | "sending" | "error";

type Draft = {
  slot: number;
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

function SlotIndex({ index }: { index: number }) {
  return (
    <span className="w-7 shrink-0 font-normal tabular-nums text-muted-foreground">
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
  const abortRef = useRef<AbortController | null>(null);
  const toldRef = useRef(false);
  const finishedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(50);

  useEffect(() => session.subscribe(() => setSnapshot(session.getSnapshot())), [session]);

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
      file: bytes,
      inspection,
      name: fromFile.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10),
      phase: "ready",
      message: "",
    });
    toldRef.current = false;
  }

  function cancelWork() {
    const phase = draft?.phase;
    abortRef.current?.abort();
    if (phase === "sending") {
      tellUnknown();
      setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_SLOT } : current));
      return;
    }
    setDraft((current) => (current ? { ...current, phase: "ready", message: "" } : current));
  }

  async function startSend() {
    if (!draft || draft.inspection.kind !== "A2" || !accepts) {
      return;
    }
    const entry = snapshot.status === "connected" ? snapshot.userSnapSlots[draft.slot - 50] : undefined;
    if (draft.phase !== "ask" && entry?.flag === 0) {
      setDraft({ ...draft, phase: "ask", message: "" });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    toldRef.current = false;
    const slot = draft.slot;
    const name = storedName(draft.name);
    setDraft({ ...draft, name, phase: "converting", message: "Converting…" });
    try {
      const file = await session.convertNamToSnapTone(draft.file, undefined, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setDraft((current) =>
        current ? { ...current, phase: "sending", message: "Sending to the multi-effects…" } : current,
      );
      const result = await session.uploadUserSnapTone(slot, name, file, controller.signal);
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
      if (controller.signal.aborted) {
        setDraft((current) => (current?.phase === "converting" ? { ...current, phase: "ready", message: "" } : current));
        return;
      }
      const message = error instanceof Error ? error.message : "The SnapTone converter stopped.";
      setDraft((current) => (current ? { ...current, phase: "error", message } : current));
    }
  }

  const asking = draft?.phase === "ask";
  const asked = asking ? snapshot.userSnapSlots[draft.slot - 50] : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy && !finishedRef.current) {
          cancelWork();
        }
        if (!next) {
          finishedRef.current = false;
          setDraft(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>SnapTones</DialogTitle>
        </DialogHeader>
        {accepts ? null : (
          <p className="text-sm text-muted-foreground">
            Bluetooth cannot send a SnapTone file. Connect with USB.
          </p>
        )}
        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {factory.map((row) => (
            <div key={row.index} className="flex items-center justify-between gap-3 px-1 py-1 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <SlotIndex index={row.index} />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Factory</span>
            </div>
          ))}
          {snapshot.userSnapSlots.map((entry, index) => {
            const protocol = 50 + index;
            const label = slotLabel(entry.name, protocol);
            return (
              <div
                key={protocol}
                className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm"
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
                <span className="flex min-w-0 items-center gap-2">
                  <SlotIndex index={protocol} />
                  <span className="truncate">{label}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!accepts || busy}
                  onClick={() => {
                    slotRef.current = protocol;
                    fileRef.current?.click();
                  }}
                >
                  <Upload className="size-3.5" />
                  Upload NAM
                </Button>
              </div>
            );
          })}
        </div>
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
        {draft ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm">
              {draft.inspection.kind === "A2"
                ? `A2${draft.inspection.version ? ` · ${draft.inspection.version}` : ""}${draft.inspection.name ? ` · ${draft.inspection.name}` : ""}`
                : draft.inspection.reason}
            </p>
            {draft.inspection.kind === "A2" ? (
              <Input
                aria-label="SnapTone name"
                value={draft.name}
                maxLength={10}
                disabled={busy}
                onChange={(event) => {
                  const name = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
                  setDraft((current) => (current ? { ...current, name } : current));
                }}
              />
            ) : null}
            {draft.message ? <p className="text-sm">{draft.message}</p> : null}
          </div>
        ) : null}
        {asking && draft ? (
          <p className="text-sm">
            {asked?.name
              ? `Replace SnapTone ${draft.slot}, ${asked.name}?`
              : `Replace SnapTone ${draft.slot}?`}
          </p>
        ) : null}
        <DialogFooter>
          {busy ? (
            <Button type="button" variant="outline" onClick={cancelWork}>
              Cancel
            </Button>
          ) : null}
          {draft?.inspection.kind === "A2" && !busy ? (
            <Button type="button" onClick={() => void startSend()} disabled={!accepts}>
              {asking ? "Replace" : "Send"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
