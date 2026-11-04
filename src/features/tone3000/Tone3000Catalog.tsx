import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import type { DeviceSession, NamInspection } from "@/device/session";
import {
  loadToneA2Models,
  loadToneList,
  tone3000GearLabel,
  downloadModelFile,
  type A2Model,
  type A2ToneModels,
  type ToneListGear,
  type ToneListKind,
  type ToneListRow,
} from "@/features/tone3000/api";
import { completeTone3000SignIn } from "@/features/tone3000/account";
import { acceptOAuthState, catalogGearsForFilter } from "@/features/tone3000/oauth";
import {
  closeTone3000Popup,
  holdTone3000Popup,
  navigateTone3000Popup,
  openTone3000Popup,
  peekTone3000Popup,
  takeTone3000Popup,
} from "@/features/tone3000/popup";
import { setOAuthReturnHandler, type OAuthReturnFields } from "@/features/tone3000/return";
import {
  STATE_KEY,
  beginAuthorize,
  ensureAccessToken,
  exchangeAuthorizationCode,
} from "@/features/tone3000/tokens";

const UNKNOWN_SLOT = "This slot is unknown until SnapTone names are read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";
const EMPTY_LIST = "No tones in this list.";
const PAGE_SIZE = 20;
const LIST_KIND_KEY = "gpstudio.tone3000.listKind";
const LIST_GEAR_KEY = "gpstudio.tone3000.listGear";

type Draft = {
  fileName: string;
  file: ArrayBuffer;
  inspection: NamInspection;
  name: string;
  phase: "ready" | "converting" | "sending" | "error";
  message: string;
};

type ListedTone = Extract<A2ToneModels, { ok: true }>;

type GearFilter = "all" | ToneListGear;

const DISCOVER_LABELS: { kind: ToneListKind; label: string }[] = [
  { kind: "trending", label: "Trending" },
  { kind: "latest", label: "Latest" },
];

const MY_LABELS: { kind: ToneListKind; label: string }[] = [
  { kind: "favorites", label: "Favorites" },
  { kind: "downloaded", label: "Downloaded" },
  { kind: "created", label: "Uploaded" },
];

function isToneListKind(value: string | null): value is ToneListKind {
  return (
    value === "trending" ||
    value === "latest" ||
    value === "favorites" ||
    value === "downloaded" ||
    value === "created"
  );
}

