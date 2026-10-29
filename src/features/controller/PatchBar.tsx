import { ChevronLeft, ChevronRight, Copy, Download, Pencil, Play, Save, Settings2, Square, TriangleAlert, Upload, X } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { modelById } from "@/device/catalog";
import { userIrDisplayName } from "@/device/ir-names";
import { type DeviceModel } from "@/device/models";
import { userNsDisplayName } from "@/device/nam-names";
import {
  chainSlotLabel,
  type DeviceSession,
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
  type OmittedFactoryModel,
} from "@/device/session";
import abCompareIcon from "@/assets/img/icon-ab-compare.png";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { useAbCycleClaim } from "@/features/controller/AbCycleClaim";
import { AbSideLabel } from "@/features/controller/AbSideLabel";
import {
  AB_SECONDS_DEFAULT,
  AbSecondsField,
  resolveAbSeconds,
} from "@/features/controller/AbSecondsField";
import { PatchLevels } from "@/features/controller/PatchLevels";
import { PatchSelect } from "@/features/controller/PatchSelect";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import { toast } from "sonner";

/** Custom IR / SnapTone slots referenced by the working chain (slot only; no file bytes). */
type CustomAssetWarning = {
  irName: string | null;
  nsName: string | null;
};

function customAssetsForDownload(session: DeviceSession): CustomAssetWarning | null {
  const snapshot = session.getSnapshot();
  if (snapshot.status !== "connected") {
    return null;
  }
  let irName: string | null = null;
  let nsName: string | null = null;
  for (const slot of snapshot.chain) {
    if (slot.modelId === undefined) {
      continue;
    }
    const model = modelById(slot.modelId);
    if (!model) {
      continue;
    }
    if (model.userIrSlot !== undefined) {
      irName = userIrDisplayName(model, snapshot.userIrNames);
    }
    if (model.userNsSlot !== undefined) {
      nsName = userNsDisplayName(model, snapshot.userNsNames);
    }
  }
  if (irName === null && nsName === null) {
    return null;
  }
  return { irName, nsName };
}

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

const patchChipClass =
  "rounded-[4px] border-transparent bg-background hover:bg-[oklch(0.965_0.008_255)]! active:translate-y-0.5! dark:bg-muted/40 dark:hover:bg-[oklch(0.305_0.045_255)]!";
const patchActionClass = `${patchChipClass} px-3`;
const abPlayReadyClass =
  "rounded-[4px] border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900 active:translate-y-0.5! dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700 dark:hover:text-emerald-100 [&_svg]:text-emerald-800 hover:[&_svg]:text-emerald-900 dark:[&_svg]:text-emerald-200 dark:hover:[&_svg]:text-emerald-100";
const patchClusterEnterClass =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-300";
const patchActionIconClass = "size-3 text-muted-foreground";

const unsavedPatchHint = "Unsaved changes will be lost";

type AbCycle = {
  a: number;
  b: number;
  dwellMs: number;
  next: "a" | "b";
};

