import type { DeviceModel } from "@/device/models";
import {
  chainSlotLabel,
  type EffectId,
  type StompAssignment,
} from "@/device/session";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { cn } from "@/lib/utils";

const MAX_EFFECTS_PER_STOMP = 3;

/** Which foot owns this effect for display. A wins if present on both. */
export function stompMarkForEffect(
  stomps: StompAssignment,
  effect: EffectId,
  pedal: DeviceModel,
): "off" | "on" | "A" | "B" {
  const onA = stomps[0]?.includes(effect) ?? false;
  if (pedal === "gp5") {
    return onA ? "on" : "off";
  }
  if (onA) {
    return "A";
  }
  if (stomps[1]?.includes(effect)) {
    return "B";
  }
  return "off";
}

function footHasRoom(stomps: StompAssignment, stompIndex: number): boolean {
  return (stomps[stompIndex]?.length ?? 0) < MAX_EFFECTS_PER_STOMP;
}

function stompMarkTooltip(
  mark: "off" | "on" | "A" | "B",
  pedal: DeviceModel,
): string {
  if (pedal === "gp5") {
    return mark === "off" ? "Assign to stomp" : "Assigned to stomp";
  }
  if (mark === "A") {
    return "Footswitch A";
  }
  if (mark === "B") {
    return "Footswitch B";
  }
  return "Assign to footswitch";
}

/**
 * GP-5: empty ↔ filled. GP-50: off → A → B → off (exclusive per effect).
 */
export async function cycleSlotStomp(
  setStompAssignment: (
    stompIndex: number,
    effect: EffectId,
    assigned: boolean,
  ) => Promise<void>,
  stomps: StompAssignment,
  effect: EffectId,
  pedal: DeviceModel,
): Promise<void> {
  const mark = stompMarkForEffect(stomps, effect, pedal);
  if (pedal === "gp5") {
    if (mark === "off") {
      if (!footHasRoom(stomps, 0)) {
        return;
      }
      await setStompAssignment(0, effect, true);
      return;
    }
    await setStompAssignment(0, effect, false);
    return;
  }

  if (mark === "off") {
    if (!footHasRoom(stomps, 0)) {
      return;
    }
    await setStompAssignment(0, effect, true);
    return;
  }
  if (mark === "A") {
    const onBAlready = stomps[1]?.includes(effect) ?? false;
    if (onBAlready) {
      await setStompAssignment(0, effect, false);
      return;
    }
    if (!footHasRoom(stomps, 1)) {
      return;
    }
    await setStompAssignment(0, effect, false);
    await setStompAssignment(1, effect, true);
    return;
  }
  await setStompAssignment(1, effect, false);
}

export function SlotStompMark({
  effect,
  stomps,
  pedal,
  disabled,
}: {
  effect: EffectId;
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const mark = stompMarkForEffect(stomps, effect, pedal);
  const filled = mark !== "off";
  const label = chainSlotLabel(effect);
  const aria =
    pedal === "gp5"
      ? filled
        ? `${label} assigned to stomp`
        : `${label} not assigned to stomp`
      : mark === "A"
        ? `${label} assigned to footswitch A`
        : mark === "B"
          ? `${label} assigned to footswitch B`
          : `${label} not assigned to a footswitch`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={aria}
            aria-pressed={filled}
            className={cn(
              "absolute top-1 right-1 z-20 flex size-4 cursor-pointer items-center justify-center rounded-full border text-[0.8rem] font-bold leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              filled
                ? "border-primary bg-primary text-primary-foreground opacity-70"
                : "border-muted-foreground/45 bg-background text-transparent",
              disabled && "pointer-events-none opacity-50",
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (disabled) {
                return;
              }
              void cycleSlotStomp(
                (stompIndex, id, assigned) =>
                  session.setStompAssignment(stompIndex, id, assigned),
                stomps,
                effect,
                pedal,
              );
            }}
          >
            {mark === "A" || mark === "B" ? mark : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{stompMarkTooltip(mark, pedal)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
