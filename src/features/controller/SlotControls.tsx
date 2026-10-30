import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import abCompareIcon from "@/assets/img/icon-ab-compare.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  controlsForPedal,
  modelById,
  modelsForKind,
  type FxControl,
} from "@/device/catalog";
import { userIrDisplayName } from "@/device/ir-names";
import { userNsDisplayName } from "@/device/nam-names";
import type { DeviceModel } from "@/device/models";
import {
  EFFECT_IDS,
  chainSlotBypassed,
  chainSlotLabel,
  isEffectSlot,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
  type EffectId,
} from "@/device/session";
import { useDeviceSession, useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import { ChainSlotIcon } from "@/features/controller/ChainSlotIcon";
import { ModelSelect } from "@/features/controller/ModelSelect";
import { cn } from "@/lib/utils";

const EXPANDED_PANELS_KEY = "gpstudio.slot-controls.expanded";
const EFFECT_ID_SET = new Set<string>(EFFECT_IDS);

function readExpandedPanels(): Set<EffectId> {
  try {
    const raw = localStorage.getItem(EXPANDED_PANELS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter((id): id is EffectId => typeof id === "string" && EFFECT_ID_SET.has(id)),
    );
  } catch {
    return new Set();
  }
}

function writeExpandedPanels(ids: Set<EffectId>): void {
  localStorage.setItem(EXPANDED_PANELS_KEY, JSON.stringify([...ids]));
}

function setPanelExpanded(id: EffectId, expanded: boolean): void {
  const next = readExpandedPanels();
  if (expanded) {
    next.add(id);
  } else {
    next.delete(id);
  }
  writeExpandedPanels(next);
}

function formatControlValue(control: FxControl, value: number): string {
  if (control.display === "toggle") {
    return value >= 1 ? "On" : "Off";
  }
  if (control.step < 1) {
    return value.toFixed(1);
  }
  return String(Math.round(value));
}

function SlotControl({
  kind,
  control,
  value,
  disabled,
  onControlChange,
}: {
  kind: EffectId;
  control: FxControl;
  value: number;
  disabled: boolean;
  /** When set, the panel does not call the session itself. `flush` is true on release. */
  onControlChange?: (index: number, value: number, flush: boolean) => void;
}) {
  const session = useDeviceSession();
  const [dragging, setDragging] = useState(false);
  const label = `${chainSlotLabel(kind)} ${control.label}`;

  function writeControl(nextValue: number, flush: boolean) {
    if (onControlChange) {
      onControlChange(control.index, nextValue, flush);
      return;
    }
    void session.setSlotControl(
      kind,
      control.index,
      nextValue,
      flush ? { flush: true } : undefined,
    );
  }

  if (control.display === "toggle") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground/70">{control.label}</span>
        <Switch
          size="sm"
          checked={value >= 1}
          disabled={disabled}
          aria-label={`${label} ${value >= 1 ? "on" : "off"}`}
          onCheckedChange={(checked) => {
            writeControl(checked ? 1 : 0, true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span
          className={cn(
            "origin-left text-foreground/70 transition-transform duration-150",
            dragging && "relative z-10 scale-150 font-medium text-foreground",
          )}
        >
          {control.label}
        </span>
        <span
          className={cn(
            "origin-right font-medium tabular-nums transition-transform duration-150",
            dragging && "relative z-10 scale-150",
          )}
        >
          {formatControlValue(control, value)}
        </span>
      </div>
      <Slider
        min={control.min}
        max={control.max}
        step={control.step}
        value={[value]}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined) {
            return;
          }
          setDragging(true);
          writeControl(nextValue, false);
        }}
        onValueCommit={(next) => {
          const nextValue = next[0];
          setDragging(false);
          if (nextValue === undefined) {
            return;
          }
          writeControl(nextValue, true);
        }}
      />
    </div>
  );
}

export type EffectPanelSlot = AudioChainSlot & {
  id: EffectId;
  modelId: string;
  values: number[];
};

/** A slot that would show a control panel. Null when off, bypassed, or unknown. */
export function effectPanelSlot(chain: AudioChain, id: EffectId): EffectPanelSlot | null {
  const slot = chain.find((entry) => entry.id === id);
  if (!slot || !isEffectSlot(slot.id) || !slot.enabled) {
    return null;
  }
  if (chainSlotBypassed(chain, slot.id)) {
    return null;
  }
  if (slot.modelId === undefined || slot.values === undefined) {
    return null;
  }
  return {
    ...slot,
    id: slot.id,
    modelId: slot.modelId,
    values: slot.values,
  };
}

