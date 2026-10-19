import { Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  controlsForPedal,
  defaultValuesFor,
  modelById,
  snapControlValue,
} from "@/device/catalog";
import type { DeviceModel } from "@/device/models";
import {
  type AudioChain,
  type ChainSlotId,
  type DeviceSession,
  type EffectId,
} from "@/device/session";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { useAbCycleClaim } from "@/features/controller/AbCycleClaim";
import { AbSideLabel } from "@/features/controller/AbSideLabel";
import {
  AB_SECONDS_DEFAULT,
  AbSecondsField,
  resolveAbSeconds,
} from "@/features/controller/AbSecondsField";
import {
  effectPanelSlot,
  SlotControlPanel,
  type EffectPanelSlot,
} from "@/features/controller/SlotControls";
const playReadyClass =
  "rounded-[4px] border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900 dark:bg-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-700 dark:hover:text-emerald-100 [&_svg]:text-emerald-800 hover:[&_svg]:text-emerald-900 dark:[&_svg]:text-emerald-200 dark:hover:[&_svg]:text-emerald-100";

type SlotVersion = {
  modelId: string;
  values: number[];
};

type ModuleCycle = {
  a: SlotVersion;
  b: SlotVersion;
  next: "a" | "b";
  dwellMs: number;
};

type ApplyResult = "applied" | "noop" | "syncing" | "stopped";

function copyVersion(version: SlotVersion): SlotVersion {
  return { modelId: version.modelId, values: version.values.slice() };
}

function sideMatches(slot: EffectPanelSlot, captured: SlotVersion, pedal: DeviceModel): boolean {
  if (slot.modelId !== captured.modelId) {
    return false;
  }
  const model = modelById(captured.modelId);
  if (!model) {
    return false;
  }
  for (const control of controlsForPedal(model, pedal)) {
    const want = snapControlValue(control, captured.values[control.index] ?? control.default);
    if (slot.values[control.index] !== want) {
      return false;
    }
  }
  return true;
}

/** Model write, then each visible control that still differs. `proceed` stops further writes. */
async function applyCapturedSide(
  session: DeviceSession,
  kind: EffectId,
  captured: SlotVersion,
  proceed: () => boolean = () => true,
): Promise<ApplyResult> {
  let enteredSyncing = false;
  const unsubscribe = session.subscribe(() => {
    const next = session.getSnapshot();
    if (next.status === "connected" && next.chainSync === "syncing") {
      enteredSyncing = true;
    }
  });
  try {
    const before = session.getSnapshot();
    if (before.status !== "connected") {
      return "stopped";
    }
    if (before.chainSync === "syncing" || enteredSyncing) {
      return "syncing";
    }
    const slot = effectPanelSlot(before.chain, kind);
    if (!slot || !proceed()) {
      return "stopped";
    }
    if (slot.modelId !== captured.modelId) {
      await session.setSlotModel(kind, captured.modelId);
      if (!proceed()) {
        return "stopped";
      }
      const afterModel = session.getSnapshot();
      if (afterModel.status !== "connected") {
        return "stopped";
      }
      if (enteredSyncing || afterModel.chainSync === "syncing") {
        return "syncing";
      }
      const updated = effectPanelSlot(afterModel.chain, kind);
      if (!updated || updated.modelId !== captured.modelId) {
        return "noop";
      }
    }
    const model = modelById(captured.modelId);
    if (!model) {
      return "stopped";
    }
    const pedalSnap = session.getSnapshot();
    if (pedalSnap.status !== "connected") {
      return "stopped";
    }
    if (enteredSyncing || pedalSnap.chainSync === "syncing") {
      return "syncing";
    }
    for (const control of controlsForPedal(model, pedalSnap.model)) {
      if (!proceed()) {
        return "stopped";
      }
      const current = session.getSnapshot();
      if (current.status !== "connected") {
        return "stopped";
      }
      if (enteredSyncing || current.chainSync === "syncing") {
        return "syncing";
      }
      const currentSlot = effectPanelSlot(current.chain, kind);
      if (!currentSlot || currentSlot.modelId !== captured.modelId) {
        return "noop";
      }
      const want = snapControlValue(
        control,
        captured.values[control.index] ?? control.default,
      );
      if (currentSlot.values[control.index] === want) {
        continue;
      }
      await session.setSlotControl(kind, control.index, want, { flush: true });
      if (!proceed()) {
        return "stopped";
      }
    }
    const after = session.getSnapshot();
    if (after.status !== "connected") {
      return "stopped";
    }
    if (enteredSyncing || after.chainSync === "syncing") {
      return "syncing";
    }
    const finalSlot = effectPanelSlot(after.chain, kind);
    if (!finalSlot || !sideMatches(finalSlot, captured, after.model)) {
      return "noop";
    }
    return "applied";
  } catch {
    return "stopped";
  } finally {
    unsubscribe();
  }
}

