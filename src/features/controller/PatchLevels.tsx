import { Slider } from "@/components/ui/slider";
import type { DeviceModel } from "@/device/models";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";

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
  return (
    <div className="flex w-40 items-center gap-1.5">
      <span className="w-9 shrink-0 text-sm text-foreground/70">{label}</span>
      <Slider
        className="min-w-0 flex-1"
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
          onChange(nextValue);
        }}
        onValueCommit={(next) => {
          const nextValue = next[0];
          if (nextValue === undefined || value === null) {
            return;
          }
          onCommit(nextValue);
        }}
      />
      <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums">
        {value === null ? "—" : value}
      </span>
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