function nextComparisonPatch(patch: number): number {
  return (patch + 1) % PATCH_COUNT;
}

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
  patchVolume,
  patchBpm,
}: {
  patch: number;
  patchNames: (string | null)[];
  busy: boolean;
  canExportPatch: boolean;
  modified: boolean;
  model: DeviceModel;
  patchVolume: number | null;
  patchBpm: number | null;
}) {
  const session = useDeviceSession();
  const { moduleOpen, registerStop, stopOther } = useAbCycleClaim();
  const currentName = patchNames[patch];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateDest, setDuplicateDest] = useState(String((patch + 1) % PATCH_COUNT));
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    bytes: Uint8Array;
    omissions: OmittedFactoryModel[];
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadWarn, setDownloadWarn] = useState<CustomAssetWarning | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [abOpen, setAbOpen] = useState(false);
  const [abSecondsText, setAbSecondsText] = useState(String(AB_SECONDS_DEFAULT));
  const [abSideA, setAbSideA] = useState(0);
  const [abCompare, setAbCompare] = useState(0);
  const [abPlaying, setAbPlaying] = useState(false);
  const [abActive, setAbActive] = useState<"a" | "b" | null>(null);
  const [abCountdown, setAbCountdown] = useState<number | null>(null);
  const [dwellEpoch, setDwellEpoch] = useState(0);
  const cycleRef = useRef<AbCycle | null>(null);
  const playingRef = useRef(false);
  const mountedRef = useRef(true);
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

  function requestDownload() {
    const warning = customAssetsForDownload(session);
    if (warning) {
      setDownloadWarn(warning);
      return;
    }
    void downloadPatch();
  }

  function confirmDownload() {
    setDownloadWarn(null);
    void downloadPatch();
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
    const preview = session.previewUploadPatch(bytes);
    if (!preview.ok) {
      setPendingUpload(null);
      setUploadError("This file is not a valid Valeton preset.");
      return;
    }
    setUploadError(null);
    const crossModel = preview.fileModel !== model;
    if (crossModel || modified) {
      setPendingUpload({ bytes, omissions: preview.omissions });
      return;
    }
    uploadPatchBytes(bytes);
  }

  function confirmUpload() {
    if (!pendingUpload) {
      return;
    }
    const bytes = pendingUpload.bytes;
    setPendingUpload(null);
    uploadPatchBytes(bytes);
  }

  function resolvedAbSeconds(): number {
    return resolveAbSeconds(abSecondsText);
  }

  function openAbSetup() {
    abOpenRef.current = true;
    setOptionsOpen(false);
    setAbSecondsText(String(AB_SECONDS_DEFAULT));
    setAbSideA(patch);
    setAbCompare(nextComparisonPatch(patch));
    playingRef.current = false;
    cycleRef.current = null;
    setAbPlaying(false);
    setAbActive(null);
    setAbCountdown(null);
    setAbOpen(true);
  }

  function closeAbSetup() {
    stopRecallRef.current += 1;
    abOpenRef.current = false;
    playingRef.current = false;
    cycleRef.current = null;
    setAbPlaying(false);
    setAbActive(null);
    setAbCountdown(null);
    setAbOpen(false);
  }

  function stopAbCycle(recallA = true) {
    const slotA = cycleRef.current?.a;
    playingRef.current = false;
    cycleRef.current = null;
    setAbPlaying(false);
    setAbActive(null);
    setAbCountdown(null);
    if (!recallA || slotA === undefined) {
      return;
    }
    const ticket = stopRecallRef.current + 1;
    stopRecallRef.current = ticket;
    void (async () => {
      const snapshot = session.getSnapshot();
      if (snapshot.status !== "connected") {
        return;
      }
      if (snapshot.chainSync === "syncing") {
        try {
          await waitUntilChainIdle(session);
        } catch {
          return;
        }
      }
      if (
        stopRecallRef.current !== ticket ||
        playingRef.current ||
        !abOpenRef.current
      ) {
        return;
      }
      const after = session.getSnapshot();
      if (after.status === "connected" && after.patch !== slotA) {
        await recallPatch(slotA);
      }
    })();
  }

  function startAbCycle() {
    if (abCompare === abSideA) {
      return;
    }
    stopOther("patch");
    const seconds = resolvedAbSeconds();
    setAbSecondsText(String(seconds));
    cycleRef.current = {
      a: abSideA,
      b: abCompare,
      dwellMs: seconds * 1000,
      next: "b",
    };
    playingRef.current = true;
    setAbActive("a");
    setAbCountdown(seconds);
    setAbPlaying(true);
    if (patch !== abSideA) {
      void recallPatch(abSideA);
    }
  }

  const stopAbRef = useRef(stopAbCycle);
  const closeAbRef = useRef(closeAbSetup);
  const abOpenRef = useRef(abOpen);
  const followedPatchRef = useRef(patch);
  const appRecallRef = useRef<number | null>(null);
  const stopRecallRef = useRef(0);
  stopAbRef.current = stopAbCycle;
  closeAbRef.current = closeAbSetup;
  abOpenRef.current = abOpen;

  function recallPatch(slot: number): Promise<void> {
    appRecallRef.current = slot;
    const before = session.getSnapshot();
    const pending = session.setPatch(slot);
    const after = session.getSnapshot();
    if (
      before.status !== "connected" ||
      after.status !== "connected" ||
      after.patch === before.patch
    ) {
      if (appRecallRef.current === slot) {
        appRecallRef.current = null;
      }
    }
    return pending;
  }

  useEffect(() => {
    if (!abOpen) {
      followedPatchRef.current = patch;
      appRecallRef.current = null;
      return;
    }
    if (patch === followedPatchRef.current || patch === appRecallRef.current) {
      followedPatchRef.current = patch;
      appRecallRef.current = null;
      return;
    }
    closeAbRef.current();
  }, [abOpen, patch]);

  useEffect(() => {
    registerStop("patch", () => {
      stopAbRef.current(false);
    });
    return () => {
      registerStop("patch", null);
    };
  }, [registerStop]);

  useEffect(() => {
    if (!abOpen || moduleOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" && event.key !== " ") {
        return;
      }
      if (event.repeat) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input, textarea, button, [role='combobox'], [role='dialog']",
          ))
      ) {
        return;
      }
      event.preventDefault();
      if (playingRef.current) {
        stopAbCycle();
        return;
      }
      startAbCycle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [abOpen, moduleOpen, abCompare, abSideA, patch, abSecondsText]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!abPlaying || busy) {
      return;
    }
    const cycle = cycleRef.current;
    if (!cycle) {
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        const current = cycleRef.current;
        if (!playingRef.current || !current) {
          return;
        }
        const before = session.getSnapshot();
        if (before.status !== "connected") {
          playingRef.current = false;
          cycleRef.current = null;
          if (mountedRef.current) {
            setAbPlaying(false);
            setAbActive(null);
            setAbCountdown(null);
          }
          return;
        }
        if (before.chainSync === "syncing") {
          return;
        }
        const target = current.next === "b" ? current.b : current.a;
        const previousNext = current.next;
        current.next = current.next === "b" ? "a" : "b";
        let enteredSyncing = false;
        const unsubscribe = session.subscribe(() => {
          const next = session.getSnapshot();
          if (next.status === "connected" && next.chainSync === "syncing") {
            enteredSyncing = true;
          }
        });
        try {
          await recallPatch(target);
        } catch {
          unsubscribe();
          current.next = previousNext;
          if (playingRef.current) {
            playingRef.current = false;
            cycleRef.current = null;
            if (mountedRef.current) {
              setAbPlaying(false);
              setAbActive(null);
              setAbCountdown(null);
            }
          }
          return;
        }
        unsubscribe();
        if (!playingRef.current || !mountedRef.current) {
          return;
        }
        const after = session.getSnapshot();
        if (after.status !== "connected") {
          playingRef.current = false;
          cycleRef.current = null;
          setAbPlaying(false);
          setAbActive(null);
          setAbCountdown(null);
          return;
        }
        const tookEffect = enteredSyncing || after.patch === target;
        if (!tookEffect) {
          current.next = previousNext;
          return;
        }
        setAbActive(previousNext);
        if (!enteredSyncing) {
          setDwellEpoch((epoch) => epoch + 1);
        }
      })();
    }, cycle.dwellMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [abPlaying, busy, dwellEpoch, session]);

  useEffect(() => {
    if (!abPlaying || busy) {
      return;
    }
    const cycle = cycleRef.current;
    if (!cycle) {
      return;
    }
    const totalSec = Math.max(1, Math.round(cycle.dwellMs / 1000));
    setAbCountdown(totalSec);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(
        0,
        totalSec - Math.floor((Date.now() - started) / 1000),
      );
      setAbCountdown(left);
    }, 100);
    return () => {
      window.clearInterval(tick);
    };
  }, [abPlaying, busy, dwellEpoch]);

  function uploadPatchBytes(bytes: Uint8Array) {
    void toast.promise(
      (async () => {
        const result = await session.uploadCurrentPatch(bytes);
        if (!result.ok) {
          throw new Error(
            result.reason === "disconnected"
              ? "Pedal disconnected."
              : result.reason === "busy"
                ? "The patch is still syncing."
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
    <div className="-mx-6 -mt-6 w-[calc(100%+3rem)] border-b border-border bg-muted dark:bg-black/35">
      <div className="flex flex-wrap items-center justify-center gap-1 px-6 pt-7 pb-3">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={abOpen ? "Close A/B test" : "A/B Test - Compare Patches"}
              className={patchChipClass}
              onClick={abOpen ? closeAbSetup : openAbSetup}
            >
              {abOpen ? (
                <X />
              ) : (
                <img
                  src={abCompareIcon}
                  alt=""
                  aria-hidden
                  className="size-3.5 dark:invert"
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {abOpen ? "Close A/B test" : "A/B Test - Compare Patches"}
          </TooltipContent>
        </Tooltip>
        <AbSideLabel label="A" show={abOpen} lit={abActive === "a"}>
          {abOpen ? (
            <PatchSelect
              patch={abSideA}
              patchNames={patchNames}
              disabled={abPlaying}
              triggerClassName={`${patchChipClass} h-8 w-56 min-w-56 justify-center gap-1.5 border-transparent px-2.5 py-0 text-lg font-semibold tabular-nums dark:border-transparent${abActive === "a" ? " disabled:opacity-100" : ""}`}
              onSelect={(next) => {
                if (abPlaying) {
                  return;
                }
                setAbSideA(next);
              }}
            />
          ) : (
            <div className="flex items-center gap-1">
              <PatchNavTooltip enabled={modified && !abPlaying}>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Previous patch"
                    disabled={busy || abPlaying}
                    className={patchChipClass}
                    onClick={() => void session.stepPatch(-1)}
                  >
                    <ChevronLeft />
                  </Button>
                </span>
              </PatchNavTooltip>
              <PatchSelect
                patch={patch}
                patchNames={patchNames}
                disabled={busy || abPlaying}
                triggerClassName={`${patchChipClass} h-8 w-56 min-w-56 justify-center gap-1.5 border-transparent px-2.5 py-0 text-lg font-semibold tabular-nums dark:border-transparent${abActive === "a" ? " disabled:opacity-100" : ""}`}
                wrapTrigger={(trigger) => (
                  <PatchNavTooltip enabled={modified && !abPlaying}>{trigger}</PatchNavTooltip>
                )}
                onSelect={(next) => {
                  if (busy || abPlaying) {
                    return;
                  }
                  void session.setPatch(next);
                }}
              />
              <PatchNavTooltip enabled={modified && !abPlaying}>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Next patch"
                    disabled={busy || abPlaying}
                    className={patchChipClass}
                    onClick={() => void session.stepPatch(1)}
                  >
                    <ChevronRight />
                  </Button>
                </span>
              </PatchNavTooltip>
            </div>
          )}
        </AbSideLabel>
      </TooltipProvider>
      {abOpen ? (
        <div className={`flex items-center gap-1 ${patchClusterEnterClass}`}>
          <div className="relative">
            {abPlaying ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-[13px] flex items-center"
              >
                <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-border">
                  {busy ? null : (
                    <div
                      key={`${dwellEpoch}-${abActive ?? "a"}`}
                      className={`h-full w-full rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-400 animate-ab-dwell ${
                        abActive === "b" ? "origin-right" : "origin-left"
                      }`}
                      style={{
                        animationDuration: `${cycleRef.current?.dwellMs ?? resolvedAbSeconds() * 1000}ms`,
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-5 text-center text-xs font-normal tracking-wide text-muted-foreground"
              >
                Seconds
              </span>
            )}
            {abPlaying ? (
              <div
                aria-live="polite"
                aria-label="Seconds remaining"
                className="flex h-8 w-16 items-center justify-center px-2 text-sm tabular-nums"
              >
                {abCountdown ?? resolvedAbSeconds()}
              </div>
            ) : (
              <AbSecondsField
                value={abSecondsText}
                onValueChange={setAbSecondsText}
                className={`${patchChipClass} h-8 w-16 border-transparent px-2 text-center tabular-nums dark:border-transparent`}
              />
            )}
          </div>
          <AbSideLabel label="B" show lit={abActive === "b"}>
            <PatchSelect
              patch={abCompare}
              patchNames={patchNames}
              disabled={abPlaying}
              triggerClassName={`${patchChipClass} h-8 w-56 min-w-56 justify-center gap-1.5 border-transparent px-2.5 py-0 text-lg font-semibold tabular-nums dark:border-transparent${abActive === "b" ? " disabled:opacity-100" : ""}`}
              onSelect={(next) => {
                setAbCompare(next);
              }}
            />
          </AbSideLabel>
          {abPlaying ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={patchChipClass}
              aria-label="Stop"
              onClick={() => stopAbCycle()}
            >
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={
                abCompare === abSideA ? patchChipClass : abPlayReadyClass
              }
              aria-label="Play"
              disabled={abCompare === abSideA}
              onClick={startAbCycle}
            >
              <Play className="size-3 fill-current" />
            </Button>
          )}
        </div>
      ) : null}
      {abOpen ? null : (
      <div className={`flex flex-wrap items-center gap-1 ${patchClusterEnterClass}`}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !modified}
          className={
            modified && !busy
              ? "rounded-[4px] border-transparent bg-emerald-100 px-3 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900 active:translate-y-0.5! dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700 dark:hover:text-emerald-100 [&_svg]:text-emerald-800 hover:[&_svg]:text-emerald-900 dark:[&_svg]:text-emerald-200 dark:hover:[&_svg]:text-emerald-100"
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
        <Popover
          open={optionsOpen}
          onOpenChange={(next) => {
            if (busy && next) {
              return;
            }
            setOptionsOpen(next);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className={patchActionClass}
              aria-label="Options"
              aria-expanded={optionsOpen}
            >
              <Settings2 className={patchActionIconClass} />
              Options
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 gap-0.5 p-1">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start gap-2 px-2 font-normal"
              onClick={() => {
                setOptionsOpen(false);
                openRename();
              }}
            >
              <Pencil className={patchActionIconClass} />
              Rename
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start gap-2 px-2 font-normal"
              onClick={() => {
                setOptionsOpen(false);
                openDuplicate();
              }}
            >
              <Copy className={patchActionIconClass} />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !canExportPatch}
              className="h-8 w-full justify-start gap-2 px-2 font-normal"
              onClick={() => {
                setOptionsOpen(false);
                requestDownload();
              }}
            >
              <Download className={patchActionIconClass} />
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start gap-2 px-2 font-normal"
              onClick={() => {
                setOptionsOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <Upload className={patchActionIconClass} />
              Upload
            </Button>
          </PopoverContent>
        </Popover>
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
      <PatchLevels model={model} volume={patchVolume} bpm={patchBpm} disabled={busy} />
      </div>
      )}
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
        open={downloadWarn !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDownloadWarn(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download this patch?</DialogTitle>
            <DialogDescription>
              {downloadWarn?.irName ? (
                <span className="block">
                  This patch uses the custom IR {downloadWarn.irName}. The file will
                  reference that IR slot but will not include the IR file. Loading it
                  on another pedal will use whatever IR is in that slot there.
                </span>
              ) : null}
              {downloadWarn?.nsName ? (
                <span className={downloadWarn.irName ? "mt-2 block" : "block"}>
                  This patch uses the custom SnapTone {downloadWarn.nsName}. The file
                  will reference that SnapTone slot but will not include the SnapTone
                  file. Loading it on another pedal will use whatever SnapTone is in
                  that slot there.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDownloadWarn(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmDownload}>
              Download
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
              {pendingUpload && pendingUpload.omissions.length > 0 ? (
                <span className="mt-2 block">
                  These models are not on this pedal and will be skipped:{" "}
                  {pendingUpload.omissions
                    .map((item) => `${chainSlotLabel(item.kind)} ${item.label}`)
                    .join(", ")}
                  .
                </span>
              ) : null}
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