export function SlotControlPanel({
  slot,
  pedal,
  disabled,
  highlighted,
  current = false,
  onHoverSlot,
  onOpenAb,
  abDisabled = false,
  onModelChange,
  onControlChange,
  revealRequest = null,
}: {
  slot: EffectPanelSlot;
  pedal: DeviceModel;
  disabled: boolean;
  highlighted: boolean;
  current?: boolean;
  onHoverSlot?: (id: ChainSlotId | null) => void;
  onOpenAb?: (id: EffectId) => void;
  abDisabled?: boolean;
  /** When set, model edits stay on this copy and do not call the session. */
  onModelChange?: (modelId: string) => void;
  /** When set, the panel does not call the session itself. `flush` is true on release. */
  onControlChange?: (index: number, value: number, flush: boolean) => void;
  /** Mobile: expand and scroll when the chain icon for this slot is tapped. */
  revealRequest?: { id: EffectId; nonce: number } | null;
}) {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const panelRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(() => readExpandedPanels().has(slot.id));
  const collapsed = !expanded;

  useEffect(() => {
    if (!revealRequest || revealRequest.id !== slot.id) {
      return;
    }
    setExpanded(true);
    setPanelExpanded(slot.id, true);
    const timer = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [revealRequest, slot.id]);
  const model = modelById(slot.modelId);
  if (!model) {
    return null;
  }
  const userIrNames = snapshot.status === "connected" ? snapshot.userIrNames : undefined;
  const userNsNames = snapshot.status === "connected" ? snapshot.userNsNames : undefined;
  const options = modelsForKind(slot.id, pedal).map((option) => ({
    ...option,
    label:
      option.userNsSlot !== undefined
        ? userNsDisplayName(option, userNsNames)
        : userIrDisplayName(option, userIrNames),
  }));
  const kindLabel = chainSlotLabel(slot.id);
  const shownLabel = options.find((option) => option.id === model.id)?.label ?? model.label;
  const marked = highlighted || current;

  function openAb() {
    onOpenAb?.(slot.id);
  }

  return (
    <section
      ref={panelRef}
      data-slot-panel={slot.id}
      className={cn(
        "flex min-w-0 w-full scroll-mt-20 flex-col gap-3 rounded-lg bg-muted/60 px-4 py-3 transition-[background-color,box-shadow] duration-150 dark:bg-muted/30",
        marked &&
          "bg-muted/80 shadow-[inset_0_0_0_1px] shadow-foreground/12 dark:bg-muted/45 dark:shadow-foreground/18",
      )}
      aria-label={`${kindLabel} controls`}
      aria-current={current ? "true" : undefined}
      onPointerEnter={() => onHoverSlot?.(slot.id)}
      onPointerLeave={() => onHoverSlot?.(null)}
    >
      <div
        className={cn(
          "flex items-center gap-3 -mr-2",
          collapsed ? "pb-0 md:pb-2" : "pb-2",
        )}
      >
        {model.description ? (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`About ${shownLabel}`}
                className="shrink-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChainSlotIcon id={slot.id} size="sm" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{shownLabel}</DialogTitle>
                <DialogDescription className="text-left">
                  {model.description}
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        ) : (
          <span className="shrink-0">
            <ChainSlotIcon id={slot.id} size="sm" />
          </span>
        )}
        <h2 className="sr-only">{kindLabel}</h2>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {options.length > 1 ? (
            <ModelSelect
              value={model.id}
              options={options}
              disabled={disabled}
              ariaLabel={`${kindLabel} model`}
              onValueChange={(value) => {
                if (onModelChange) {
                  onModelChange(value);
                  return;
                }
                void session.setSlotModel(slot.id, value);
              }}
            />
          ) : (
            <p className="min-w-0 flex-1 text-right text-sm text-muted-foreground">
              {model.label}
            </p>
          )}
          {onOpenAb ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="A/B Test - Compare Settings"
                  disabled={disabled || abDisabled}
                  className="shrink-0 rounded-[4px] border-transparent bg-background hover:bg-[oklch(0.965_0.008_255)]! active:translate-y-0.5! dark:bg-muted/40 dark:hover:bg-[oklch(0.305_0.045_255)]!"
                  onClick={openAb}
                >
                  <img
                    src={abCompareIcon}
                    alt=""
                    aria-hidden
                    className="size-3.5 dark:invert"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">A/B Test - Compare Settings</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground md:hidden"
          aria-expanded={expanded}
          aria-label={
            collapsed
              ? `Expand ${kindLabel} controls`
              : `Collapse ${kindLabel} controls`
          }
          onClick={() => {
            setExpanded((current) => {
              const next = !current;
              setPanelExpanded(slot.id, next);
              return next;
            });
          }}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              collapsed && "-rotate-90",
            )}
          />
        </Button>
      </div>
      <div
        className={cn(
          "flex-col gap-3",
          collapsed ? "hidden md:flex" : "flex",
        )}
      >
        {controlsForPedal(model, pedal).map((control) => (
          <SlotControl
            key={control.index}
            kind={slot.id}
            control={control}
            value={slot.values[control.index] ?? control.default}
            disabled={disabled}
            onControlChange={onControlChange}
          />
        ))}
      </div>
    </section>
  );
}

export function SlotControlPanels({
  chain,
  pedal,
  disabled,
  hoveredSlot = null,
  onHoverSlot,
  omitId = null,
  abDisabled = false,
  onOpenAb,
  revealRequest = null,
}: {
  chain: AudioChain;
  pedal: DeviceModel;
  disabled: boolean;
  hoveredSlot?: ChainSlotId | null;
  onHoverSlot?: (id: ChainSlotId | null) => void;
  omitId?: EffectId | null;
  abDisabled?: boolean;
  onOpenAb?: (id: EffectId) => void;
  revealRequest?: { id: EffectId; nonce: number } | null;
}) {
  const panels = chain.flatMap((slot) => {
    if (!isEffectSlot(slot.id) || slot.id === omitId) {
      return [];
    }
    const panel = effectPanelSlot(chain, slot.id);
    return panel ? [panel] : [];
  });
  if (panels.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="mt-6 grid w-full max-w-6xl grid-cols-1 gap-2 px-2 pb-6 md:grid-cols-2 lg:grid-cols-3">
        {panels.map((slot) => (
          <SlotControlPanel
            key={slot.id}
            slot={slot}
            pedal={pedal}
            disabled={disabled}
            highlighted={hoveredSlot === slot.id}
            onHoverSlot={onHoverSlot}
            onOpenAb={onOpenAb}
            abDisabled={abDisabled}
            revealRequest={revealRequest}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
