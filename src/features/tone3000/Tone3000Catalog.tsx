import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import gpStudioLogoDark from "@/assets/img/gp-studio-logo-dark.png";
import gpStudioLogoLight from "@/assets/img/gp-studio-logo-light.png";
import t3kLogo from "@/assets/img/t3k-logo.png";
import tone3000Logo from "@/assets/img/tone3000-logo.png";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import type { DeviceSession, NamInspection, UserIrFile } from "@/device/session";
import { USER_SNAP_COUNT, USER_SNAP_FIRST } from "@/device/snaptone-table";
import {
  isUserIrNameChar,
  sanitizeUserIrName,
  USER_IR_FIRST,
  USER_IR_LAST,
  USER_IR_NAME_MAX,
} from "@/device/user-ir-table";
import {
  loadToneA2Models,
  loadToneIrModels,
  loadToneList,
  tone3000GearLabel,
  tone3000LicenseLabel,
  downloadModelFile,
  type A2Model,
  type A2ToneModels,
  type ToneListKind,
  type ToneListRow,
  type ToneTarget,
} from "@/features/tone3000/api";
import {
  completeTone3000SignIn,
  disconnectTone3000Account,
  getTone3000Account,
  subscribeTone3000Account,
} from "@/features/tone3000/account";
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
const UNKNOWN_IR_SLOT = "This IR slot is unknown until the IR list is read again.";
const PORT_ERROR = "The MIDI port cannot be written. Close Valeton Suite and try again.";
const EMPTY_LIST = "No tones in this list.";
const PAGE_SIZE = 20;
const LIST_KIND_KEY = "gpstudio.tone3000.listKind";
const LIST_GEAR_KEY = "gpstudio.tone3000.listGear";

type Draft = {
  fileName: string;
  file: ArrayBuffer;
  /** SnapTone target: the NAM inspection. Null for an IR. */
  inspection: NamInspection | null;
  /** IR target: the prepared 2048-byte block. Null for a SnapTone. */
  ir: UserIrFile | null;
  name: string;
  phase: "ready" | "converting" | "sending" | "error";
  message: string;
};

type ListedTone = Extract<A2ToneModels, { ok: true }>;

type GearFilter = "all" | "amp" | "amp-cab";

const DISCOVER_LABELS: { kind: ToneListKind; label: string }[] = [
  { kind: "trending", label: "Trending" },
];