export function ModuleAbBlock({
  kind,
  chain,
  pedal,
  onClose,
  onHoverSlot,
}: {
  kind: EffectId;
  chain: AudioChain;
  pedal: DeviceModel;
  onClose: () => void;
  onHoverSlot?: (id: ChainSlotId | null) => void;
}) {
  const session = useDeviceSession();
  const { registerStop, stopOther } = useAbCycleClaim();
  const live = effectPanelSlot(chain, kind);
  const [localSide, setLocalSide] = useState<SlotVersion>(() => {
    const initial = effectPanelSlot(chain, kind);
    return initial
      ? { modelId: initial.modelId, values: initial.values.slice() }
      : { modelId: "", values: [] };
  });
  const [sounding, setSounding] = useState<"a" | "b">("a");
  const [playing, setPlaying] = useState(false);
  const [frozen, setFrozen] = useState<{ a: SlotVersion; b: SlotVersion } | null>(null);
  const [secondsText, setSecondsText] = useState(String(AB_SECONDS_DEFAULT));
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dwellEpoch, setDwellEpoch] = useState(0);
  const cycleRef = useRef<ModuleCycle | null>(null);
  const playingRef = useRef(false);
  const applyingRef = useRef(false);
  const mountedRef = useRef(true);
  const soundingRef = useRef<"a" | "b">("a");
  const localSideRef = useRef(localSide);
  const liveRef = useRef(live);
  const secondsRef = useRef(secondsText);
  const leaveRef = useRef(false);
  const useTicket = useRef(0);
  const writeTailRef = useRef<Promise<void>>(Promise.resolve());
  localSideRef.current = localSide;
  liveRef.current = live;
  secondsRef.current = secondsText;

  function bindStoppedSides() {
    const captured = cycleRef.current;
    setFrozen(null);
    if (!captured) {
      return;
    }
    const quiet = soundingRef.current === "a" ? captured.b : captured.a;
    setLocalSide({ modelId: quiet.modelId, values: quiet.values.slice() });
    cycleRef.current = null;
  }

  function stopCycle() {
    if (!playingRef.current && !applyingRef.current) {
      return;
    }
    playingRef.current = false;
    if (applyingRef.current) {
      return;
    }
    setPlaying(false);
    bindStoppedSides();
  }

  function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const run = writeTailRef.current.then(work, work);
    writeTailRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function readSide(side: "a" | "b"): SlotVersion {
    const cycle = cycleRef.current;
    if (cycle) {
      return cycle[side];
    }
    if (side === soundingRef.current) {
      const liveNow = liveRef.current;
      if (liveNow) {
        return { modelId: liveNow.modelId, values: liveNow.values.slice() };
      }
    }
    return localSideRef.current;
  }

  async function useSide(side: "a" | "b") {
    const version = copyVersion(readSide(side));
    const ticket = useTicket.current + 1;
    useTicket.current = ticket;
    leaveRef.current = true;
    playingRef.current = false;
    setPlaying(false);
    await enqueueWrite(async () => {
      if (useTicket.current !== ticket || !mountedRef.current) {
        return;
      }
      const snapshot = session.getSnapshot();
      if (snapshot.status !== "connected") {
        return;
      }
      const slot = effectPanelSlot(snapshot.chain, kind);
      if (slot && sideMatches(slot, version, snapshot.model)) {
        return;
      }
      await applyCapturedSide(
        session,
        kind,
        version,
        () => useTicket.current === ticket && mountedRef.current,
      );
    });
    if (useTicket.current !== ticket || !mountedRef.current) {
      return;
    }
    onClose();
  }

  function changeLocalModel(modelId: string) {
    const model = modelById(modelId);
    if (!model || model.kind !== kind) {
      return;
    }
    setLocalSide({ modelId: model.id, values: defaultValuesFor(model) });
  }

  function changeLocalControl(index: number, value: number) {
    setLocalSide((current) => {
      const values = current.values.slice();
      values[index] = value;
      return { modelId: current.modelId, values };
    });
  }

  function rememberSide(side: "a" | "b", next: SlotVersion) {
    const copy = copyVersion(next);
    if (cycleRef.current) {
      cycleRef.current[side] = copy;
    }
    setFrozen((current) => (current ? { ...current, [side]: copy } : current));
    if (side !== soundingRef.current) {
      setLocalSide(copy);
    }
  }

  function changePlayingModel(side: "a" | "b", modelId: string) {
    const model = modelById(modelId);
    if (!model || model.kind !== kind) {
      return;
    }
    rememberSide(side, { modelId: model.id, values: defaultValuesFor(model) });
    if (side === soundingRef.current && !applyingRef.current) {
      void session.setSlotModel(kind, model.id);
    }
  }

  function changePlayingControl(side: "a" | "b", index: number, value: number, flush: boolean) {
    const base = cycleRef.current?.[side];
    if (!base) {
      return;
    }
    const values = base.values.slice();
    values[index] = value;
    rememberSide(side, { modelId: base.modelId, values });
    if (side === soundingRef.current && !applyingRef.current) {
      void session.setSlotControl(kind, index, value, flush ? { flush: true } : undefined);
    }
  }

  function startCycle() {
    if (playingRef.current || applyingRef.current) {
      return;
    }
    const liveNow = liveRef.current;
    if (!liveNow) {
      return;
    }
    stopOther("module");
    leaveRef.current = false;
    const seconds = resolveAbSeconds(secondsRef.current);
    setSecondsText(String(seconds));
    const soundingNow = soundingRef.current;
    const local = localSideRef.current;
    const liveVersion = { modelId: liveNow.modelId, values: liveNow.values.slice() };
    const a = soundingNow === "a" ? copyVersion(liveVersion) : copyVersion(local);
    const b = soundingNow === "b" ? copyVersion(liveVersion) : copyVersion(local);
    cycleRef.current = {
      a,
      b,
      next: soundingNow === "a" ? "b" : "a",
      dwellMs: seconds * 1000,
    };
    setFrozen({ a, b });
    playingRef.current = true;
    setPlaying(true);
  }

  const stopRef = useRef(stopCycle);
  const startRef = useRef(startCycle);
  stopRef.current = stopCycle;
  startRef.current = startCycle;

  useEffect(() => {
    registerStop("module", () => {
      stopRef.current();
    });
    return () => {
      registerStop("module", null);
    };
  }, [registerStop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playingRef.current = false;
    };
  }, []);

  useEffect(() => {
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
          target.closest("input, textarea, button, [role='combobox'], [role='dialog']"))
      ) {
        return;
      }
      event.preventDefault();
      if (playingRef.current || applyingRef.current) {
        stopRef.current();
        return;
      }
      startRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const snapshot = session.getSnapshot();
    if (snapshot.status !== "connected" || snapshot.chainSync !== "idle") {
      return;
    }
    const cycle = cycleRef.current;
    if (!cycle) {
      return;
    }
    const dwellMs = resolveAbSeconds(secondsRef.current) * 1000;
    cycle.dwellMs = dwellMs;
    const timer = window.setTimeout(() => {
      void (async () => {
        const current = cycleRef.current;
        if (!playingRef.current || !current) {
          return;
        }
        const before = session.getSnapshot();
        if (before.status !== "connected") {
          playingRef.current = false;
          if (mountedRef.current) {
            setPlaying(false);
            bindStoppedSides();
          }
          return;
        }
        if (before.chainSync !== "idle") {
          return;
        }
        const target = current.next;
        const captured = target === "a" ? current.a : current.b;
        applyingRef.current = true;
        let result: ApplyResult;
        try {
          result = await enqueueWrite(() =>
            applyCapturedSide(
              session,
              kind,
              captured,
              () => playingRef.current && mountedRef.current && !leaveRef.current,
            ),
          );
        } finally {
          applyingRef.current = false;
        }
        if (result === "applied" && cycleRef.current) {
          cycleRef.current.next = target === "a" ? "b" : "a";
          soundingRef.current = target;
          if (mountedRef.current) {
            setSounding(target);
          }
        }
        if (!mountedRef.current) {
          return;
        }
        if (!playingRef.current) {
          setPlaying(false);
          if (!leaveRef.current) {
            bindStoppedSides();
          }
          return;
        }
        if (result === "stopped") {
          playingRef.current = false;
          setPlaying(false);
          bindStoppedSides();
          return;
        }
        if (result === "syncing") {
          return;
        }
        const after = session.getSnapshot();
        if (after.status === "connected" && after.chainSync === "idle") {
          setDwellEpoch((epoch) => epoch + 1);
        }
      })();
    }, dwellMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [playing, dwellEpoch, session, kind]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const cycle = cycleRef.current;
    if (!cycle) {
      return;
    }
    const totalSec = Math.max(1, Math.round(cycle.dwellMs / 1000));
    setCountdown(totalSec);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, totalSec - Math.floor((Date.now() - started) / 1000));
      setCountdown(left);
    }, 100);
    return () => {
      window.clearInterval(tick);
    };
  }, [playing, dwellEpoch]);

  if (!live || localSide.modelId === "") {
    return null;
  }

  const liveVersion = { modelId: live.modelId, values: live.values };
  const aVersion = playing && frozen ? frozen.a : sounding === "a" ? liveVersion : localSide;
  const bVersion = playing && frozen ? frozen.b : sounding === "b" ? liveVersion : localSide;

  function panelSlot(version: SlotVersion): EffectPanelSlot {
    return {
      id: kind,
      enabled: true,
      modelId: version.modelId,
      values: version.values,
    };
  }

  function sideWriters(side: "a" | "b") {
    if (playing) {
      return {
        onModelChange: (modelId: string) => changePlayingModel(side, modelId),
        onControlChange: (index: number, value: number, flush: boolean) =>
          changePlayingControl(side, index, value, flush),
      };
    }
    if (sounding === side) {
      return {};
    }
    return {
      onModelChange: changeLocalModel,
      onControlChange: (index: number, value: number) => changeLocalControl(index, value),
    };
  }

  const playStop = playing ? (
    <Button type="button" variant="ghost" size="sm" onClick={stopCycle}>
      <Square className="size-3 fill-current" />
      Stop
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="sm" className={playReadyClass} onClick={startCycle}>
      <Play className="size-3 fill-current" />
      Play
    </Button>
  );

  return (
    <div className="mt-6 flex w-full max-w-6xl flex-col gap-3 px-2">
      <TooltipProvider delayDuration={0}>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex min-w-0 w-full flex-col items-center gap-2 lg:flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" onClick={() => void useSide("a")}>
                  Use A
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Set side A and close</TooltipContent>
            </Tooltip>
            <div className="w-full pt-7">
              <AbSideLabel label="A" show lit={playing && sounding === "a"} className="w-full">
                <SlotControlPanel
                  slot={panelSlot(aVersion)}
                  pedal={pedal}
                  disabled={false}
                  highlighted={false}
                  current={sounding === "a"}
                  onHoverSlot={onHoverSlot}
                  {...sideWriters("a")}
                />
              </AbSideLabel>
            </div>
          </div>
          <div className="flex w-16 shrink-0 flex-col items-center gap-2 self-center lg:self-start">
            <div className="relative h-8 w-full">
              <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2">{playStop}</div>
            </div>
            <div className="w-full pt-7">
              <div className="relative flex w-full flex-col items-center">
                {playing ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-[13px] flex items-center"
                  >
                    <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-border">
                      <div
                        key={`${dwellEpoch}-${sounding}`}
                        className={`h-full w-full rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-400 animate-ab-dwell ${
                          sounding === "b" ? "origin-right" : "origin-left"
                        }`}
                        style={{
                          animationDuration: `${cycleRef.current?.dwellMs ?? resolveAbSeconds(secondsText) * 1000}ms`,
                        }}
                      />
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
                {playing ? (
                  <div
                    aria-live="polite"
                    aria-label="Seconds remaining"
                    className="flex h-8 w-16 items-center justify-center px-2 text-sm tabular-nums"
                  >
                    {countdown ?? resolveAbSeconds(secondsText)}
                  </div>
                ) : (
                  <AbSecondsField
                    value={secondsText}
                    onValueChange={setSecondsText}
                    className="h-8 w-16 px-2 text-center tabular-nums"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 w-full flex-col items-center gap-2 lg:flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" onClick={() => void useSide("b")}>
                  Use B
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Set side B and close</TooltipContent>
            </Tooltip>
            <div className="w-full pt-7">
              <AbSideLabel label="B" show lit={playing && sounding === "b"} className="w-full">
                <SlotControlPanel
                  slot={panelSlot(bVersion)}
                  pedal={pedal}
                  disabled={false}
                  highlighted={false}
                  current={sounding === "b"}
                  onHoverSlot={onHoverSlot}
                  {...sideWriters("b")}
                />
              </AbSideLabel>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
