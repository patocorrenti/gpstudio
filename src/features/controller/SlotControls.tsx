import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  controlsForPedal,
  modelById,
  modelsForKind,
  type FxControl,
} from "@/device/catalog";
import { userIrDisplayName } from "@/device/ir-names";
import type { DeviceModel } from "@/device/models";
import {
  EFFECT_IDS,
  chainSlotBypassed,
  chainSlotLabel,
  isEffectSlot,
  type AudioChain,
  type AudioChainSlot,
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
}: {
  kind: EffectId;
  control: FxControl;
  value: number;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const label = `${chainSlotLabel(kind)} ${control.label}`;

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
            void session.setSlotControl(kind, control.index, checked ? 1 : 0, {
              flush: true,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground/70">{control.label}</span>
        <span className="font-medium tabular-nums">
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
          void session.setSlotControl(kind, control.index, nextValue);
        }}
        onValueCommit={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined) {
            return;
          }
          void session.setSlotControl(kind, control.index, nextValue, { flush: true });
        }}
      />
    </div>
  );
}

function SlotControlPanel({
  slot,
  pedal,
  disabled,
}: {
  slot: AudioChainSlot & { id: EffectId; modelId: string; values: number[] };
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const [expanded, setExpanded] = useState(() => readExpandedPanels().has(slot.id));
  const collapsed = !expanded;
  const model = modelById(slot.modelId);
  if (!model) {
    return null;
  }
  const userIrNames = snapshot.status === "connected" ? snapshot.userIrNames : undefined;
  const options = modelsForKind(slot.id, pedal).map((option) => ({
    ...option,
    label: userIrDisplayName(option, userIrNames),
  }));
  const kindLabel = chainSlotLabel(slot.id);
  const shownLabel = options.find((option) => option.id === model.id)?.label ?? model.label;

  return (
    <section
      className="flex min-w-0 w-full flex-col gap-3 rounded-lg bg-muted/60 px-4 py-3 dark:bg-muted/30"
      aria-label={`${kindLabel} controls`}
    >
      <div
        className={cn(
          "flex items-center gap-3 -mr-2",
          collapsed ? "pb-0 md:pb-2" : "pb-2",
        )}
      >
        <h2 className="shrink-0">
          <ChainSlotIcon id={slot.id} size="sm" />
          <span className="sr-only">{kindLabel}</span>
        </h2>
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {options.length > 1 ? (
            <ModelSelect
              value={model.id}
              options={options}
              disabled={disabled}
              ariaLabel={`${kindLabel} model`}
              onValueChange={(value) => {
                void session.setSlotModel(slot.id, value);
              }}
            />
          ) : (
            <p className="min-w-0 flex-1 text-right text-sm text-muted-foreground">
              {model.label}
            </p>
          )}
          {model.description ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`About ${shownLabel}`}
                  className="shrink-0 text-muted-foreground"
                >
                  <Info />
                </Button>
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
}: {
  chain: AudioChain;
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const panels = chain.flatMap((slot) => {
    if (!isEffectSlot(slot.id) || !slot.enabled) {
      return [];
    }
    if (chainSlotBypassed(chain, slot.id)) {
      return [];
    }
    if (slot.modelId === undefined || slot.values === undefined) {
      return [];
    }
    return [
      {
        ...slot,
        id: slot.id,
        modelId: slot.modelId,
        values: slot.values,
      },
    ];
  });
  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 grid w-full max-w-6xl grid-cols-1 gap-2 px-2 pb-6 md:grid-cols-2 lg:grid-cols-3">
      {panels.map((slot) => (
        <SlotControlPanel
          key={slot.id}
          slot={slot}
          pedal={pedal}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
