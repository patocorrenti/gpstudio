import { Button } from "@/components/ui/button";
import {
  EFFECT_IDS,
  chainSlotLabel,
  type EffectId,
  type StompAssignment,
} from "@/device/session";
import type { DeviceModel } from "@/device/models";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { cn } from "@/lib/utils";

function StompColumn({
  label,
  stompIndex,
  assigned,
  disabled,
  onToggle,
}: {
  label: string;
  stompIndex: number;
  assigned: readonly EffectId[];
  disabled: boolean;
  onToggle: (stompIndex: number, effect: EffectId, next: boolean) => void;
}) {
  const assignedSet = new Set(assigned);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {EFFECT_IDS.map((effect) => {
          const on = assignedSet.has(effect);
          return (
            <Button
              key={effect}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              disabled={disabled}
              aria-pressed={on}
              aria-label={`${label}: ${chainSlotLabel(effect)}`}
              className={cn("h-8 min-w-12 px-2 tabular-nums", on && "shadow-none")}
              onClick={() => onToggle(stompIndex, effect, !on)}
            >
              {chainSlotLabel(effect)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function StompAssignmentPanel({
  stomps,
  pedal,
  disabled,
}: {
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const labels =
    pedal === "gp50" ? (["Footswitch A", "Footswitch B"] as const) : (["Stomp"] as const);

  return (
    <section
      className="mt-6 w-full max-w-3xl px-2"
      aria-label="Stomp assignment"
    >
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Stomp assignment
      </h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {labels.map((label, index) => (
          <StompColumn
            key={label}
            label={label}
            stompIndex={index}
            assigned={stomps[index] ?? []}
            disabled={disabled}
            onToggle={(stompIndex, effect, next) => {
              void session.setStompAssignment(stompIndex, effect, next);
            }}
          />
        ))}
      </div>
    </section>
  );
}