const MY_LABELS: { kind: ToneListKind; label: string }[] = [
  { kind: "favorites", label: "Favorites" },
  { kind: "downloaded", label: "Downloaded" },
  { kind: "created", label: "Created" },
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
    if (stored === "latest") {
      return "trending";
    }
    if (isToneListKind(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to Favorites.
  }
  return "favorites";
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

function NamListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="min-h-0 flex-1 divide-y divide-foreground/10 overflow-hidden" aria-busy="true" aria-label="Loading models">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 px-3 py-2">
          <Skeleton className="h-4 w-2/3 max-w-64" />
          <Skeleton className="h-3 w-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function downloadName(fileName: string, extension: ".nam" | ".wav"): string {
  return fileName.toLowerCase().endsWith(extension) ? fileName : `${fileName}${extension}`;
}

function irTypedName(value: string): string {
  return [...value.replace(/\.wav$/i, "")].filter(isUserIrNameChar).join("").slice(0, USER_IR_NAME_MAX);
}

function irSlotLabel(
  slot: number,
  entry: { name: string | null; flag: number | null } | undefined,
  dumped: string | null | undefined,
): string {
  const padded = String(slot).padStart(2, "0");
  if (entry?.flag === 0) {
    return `${padded} · ${entry.name && entry.name.length > 0 ? entry.name : `User IR ${padded}`}`;
  }
  if (entry?.flag == null && dumped && !/^User IR \d+$/.test(dumped)) {
    return `${padded} · ${dumped}`;
  }
  return `${padded} · Empty`;
}

function customSlotLabel(
  protocol: number,
  entry: { name: string | null; flag: number | null } | undefined,
): string {
  const padded = String(protocol).padStart(2, "0");
  if (entry?.flag === 0) {
    return entry.name && entry.name.length > 0
      ? `${padded} · ${entry.name}`
      : `${padded} · SnapTone ${String(protocol)}`;
  }
  return `${padded} · Empty`;
}

function triggerFileDownload(fileName: string, bytes: ArrayBuffer): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(new Uint8Array(bytes));
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CreatorCredit({
  username,
  userUrl,
  avatarUrl,
}: {
  username: string;
  userUrl: string | null;
  avatarUrl: string | null;
}) {
  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      className="size-3.5 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-medium text-muted-foreground"
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
  const className = "inline-flex items-center gap-1 text-foreground/75 transition-colors hover:text-foreground";
  if (userUrl) {
    return (
      <a href={userUrl} target="_blank" rel="noopener" className={className}>
        {avatar}
        {username}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {avatar}
      {username}
    </span>
  );
}

function MetaSep() {
  return <span aria-hidden>·</span>;
}

export function Tone3000Catalog({
  open,
  onOpenChange,
  slot,
  session,
  onUploaded,
  target = "snaptone",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: number | null;
  session: DeviceSession;
  onUploaded: () => void;
  /** `ir`: list cabinet IRs (gear cab, format ir) and upload to a User IR slot 1–20. */
  target?: ToneTarget;
}) {
  const isIr = target === "ir";
  const loadModels = isIr ? loadToneIrModels : loadToneA2Models;
  const catalogGears = (filter: GearFilter) => (isIr ? "cab" : catalogGearsForFilter(filter));
  const account = useSyncExternalStore(
    subscribeTone3000Account,
    getTone3000Account,
    getTone3000Account,
  );
  const snapshot = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
  const [targetSlot, setTargetSlot] = useState<number | null>(slot);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [listKind, setListKind] = useState<ToneListKind>("trending");
  const [gear, setGear] = useState<GearFilter>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ToneListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listReady, setListReady] = useState(false);
  const [toneLoading, setToneLoading] = useState(false);
  const [tone, setTone] = useState<ListedTone | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveNamLocal, setSaveNamLocal] = useState(true);
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
    setTargetSlot(slot);
  }, [open, slot]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [account.status === "signed-in" ? account.avatarUrl : null]);

  function startSignInPopup(): void {
    setNotice("");
    setSigningIn(true);
    signingInRef.current = true;
    const held = peekTone3000Popup();
    const popup = held ?? openTone3000Popup();
    if (!popup) {
      setNotice("The TONE3000 window was blocked. Allow popups for GP Studio and try again.");
      return;
    }
    void beginAuthorize("sign-in")
      .then((next) => {
        if (!signingInRef.current) {
          return;
        }
        const current = takeTone3000Popup() ?? popup;
        if (current.closed) {
          setNotice("The TONE3000 window was closed.");
          return;
        }
        navigateTone3000Popup(current, next);
        popupRef.current = current;
      })
      .catch(() => {
        if (!signingInRef.current) {
          return;
        }
        closeTone3000Popup(takeTone3000Popup() ?? popup);
        setNotice("TONE3000 is not configured.");
      });
  }

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
    setPage(1);
    setRows([]);
    setTotalPages(1);
    setListReady(false);
    setListLoading(false);
    const needsSignIn = getTone3000Account().status !== "signed-in";
    setSigningIn(needsSignIn);
    signingInRef.current = needsSignIn;

    void (async () => {
      const access = await ensureAccessToken();
      if (cancelled) {
        return;
      }
      if (access) {
        closeTone3000Popup(takeTone3000Popup());
        await completeTone3000SignIn();
        if (!cancelled) {
          setSigningIn(false);
          signingInRef.current = false;
          setListReady(true);
        }
        return;
      }
      if (cancelled) {
        return;
      }
      startSignInPopup();
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
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      try {
        const loaded = await loadToneList(listKind, access, {
          page: listIsPaged(listKind) ? page : undefined,
          pageSize: listIsPaged(listKind) ? PAGE_SIZE : undefined,
          gear: !isIr && gear !== "all" ? gear : undefined,
          format: isIr ? "ir" : undefined,
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
  }, [open, listReady, listKind, gear, page, browsing, tone, draft, signingIn, isIr]);

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
        setNotice("TONE3000 sign-in did not finish.");
        setSigningIn(false);
        signingInRef.current = false;
        setBrowsing(false);
        browsingRef.current = false;
        return;
      }
      const username = await completeTone3000SignIn();
      if (!username) {
        handledRef.current = false;
        setNotice("TONE3000 sign-in did not finish.");
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
          setNotice("The TONE3000 window was blocked. Allow popups for GP Studio and try again.");
          handledRef.current = false;
          return;
        }
        holdTone3000Popup(popup);
        try {
          const next = await beginAuthorize("catalog", window.sessionStorage, window.location.origin, {
            gears: catalogGears(gearRef.current),
          });
          if (popup.closed) {
            setBrowsing(false);
            browsingRef.current = false;
            setNotice("The TONE3000 window was closed.");
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
          setNotice("TONE3000 is not configured.");
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
        setNotice("TONE3000 sign-in did not finish.");
        handledRef.current = false;
        return;
      }
      try {
        const loaded = await loadModels(toneId, access);
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
    setTone({
      ok: true,
      title: row.title,
      gear: row.gear,
      format: isIr ? "IR" : "NAM",
      username: row.username,
      userUrl: null,
      userAvatarUrl: null,
      toneUrl: null,
      license: null,
      description: null,
      imageUrl: row.imageUrl,
      models: [],
    });
    setToneLoading(true);
    try {
      const access = await ensureAccessToken();
      if (!access) {
        setTone(null);
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      const loaded = await loadModels(row.id, access);
      if (!loaded.ok) {
        setTone(null);
        setNotice(loaded.message);
        return;
      }
      setTone({ ...loaded, imageUrl: loaded.imageUrl ?? row.imageUrl });
    } catch (error) {
      setTone(null);
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
        setNotice("TONE3000 sign-in did not finish.");
        return;
      }
      const bytes = await downloadModelFile(model.modelUrl, access);
      setSaveNamLocal(true);
      if (isIr) {
        const ir = await session.prepareUserIr(bytes);
        setDraft({
          fileName: model.name,
          file: bytes,
          inspection: null,
          ir,
          name: irTypedName(model.name),
          phase: "ready",
          message: "",
        });
        return;
      }
      const inspection = await session.inspectNam(bytes);
      setDraft({
        fileName: model.name,
        file: bytes,
        inspection,
        ir: null,
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

  async function startIrSend(): Promise<void> {
    if (!draft?.ir || targetSlot === null || draft.phase === "sending") {
      return;
    }
    const uploadSlot = targetSlot;
    const generation = previewRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const name = sanitizeUserIrName(draft.name);
    if (saveNamLocal) {
      triggerFileDownload(downloadName(draft.fileName, ".wav"), draft.file);
    }
    realProgress.current = 0;
    setConvertProgress(0);
    setShownProgress(0);
    setDraft({ ...draft, name, phase: "sending", message: "Uploading the IR to the Multi-Effects…" });
    const result = await session.uploadUserIr(uploadSlot, name, draft.ir.data, controller.signal, (fraction) => {
      if (previewRef.current === generation) {
        realProgress.current = fraction;
        setConvertProgress(fraction);
      }
    });
    if (previewRef.current !== generation) {
      return;
    }
    if (result.ok) {
      toast.success(`${result.name} uploaded into User IR ${String(uploadSlot).padStart(2, "0")}.`);
      setDraft(null);
      onUploaded();
      return;
    }
    if ((result.reason === "cancelled" || result.reason === "closed") && result.sent) {
      setDraft((current) => (current ? { ...current, phase: "error", message: UNKNOWN_IR_SLOT } : current));
      return;
    }
    if (result.reason === "cancelled") {
      return;
    }
    const message =
      result.reason === "port"
        ? PORT_ERROR
        : result.reason === "link"
          ? "Bluetooth cannot send an IR file. Connect with USB."
          : result.reason === "busy"
            ? "The pedal is busy."
            : "The IR was not stored under the submitted name.";
    setDraft((current) => (current ? { ...current, phase: "error", message } : current));
  }

  async function startSend(): Promise<void> {
    if (isIr) {
      await startIrSend();
      return;
    }
    if (
      !draft ||
      draft.inspection?.kind !== "A2" ||
      targetSlot === null ||
      draft.phase === "converting" ||
      draft.phase === "sending"
    ) {
      return;
    }
    const uploadSlot = targetSlot;
    const generation = previewRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const name = snapName(draft.name);
    if (saveNamLocal) {
      triggerFileDownload(downloadName(draft.fileName, ".nam"), draft.file);
    }
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
      const result = await session.uploadUserSnapTone(uploadSlot, name, file, controller.signal);
      if (previewRef.current !== generation) {
        return;
      }
      if (result.ok) {
        toast.success(
          `${result.name} uploaded into the slot ${String(uploadSlot).padStart(2, "0")}.`,
        );
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
      setNotice("The TONE3000 window was blocked. Allow popups for GP Studio and try again.");
      return;
    }
    holdTone3000Popup(popup);
    setBrowsing(true);
    browsingRef.current = true;
    void beginAuthorize("catalog", window.sessionStorage, window.location.origin, {
      gears: catalogGears(gear),
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
        setNotice("TONE3000 is not configured.");
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
  const draftReady = draft !== null && (isIr ? draft.ir !== null : draft.inspection?.kind === "A2");
  const showModels = draft === null && tone !== null;
  const showLists = draft === null && tone === null && listReady && !signingIn;
  const showPartnership =
    draft === null &&
    tone === null &&
    !browsing &&
    !listReady &&
    (signingIn || Boolean(notice));
  const wide = showModels || showLists;
  const licenseLabel = tone ? tone3000LicenseLabel(tone.license) : null;

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
        className={
          wide
            ? "flex h-[min(85vh,52rem)] max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl"
            : "max-h-[85vh] grid-cols-1 overflow-hidden sm:max-w-lg"
        }
      >
        {showPartnership ? (
          <DialogHeader>
            <DialogTitle className="sr-only">Connect with TONE3000</DialogTitle>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 pr-10">
              <DialogTitle className="flex items-center">
                <img
                  src={tone3000Logo}
                  alt="TONE3000"
                  className="h-5 w-auto"
                />
              </DialogTitle>
              {account.status === "signed-in" ? (
                <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 px-1.5 font-normal"
                      aria-label={`TONE3000 account ${account.username}`}
                      aria-expanded={accountMenuOpen}
                    >
                      {account.avatarUrl && !avatarBroken ? (
                        <img
                          src={account.avatarUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-6 shrink-0 rounded-full object-cover"
                          onError={() => {
                            setAvatarBroken(true);
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                        >
                          {account.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="max-w-36 truncate">{account.username}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 gap-0.5 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-full justify-start gap-2 px-2 font-normal"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        disconnectTone3000Account();
                        onOpenChange(false);
                      }}
                    >
                      <LogOut className="size-3.5 shrink-0 text-muted-foreground" />
                      Logout from TONE3000
                    </Button>
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          </DialogHeader>
        )}
        {tone && draft ? (
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
                {[tone3000GearLabel(tone.gear), tone.format, tone.username]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ) : null}
        {showPartnership ? (
          <div className="flex flex-col items-center gap-6 px-2 py-4 text-center sm:px-4">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <span className="inline-flex items-center">
                <img
                  src={gpStudioLogoLight}
                  alt="GP Studio"
                  className="h-4 w-auto dark:hidden"
                />
                <img
                  src={gpStudioLogoDark}
                  alt="GP Studio"
                  className="hidden h-4 w-auto dark:block"
                />
              </span>
              <span className="text-lg font-light text-muted-foreground" aria-hidden>
                +
              </span>
              <img
                src={tone3000Logo}
                alt="TONE3000"
                className="h-5 w-auto"
              />
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              GP Studio connects to TONE3000, a massive library of Neural Amp
              Modeler (NAM) captures and IRs of real gear, created by a global
              community of musicians.
            </p>
            {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
            <Button
              type="button"
              className="min-w-40"
              onClick={() => {
                startSignInPopup();
              }}
            >
              Continue…
            </Button>
          </div>
        ) : null}
        {showLists ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-[34px] gap-2 bg-black px-3.5 text-white hover:bg-black hover:text-white dark:bg-black dark:text-white dark:hover:bg-black dark:hover:text-white"
                onClick={startBrowse}
                disabled={browsing}
                aria-label="Browse all TONE3000"
              >
                <span>Browse all</span>
                <img
                  src={t3kLogo}
                  alt="TONE3000"
                  className="h-3.5 w-auto"
                />
              </Button>
            </div>
            {browsing ? (
              <p className="text-sm text-muted-foreground">
                Choose a tone in the TONE3000 window. This page stays open.
              </p>
            ) : null}
            {!browsing && !isIr ? (
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
              </div>
            ) : null}
            {!browsing && listLoading ? <ToneListSkeleton /> : null}
            {!browsing && !listLoading && !notice && rows.length === 0 ? (
              <div className="flex min-h-80 flex-1 items-center justify-center rounded-md border border-foreground/15 bg-muted/20 px-6">
                <p className="text-center text-sm text-muted-foreground">{EMPTY_LIST}</p>
              </div>
            ) : null}
            {!browsing && !listLoading && rows.length > 0 ? (
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
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page <span className="font-bold text-foreground">{String(page)}</span>
                  {` of ${String(totalPages)}`}
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
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {showModels && tone ? (
          <div className="flex min-h-0 flex-1 flex-col px-1">
            <div className="mb-4 flex shrink-0 justify-end">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={backToLists}
              >
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
                Back to Tones
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-3">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {tone.imageUrl ? (
                  <img
                    src={tone.imageUrl}
                    alt=""
                    className="size-36 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="size-36 shrink-0 rounded-sm bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div>
                    <p className="text-xl font-semibold tracking-tight leading-snug">
                      {tone.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                      {tone3000GearLabel(tone.gear) ? (
                        <span>{tone3000GearLabel(tone.gear)}</span>
                      ) : null}
                      {tone.format ? (
                        <>
                          <MetaSep />
                          <span>{tone.format}</span>
                        </>
                      ) : null}
                      {tone.username ? (
                        <>
                          <MetaSep />
                          <CreatorCredit
                            username={tone.username}
                            userUrl={tone.userUrl}
                            avatarUrl={tone.userAvatarUrl}
                          />
                        </>
                      ) : null}
                      {tone.toneUrl ? (
                        <>
                          <MetaSep />
                          <a
                            href={tone.toneUrl}
                            target="_blank"
                            rel="noopener"
                            className="text-foreground/75 transition-colors hover:text-foreground"
                          >
                            View on TONE3000
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-7 mb-7 space-y-3">
                    <p className="text-sm font-medium">{isIr ? "Select an IR:" : "Select a Capture:"}</p>
                    {toneLoading ? (
                      <NamListSkeleton rows={4} />
                    ) : (
                      <div
                        className="max-h-[10.5rem] overflow-y-auto rounded-md border border-foreground/15 bg-muted/20 ring-1 ring-foreground/5"
                        role="listbox"
                        aria-label={isIr ? "Select an IR" : "Select a Capture"}
                      >
                        <div className="divide-y divide-foreground/10">
                          {tone.models.map((model) => (
                            <button
                              key={model.modelUrl}
                              type="button"
                              role="option"
                              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/70 active:bg-muted"
                              onClick={() => void choose(model)}
                            >
                              <span className="truncate font-medium">{model.name}</span>
                              <span className="shrink-0 rounded-sm bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground ring-1 ring-foreground/10">
                                {isIr ? "IR" : "NAM"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {tone.description ? (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Description:</p>
                      <p className="text-base leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {tone.description}
                      </p>
                    </div>
                  ) : null}
                  {licenseLabel ? (
                    <p className={tone.description ? "mt-3 text-sm" : "text-sm"}>
                      <span className="font-medium">License:</span>{" "}
                      <a
                        href="https://www.tone3000.com/guides/tone-sharing-guidelines#tone-sharing-policy"
                        target="_blank"
                        rel="noopener"
                        className="text-foreground/75 transition-colors hover:text-foreground"
                      >
                        {licenseLabel}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {draft === null && notice && !showPartnership ? (
          <p className="text-sm">{notice}</p>
        ) : null}
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
              <span className="text-sm text-muted-foreground">{isIr ? "IR" : "Capture"}</span>
              <span className="truncate text-sm">{draft.fileName}</span>
              <span className="self-start pt-1.5 text-sm text-muted-foreground">In Slot</span>
              <div className="min-w-0">
                <Select
                  value={targetSlot === null ? undefined : String(targetSlot)}
                  onValueChange={(next) => {
                    const protocol = Number(next);
                    if (Number.isInteger(protocol)) {
                      setTargetSlot(protocol);
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={isIr ? "IR slot" : "SnapTone slot"}
                    className="h-8 w-full min-w-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    {isIr
                      ? Array.from({ length: USER_IR_LAST - USER_IR_FIRST + 1 }, (_, index) => {
                          const irSlot = USER_IR_FIRST + index;
                          return (
                            <SelectItem key={irSlot} value={String(irSlot)}>
                              {snapshot.status === "connected"
                                ? irSlotLabel(irSlot, snapshot.userIrSlots[index], snapshot.userIrNames[index])
                                : irSlotLabel(irSlot, undefined, null)}
                            </SelectItem>
                          );
                        })
                      : null}
                    {isIr ? null : Array.from({ length: USER_SNAP_COUNT }, (_, index) => {
                      const protocol = USER_SNAP_FIRST + index;
                      const entry =
                        snapshot.status === "connected"
                          ? snapshot.userSnapSlots[index]
                          : undefined;
                      return (
                        <SelectItem key={protocol} value={String(protocol)}>
                          {customSlotLabel(protocol, entry)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {(() => {
                  if (targetSlot === null || snapshot.status !== "connected") {
                    return null;
                  }
                  if (isIr) {
                    const irEntry = snapshot.userIrSlots[targetSlot - USER_IR_FIRST];
                    const label = irSlotLabel(targetSlot, irEntry, snapshot.userIrNames[targetSlot - USER_IR_FIRST]);
                    const occupiedName = label.split(" · ")[1];
                    if (!occupiedName || occupiedName === "Empty") {
                      return null;
                    }
                    return (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                        {`${occupiedName} will be overwritten`}
                      </p>
                    );
                  }
                  const entry = snapshot.userSnapSlots[targetSlot - USER_SNAP_FIRST];
                  if (entry?.flag !== 0) {
                    return null;
                  }
                  const overwritten =
                    entry.name && entry.name.length > 0
                      ? entry.name
                      : `SnapTone ${String(targetSlot)}`;
                  return (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      {`${overwritten} will be overwritten`}
                    </p>
                  );
                })()}
              </div>
              <span className="text-sm text-muted-foreground">As</span>
              <Input
                aria-label={isIr ? "IR name" : "SnapTone name"}
                value={draft.name}
                maxLength={10}
                className="rounded-sm"
                disabled={!draftReady}
                onChange={(event) => {
                  const name = isIr
                    ? irTypedName(event.target.value)
                    : event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
                  setDraft((current) => (current ? { ...current, name } : current));
                }}
              />
            </div>
            <label className="mt-2 grid cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
              <span />
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={saveNamLocal}
                  onCheckedChange={(checked) => {
                    setSaveNamLocal(checked === true);
                  }}
                />
                {isIr ? "Also save .wav file to this computer" : "Also save .nam file to this computer"}
              </span>
            </label>
            {draft.inspection && draft.inspection.kind !== "A2" ? (
              <p className="text-sm">{draft.inspection.reason}</p>
            ) : null}
            {draft.ir?.audibleCut ? (
              <p className="text-xs text-muted-foreground">
                The pedal uses the first 11.6 ms of each IR, like Valeton Suite. This file has some sound after that,
                which is left out.
              </p>
            ) : null}
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
              disabled={busy || !draftReady}
            >
              Confirm
            </Button>
          </DialogFooter>
        ) : (
          <p className="mt-auto -mb-1 border-t border-foreground/10 pt-1.5 text-center text-[11px] leading-none text-muted-foreground">
            Powered by{" "}
            <a
              href="https://www.tone3000.com"
              target="_blank"
              rel="noopener"
              className="text-foreground/75 transition-colors hover:text-foreground"
            >
              TONE3000
            </a>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
