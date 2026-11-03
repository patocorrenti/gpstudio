import { useEffect, useRef, useState } from "react";
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
import type { DeviceSession, NamInspection } from "@/device/session";
import {
  loadToneA2Models,
  tone3000GearLabel,
  downloadModelFile,
  type A2Model,
  type A2ToneModels,
} from "@/features/tone3000/api";
import { completeTone3000SignIn } from "@/features/tone3000/account";
import { acceptOAuthState } from "@/features/tone3000/oauth";
import { setOAuthReturnHandler, type OAuthReturnFields } from "@/features/tone3000/return";
import {
  STATE_KEY,
  beginAuthorize,
  ensureAccessToken,
  exchangeAuthorizationCode,
} from "@/features/tone3000/tokens";

const UNKNOWN_SLOT = "This slot is unknown until SnapTone names are read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";

type Draft = {
  fileName: string;
  file: ArrayBuffer;
  inspection: NamInspection;
  name: string;
  phase: "ready" | "converting" | "sending" | "error";
  message: string;
};

type ListedTone = Extract<A2ToneModels, { ok: true }>;

function snapName(value: string): string {
  const cut = value.replaceAll(".nam", "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return cut === "" ? "X" : cut;
}

export function Tone3000Catalog({
  open,
  onOpenChange,
  slot,
  existingName,
  session,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: number | null;
  existingName: string | null;
  session: DeviceSession;
  onUploaded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<ListedTone | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [shownProgress, setShownProgress] = useState(0);
  const realProgress = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef(0);
  const handledRef = useRef(false);
  const acceptRef = useRef<(payload: OAuthReturnFields) => void>(() => {});

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
    if (!open || slot === null) {
      return;
    }
    let cancelled = false;
    handledRef.current = false;
    setTone(null);
    setNotice("");
    setDraft(null);
    setUrl("");
    void beginAuthorize("catalog")
      .then((next) => {
        if (!cancelled) {
          setUrl(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice("TONE3000 is not configured.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, slot]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setOAuthReturnHandler((payload) => {
      acceptRef.current(payload);
    });
    return () => setOAuthReturnHandler(null);
  }, [open]);

  acceptRef.current = (payload) => {
    if (!open || slot === null || handledRef.current) {
      return;
    }
    if (!acceptOAuthState(payload.state, sessionStorage.getItem(STATE_KEY)) || !payload.code || !payload.tone_id) {
      return;
    }
    handledRef.current = true;
    const toneId = payload.tone_id;
    setNotice("");
    setUrl("");
    void (async () => {
      const exchanged = await exchangeAuthorizationCode(payload.code ?? "");
      if (!exchanged) {
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      await completeTone3000SignIn();
      const access = await ensureAccessToken();
      if (!access) {
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      try {
        const loaded = await loadToneA2Models(toneId, access);
        if (!loaded.ok) {
          setTone(null);
          setNotice(loaded.message);
          return;
        }
        setTone(loaded);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "The tone could not be loaded.");
      }
    })();
  };

  async function choose(model: A2Model): Promise<void> {
    if (slot === null) {
      return;
    }
    setNotice("");
    try {
      const access = await ensureAccessToken();
      if (!access) {
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      const bytes = await downloadModelFile(model.modelUrl, access);
      const inspection = await session.inspectNam(bytes);
      setDraft({
        fileName: model.name,
        file: bytes,
        inspection,
        name: snapName(model.name),
        phase: "ready",
        message: "",
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The model could not be downloaded.");
    }
  }

  function leavePreview(): void {
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

  async function startSend(): Promise<void> {
    if (!draft || draft.inspection.kind !== "A2" || slot === null || draft.phase === "converting" || draft.phase === "sending") {
      return;
    }
    const generation = previewRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const name = snapName(draft.name);
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
        toast.success(`${result.name} uploaded into the slot ${String(slot).padStart(2, "0")}.`);
        setDraft(null);
        onUploaded();
        return;
      }
      if (result.reason === "cancelled" || controller.signal.aborted) {
        if (result.sent) {
          setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_SLOT } : current));
        }
        return;
      }
      if (result.reason === "port") {
        setDraft((current) => (current ? { ...current, phase: "error", message: PORT_ERROR } : current));
        return;
      }
      if (result.reason === "closed" && result.sent) {
        setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_SLOT } : current));
        return;
      }
      const message =
        result.reason === "link"
          ? "Bluetooth cannot send a SnapTone file. Connect with USB."
          : result.reason === "busy"
            ? "The pedal is busy."
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

  const busy = draft?.phase === "converting" || draft?.phase === "sending";
  const showCatalog = draft === null && !tone && !notice && url;
  const showModels = draft === null && tone !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && draft?.phase === "sending") {
          return;
        }
        if (!next) {
          previewRef.current += 1;
          abortRef.current?.abort();
          setDraft(null);
          setTone(null);
          setNotice("");
          setUrl("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={draft?.phase !== "sending"}
        className={
          showCatalog || showModels
            ? "flex h-[min(85vh,52rem)] max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl"
            : "max-h-[85vh] overflow-hidden sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>{slot === null ? "TONE3000" : `TONE3000 · ${String(slot).padStart(2, "0")}`}</DialogTitle>
        </DialogHeader>
        {draft === null && !tone && !notice && !url ? (
          <p className="text-sm text-muted-foreground">Opening TONE3000…</p>
        ) : null}
        {showCatalog ? (
          <iframe title="TONE3000" src={url} className="min-h-0 w-full flex-1 rounded-md border" />
        ) : null}
        {showModels && tone ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div>
              <p className="text-sm font-medium">{tone.title}</p>
              <p className="text-xs text-muted-foreground">
                {`${tone3000GearLabel(tone.gear)} · ${tone.format} · ${tone.username}`}
              </p>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-foreground/10 overflow-y-auto">
              {tone.models.map((model) => (
                <button
                  key={model.modelUrl}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => void choose(model)}
                >
                  <span className="truncate">{model.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">NAM</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {draft === null && notice ? <p className="text-sm">{notice}</p> : null}
        {draft && busy ? (
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
        {draft && !busy ? (
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <span className="text-sm text-muted-foreground">Upload</span>
              <span className="truncate text-sm">{draft.fileName}</span>
              <span className="text-sm text-muted-foreground">In Slot</span>
              <span className="min-w-0 text-sm">
                <span className="tabular-nums">{String(slot ?? 0).padStart(2, "0")}</span>
                {existingName ? (
                  <span className="ml-2.5 text-xs text-amber-600 dark:text-amber-400">
                    {`(${existingName} will be overwritten)`}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">As</span>
              <Input
                aria-label="SnapTone name"
                value={draft.name}
                maxLength={10}
                className="rounded-sm"
                disabled={draft.inspection.kind !== "A2"}
                onChange={(event) => {
                  const name = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
                  setDraft((current) => (current ? { ...current, name } : current));
                }}
              />
            </div>
            {draft.inspection.kind === "A2" ? null : <p className="text-sm">{draft.inspection.reason}</p>}
            {draft.message ? <p className="text-sm">{draft.message}</p> : null}
          </div>
        ) : null}
        {draft ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={leavePreview} disabled={draft.phase === "sending"}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void startSend()}
              disabled={busy || draft.inspection.kind !== "A2"}
            >
              Confirm
            </Button>
          </DialogFooter>
        ) : notice ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
