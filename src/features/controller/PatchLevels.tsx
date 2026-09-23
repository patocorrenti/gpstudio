import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DeviceModel } from "@/device/models";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { useState } from "react";

function LevelSlider({
  label,
  ariaLabel,
  min,
  max,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  ariaLabel: string;
  min: number;
  max: number;
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const tip = value === null ? "—" : String(value);

  return (
    <div className="flex w-32 items-center gap-1.5">
      <span className="w-9 shrink-0 text-sm text-foreground/70">{label}</span>
      <TooltipProvider delayDuration={0}>
        <Tooltip open={dragging || undefined}>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">
              <Slider
                className="w-full"
                min={min}
                max={max}
                step={1}
                value={[value ?? min]}
                disabled={disabled || value === null}
                aria-label={ariaLabel}
                onValueChange={(next) => {
                  const nextValue = next[0];
                  if (nextValue === undefined || value === null) {
                    return;
                  }
                  setDragging(true);
                  onChange(nextValue);
                }}
                onValueCommit={(next) => {
                  const nextValue = next[0];
                  setDragging(false);
                  if (nextValue === undefined || value === null) {
                    return;
                  }
                  onCommit(nextValue);
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="tabular-nums">
            {tip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function PatchLevels({
  model,
  volume,
  bpm,
  disabled,
}: {
  model: DeviceModel;
  volume: number | null;
  bpm: number | null;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  return (
    <div className="ml-2 flex flex-wrap items-center justify-center gap-3">
      <LevelSlider
        label="P-Vol"
        ariaLabel="Patch volume"
        min={0}
        max={100}
        value={volume}
        disabled={disabled}
        onChange={(value) => {
          void session.setPatchVolume(value);
        }}
        onCommit={(value) => {
          void session.setPatchVolume(value, { flush: true });
        }}
      />
      {model === "gp50" ? (
        <LevelSlider
          label="BPM"
          ariaLabel="BPM"
          min={40}
          max={260}
          value={bpm}
          disabled={disabled}
          onChange={(value) => {
            void session.setPatchBpm(value);
          }}
          onCommit={(value) => {
            void session.setPatchBpm(value, { flush: true });
          }}
        />
      ) : null}
    </div>
  );
}