function readStoredListKind(): ToneListKind {
  try {
    const stored = window.localStorage.getItem(LIST_KIND_KEY);
    if (isToneListKind(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to Trending.
  }
  return "trending";
}

function writeStoredListKind(kind: ToneListKind): void {
  try {
    window.localStorage.setItem(LIST_KIND_KEY, kind);
  } catch {
    // Ignore storage failures.
  }
}

function isGearFilter(value: string | null): value is GearFilter {
  return value === "all" || value === "amp" || value === "amp-cab";
}

function readStoredGear(): GearFilter {
  try {
    const stored = window.localStorage.getItem(LIST_GEAR_KEY);
    if (isGearFilter(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to All.
  }
  return "all";
}

function writeStoredGear(gear: GearFilter): void {
  try {
    window.localStorage.setItem(LIST_GEAR_KEY, gear);
  } catch {
    // Ignore storage failures.
  }
}

function snapName(value: string): string {
  const cut = value.replaceAll(".nam", "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return cut === "" ? "X" : cut;
}

function listAcceptsQuery(kind: ToneListKind): boolean {
  return kind === "favorites" || kind === "created" || kind === "downloaded";
}

function listIsPaged(kind: ToneListKind): boolean {
  return kind === "favorites" || kind === "created" || kind === "downloaded";
}

function ToneListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 divide-y divide-foreground/10 overflow-hidden" aria-busy="true" aria-label="Loading tones">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-1 py-2">
          <Skeleton className="size-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 max-w-56" />
            <Skeleton className="h-3 w-1/2 max-w-40" />
          </div>
        </div>
      ))}
    </div>
  );
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
  const [signingIn, setSigningIn] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [listKind, setListKind] = useState<ToneListKind>("trending");
  const [gear, setGear] = useState<GearFilter>("all");
  const [titleQuery, setTitleQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ToneListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listReady, setListReady] = useState(false);
  const [toneLoading, setToneLoading] = useState(false);
  const [tone, setTone] = useState<ListedTone | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);
  const [shownProgress, setShownProgress] = useState(0);
  const realProgress = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef(0);
  const handledRef = useRef(false);
  const popupRef = useRef<Window | null>(null);
  const browsingRef = useRef(false);
  const signingInRef = useRef(false);
  const gearRef = useRef<GearFilter>(gear);
  const acceptRef = useRef<(payload: OAuthReturnFields) => void>(() => {});
  const listRequestRef = useRef(0);

  browsingRef.current = browsing;
  signingInRef.current = signingIn;
  gearRef.current = gear;

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
    const timer = window.setTimeout(() => {
      setDebouncedQuery(titleQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [titleQuery]);

  useEffect(() => {
    if (!open || slot === null) {
      return;
    }
    let cancelled = false;
    handledRef.current = false;
    setTone(null);
    setToneLoading(false);
    setNotice("");
    setDraft(null);
    setBrowsing(false);
    browsingRef.current = false;
    setListKind(readStoredListKind());
    setGear(readStoredGear());
    setTitleQuery("");
    setDebouncedQuery("");
    setPage(1);
    setRows([]);
    setTotalPages(1);
    setListReady(false);
    setListLoading(false);
    setSigningIn(false);
    signingInRef.current = false;

    void (async () => {
      const access = await ensureAccessToken();
      if (cancelled) {
        return;
      }
      if (access) {
        closeTone3000Popup(takeTone3000Popup());
        await completeTone3000SignIn();
        if (!cancelled) {
          setListReady(true);
        }
        return;
      }
      setSigningIn(true);
      signingInRef.current = true;
      const held = peekTone3000Popup();
      const popup = held ?? openTone3000Popup();
      if (!popup) {
        setNotice("The Tone3000 window was blocked. Allow popups for GP Studio and try again.");
        setSigningIn(false);
        signingInRef.current = false;
        return;
      }
      void beginAuthorize("sign-in")
        .then((next) => {
          if (cancelled) {
            return;
          }
          const current = takeTone3000Popup() ?? popup;
          if (current.closed) {
            setNotice("The Tone3000 window was closed.");
            setSigningIn(false);
            signingInRef.current = false;
            return;
          }
          navigateTone3000Popup(current, next);
          popupRef.current = current;
        })
        .catch(() => {
          if (!cancelled) {
            closeTone3000Popup(takeTone3000Popup() ?? popup);
            setNotice("Tone3000 is not configured.");
            setSigningIn(false);
            signingInRef.current = false;
          }
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, slot]);

  useEffect(() => {
    if (!open || !listReady || browsing || tone || draft || signingIn) {
      return;
    }
    let cancelled = false;
    const requestId = ++listRequestRef.current;
    setListLoading(true);
    setNotice("");
    void (async () => {
      const access = await ensureAccessToken();
      if (cancelled || requestId !== listRequestRef.current) {
        return;
      }
      if (!access) {
        setListLoading(false);
        setListReady(false);
        setSigningIn(true);
        signingInRef.current = true;
        setNotice("Tone3000 sign-in did not finish.");
        return;
      }
      try {
        const loaded = await loadToneList(listKind, access, {
          page: listIsPaged(listKind) ? page : undefined,
          pageSize: listIsPaged(listKind) ? PAGE_SIZE : undefined,
          gear: gear !== "all" ? gear : undefined,
          query: listAcceptsQuery(listKind) && debouncedQuery ? debouncedQuery : undefined,
        });
        if (cancelled || requestId !== listRequestRef.current) {
          return;
        }
        setRows(loaded.rows);
        setTotalPages(listIsPaged(listKind) ? loaded.totalPages : 1);
        setListLoading(false);
      } catch (error) {
        if (cancelled || requestId !== listRequestRef.current) {
          return;
        }
        setRows([]);
        setTotalPages(1);
        setListLoading(false);
        setNotice(error instanceof Error ? error.message : "The tone list could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, listReady, listKind, gear, debouncedQuery, page, browsing, tone, draft, signingIn]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setOAuthReturnHandler((payload) => {
      acceptRef.current(payload);
    });
    return () => setOAuthReturnHandler(null);
  }, [open]);

  useEffect(() => {
    if (!browsing) {
      return;
    }
    const timer = window.setInterval(() => {
      const popup = popupRef.current;
      if (!popup || !popup.closed) {
        return;
      }
      popupRef.current = null;
      setBrowsing(false);
      browsingRef.current = false;
      handledRef.current = false;
    }, 400);
    return () => window.clearInterval(timer);
  }, [browsing]);

  acceptRef.current = (payload) => {
    if (!open || slot === null || handledRef.current) {
      return;
    }
    if (!acceptOAuthState(payload.state, sessionStorage.getItem(STATE_KEY)) || !payload.code) {
      return;
    }
    handledRef.current = true;
    const toneId = payload.tone_id;
    const wasSigningIn = signingInRef.current;
    const wasBrowsing = browsingRef.current;
    setNotice("");
    void (async () => {
      const exchanged = await exchangeAuthorizationCode(payload.code ?? "");
      if (!exchanged) {
        handledRef.current = false;
        setNotice("Tone3000 sign-in did not finish.");
        setSigningIn(false);
        signingInRef.current = false;
        setBrowsing(false);
        browsingRef.current = false;
        return;
      }
      const username = await completeTone3000SignIn();
      if (!username) {
        handledRef.current = false;
        setNotice("Tone3000 sign-in did not finish.");
        setSigningIn(false);
        signingInRef.current = false;
        setBrowsing(false);
        browsingRef.current = false;
        return;
      }
      closeTone3000Popup(popupRef.current);
      popupRef.current = null;
      closeTone3000Popup(takeTone3000Popup());

      if (wasSigningIn && !wasBrowsing) {
        setSigningIn(false);
        signingInRef.current = false;
        setListKind(readStoredListKind());
        setGear(readStoredGear());
        setTitleQuery("");
        setDebouncedQuery("");
        setPage(1);
        setListReady(true);
        handledRef.current = false;
        return;
      }

      if (wasBrowsing && !toneId) {
        const popup = openTone3000Popup();
        if (!popup) {
          setBrowsing(false);
          browsingRef.current = false;
          setNotice("The Tone3000 window was blocked. Allow popups for GP Studio and try again.");
          handledRef.current = false;
          return;
        }
        holdTone3000Popup(popup);
        try {
          const next = await beginAuthorize("catalog", window.sessionStorage, window.location.origin, {
            gears: catalogGearsForFilter(gearRef.current),
          });
          if (popup.closed) {
            setBrowsing(false);
            browsingRef.current = false;
            setNotice("The Tone3000 window was closed.");
            handledRef.current = false;
            return;
          }
          navigateTone3000Popup(popup, next);
          popupRef.current = popup;
          handledRef.current = false;
        } catch {
          closeTone3000Popup(popup);
          setBrowsing(false);
          browsingRef.current = false;
          setNotice("Tone3000 is not configured.");
          handledRef.current = false;
        }
        return;
      }

      if (!toneId) {
        handledRef.current = false;
        setBrowsing(false);
        browsingRef.current = false;
        setListReady(true);
        return;
      }

      const access = await ensureAccessToken();
      if (!access) {
        setNotice("Tone3000 sign-in did not finish.");
        handledRef.current = false;
        return;
      }
      try {
        const loaded = await loadToneA2Models(toneId, access);
        setBrowsing(false);
        browsingRef.current = false;
        if (!loaded.ok) {
          setTone(null);
          setNotice(loaded.message);
          handledRef.current = false;
          return;
        }
          setTone({ ...loaded, imageUrl: loaded.imageUrl ?? null });
        handledRef.current = false;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "The tone could not be loaded.");
        handledRef.current = false;
      }
    })();
  };

  async function chooseTone(row: ToneListRow): Promise<void> {
    if (slot === null || toneLoading) {
      return;
    }
    setNotice("");
    setToneLoading(true);
    try {
      const access = await ensureAccessToken();
      if (!access) {
        setNotice("Tone3000 sign-in did not finish.");
        return;
      }
      const loaded = await loadToneA2Models(row.id, access);
      if (!loaded.ok) {
        setTone(null);
        setNotice(loaded.message);
        return;
      }
      setTone({ ...loaded, imageUrl: loaded.imageUrl ?? row.imageUrl });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The tone could not be loaded.");
    } finally {
      setToneLoading(false);
    }
  }

  async function choose(model: A2Model): Promise<void> {
    if (slot === null) {
      return;
    }
    setNotice("");
    try {
      const access = await ensureAccessToken();
      if (!access) {
        setNotice("Tone3000 sign-in did not finish.");
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

  function selectList(kind: ToneListKind): void {
    setListKind(kind);
    writeStoredListKind(kind);
    setPage(1);
    if (!listAcceptsQuery(kind)) {
      setTitleQuery("");
      setDebouncedQuery("");
    }
    setNotice("");
  }

  function selectGear(next: GearFilter): void {
    setGear(next);
    writeStoredGear(next);
    setPage(1);
    setNotice("");
  }

  function startBrowse(): void {
    setNotice("");
    setTone(null);
    const popup = openTone3000Popup();
    if (!popup) {
      setNotice("The Tone3000 window was blocked. Allow popups for GP Studio and try again.");
      return;
    }
    holdTone3000Popup(popup);
    setBrowsing(true);
    browsingRef.current = true;
    void beginAuthorize("catalog", window.sessionStorage, window.location.origin, {
      gears: catalogGearsForFilter(gear),
    })
      .then((next) => {
        if (popup.closed) {
          setBrowsing(false);
          browsingRef.current = false;
          return;
        }
        navigateTone3000Popup(popup, next);
        popupRef.current = popup;
      })
      .catch(() => {
        closeTone3000Popup(popup);
        setBrowsing(false);
        browsingRef.current = false;
        setNotice("Tone3000 is not configured.");
      });
  }

  function backToLists(): void {
    setTone(null);
    setToneLoading(false);
    setNotice("");
    setBrowsing(false);
    browsingRef.current = false;
  }

  function closeModal(): void {
    previewRef.current += 1;
    abortRef.current?.abort();
    setDraft(null);
    setTone(null);
    setToneLoading(false);
    setNotice("");
    setBrowsing(false);
    browsingRef.current = false;
    setSigningIn(false);
    signingInRef.current = false;
    setListReady(false);
    closeTone3000Popup(popupRef.current);
    popupRef.current = null;
    closeTone3000Popup(takeTone3000Popup());
  }

  const busy = draft?.phase === "converting" || draft?.phase === "sending";
  const showModels = draft === null && tone !== null;
  const showLists = draft === null && tone === null && listReady && !signingIn;
  const wide = showModels || showLists;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && draft?.phase === "sending") {
          return;
        }
        if (!next) {
          closeModal();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={draft?.phase !== "sending"}
        closeAction="back"
        className={
          wide
            ? "flex h-[min(85vh,52rem)] max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl"
            : "max-h-[85vh] overflow-hidden sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-2">
            <span>Tone3000</span>
            {slot !== null ? (
              <>
                <span className="font-normal text-muted-foreground" aria-hidden>
                  →
                </span>
                <span className="font-normal text-muted-foreground">{`SnapTone ${String(slot).padStart(2, "0")}`}</span>
              </>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        {tone ? (
          <div className="flex items-center gap-3 border-b border-foreground/10 px-1 py-2">
            {tone.imageUrl ? (
              <img
                src={tone.imageUrl}
                alt=""
                className="size-10 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <span className="size-10 shrink-0 rounded-sm bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{tone.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[tone3000GearLabel(tone.gear), tone.format, tone.username].filter(Boolean).join(" · ")}
              </p>
            </div>
            {showModels ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-3.5"
                onClick={backToLists}
              >
                <ChevronLeft className="size-3.5 -translate-y-px" />
                Back
              </Button>
            ) : null}
          </div>
        ) : null}
        {signingIn && !notice ? (
          <p className="text-sm text-muted-foreground">
            Finish signing in in the Tone3000 window. This page stays open.
          </p>
        ) : null}
        {showLists ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-orange-700 px-3.5 text-white hover:bg-orange-800 hover:text-white dark:bg-orange-700 dark:hover:bg-orange-600"
                  onClick={startBrowse}
                  disabled={browsing}
                >
                  Search All
                </Button>
                {DISCOVER_LABELS.map((entry) => (
                  <Button
                    key={entry.kind}
                    type="button"
                    size="sm"
                    variant={listKind === entry.kind ? "default" : "outline"}
                    className="h-8 px-3.5"
                    onClick={() => selectList(entry.kind)}
                    disabled={browsing}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {MY_LABELS.map((entry) => (
                  <Button
                    key={entry.kind}
                    type="button"
                    size="sm"
                    variant={listKind === entry.kind ? "default" : "outline"}
                    className="h-8 px-3.5"
                    onClick={() => selectList(entry.kind)}
                    disabled={browsing}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
            </div>
            {browsing ? (
              <p className="text-sm text-muted-foreground">
                Choose a tone in the Tone3000 window. This page stays open.
              </p>
            ) : null}
            {!browsing ? (
              <div className="flex flex-wrap items-center gap-2">
                <ButtonGroup aria-label="Gear filter">
                  {(
                    [
                      ["all", "All"],
                      ["amp", "Amp"],
                      ["amp-cab", "Amp + Cab"],
                    ] as const
                  ).map(([value, label]) => {
                    const selected = gear === value;
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
                        onClick={() => selectGear(value)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </ButtonGroup>
                {listAcceptsQuery(listKind) ? (
                  <Input
                    aria-label="Search titles"
                    placeholder="Search titles"
                    value={titleQuery}
                    className="h-7 max-w-xs rounded-sm text-xs"
                    onChange={(event) => {
                      setTitleQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {!browsing && (listLoading || toneLoading) ? <ToneListSkeleton /> : null}
            {!browsing && !listLoading && !toneLoading && !notice && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{EMPTY_LIST}</p>
            ) : null}
            {!browsing && !listLoading && !toneLoading && rows.length > 0 ? (
              <div className="min-h-0 flex-1 divide-y divide-foreground/10 overflow-y-auto">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-3 px-1 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => void chooseTone(row)}
                  >
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <span className="size-10 shrink-0 rounded-sm bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[tone3000GearLabel(row.gear), row.format, row.username].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {!browsing && listIsPaged(listKind) && !listLoading && totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {`Page ${String(page)} of ${String(totalPages)}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {showModels && tone ? (
          <div className="min-h-0 flex-1 divide-y divide-foreground/10 overflow-y-auto">
            {tone.models.map((model) => (
              <button
                key={model.modelUrl}
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => void choose(model)}
              >
                <span className="truncate">{model.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">NAM</span>
              </button>
            ))}
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
