import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, Ellipsis } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { DeviceModel } from "@/device/models";
import {
  chainSlotBypassed,
  chainSlotLabel,
  isMovableEffect,
  type AudioChain,
  type AudioChainSlot,
  type EffectId,
  type StompAssignment,
} from "@/device/session";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { ChainSlotIcon } from "@/features/controller/ChainSlotIcon";
import { SlotStompMark } from "@/features/controller/StompAssignment";
import { cn } from "@/lib/utils";

/** Cable through the icon: pt-1.5 + grip h-3 + gap-2 + half of size-14. */
const CHAIN_CABLE_TOP = "calc(3.375rem + 1px)";

function slotClassName(enabled: boolean): string {
  return cn(
    "relative flex min-w-18 flex-col items-center gap-2 rounded-lg px-2 pt-1.5 pb-2 text-center",
    enabled ? "bg-muted text-foreground dark:bg-muted/40" : "text-muted-foreground",
  );
}

function AudioChainSlotView({
  slot,
  chain,
  stomps,
  pedal,
  disabled,
  isFirst,
  isLast,
}: {
  slot: AudioChainSlot;
  chain: AudioChain;
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const bypassed = chainSlotBypassed(chain, slot.id);
  const power = slot.enabled ? "on" : "off";
  const movable = isMovableEffect(slot.id);
  const sortable = movable && !disabled;
  const stompTarget = slot.id !== "exp";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: slot.id,
      disabled: !sortable,
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(slotClassName(slot.enabled), sortable && "cursor-grab")}
      {...(sortable ? attributes : {})}
      {...(sortable ? listeners : {})}
    >
      {stompTarget ? (
        <SlotStompMark
          effect={slot.id as EffectId}
          stomps={stomps}
          pedal={pedal}
          disabled={disabled}
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex h-3 w-full items-center justify-center",
          movable && !slot.enabled && "opacity-50",
        )}
        aria-hidden
      >
        {movable ? (
          <Ellipsis className="size-4 text-muted-foreground/70" />
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-[1] h-0.5 bg-muted-foreground/15 transition-opacity",
          isDragging && "opacity-0",
          isFirst ? "left-[-0.75rem]" : "left-[-0.25rem]",
          isLast ? "right-[-0.75rem]" : "right-[-0.25rem]",
        )}
        style={{ top: CHAIN_CABLE_TOP }}
      />
      <div className="relative flex min-h-6 w-full flex-col items-center justify-center">
        <div className={cn("relative", slot.enabled ? "z-10" : "z-0")}>
          <ChainSlotIcon id={slot.id} enabled={slot.enabled} />
          {bypassed ? (
            <span
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              aria-hidden="true"
            >
              <Ban className="size-11 text-destructive drop-shadow-sm" strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
      </div>
      <Switch
        size="sm"
        checked={slot.enabled}
        disabled={disabled}
        className={cn(
          "relative z-10",
          "data-checked:bg-primary/45 data-unchecked:bg-foreground/50 dark:data-unchecked:bg-input/80 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-muted-foreground",
        )}
        aria-label={bypassed ? `${label} ${power}, bypassed` : `${label} ${power}`}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onCheckedChange={(checked) => {
          if (checked === slot.enabled) {
            return;
          }
          void session.toggleChainSlot(slot.id);
        }}
      />
    </div>
  );
}

export function AudioChainRow({
  chain,
  stomps,
  pedal,
  disabled,
}: {
  chain: AudioChain;
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const ids = chain.map((slot) => slot.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const fromIndex = chain.findIndex((slot) => slot.id === active.id);
    const toIndex = chain.findIndex((slot) => slot.id === over.id);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    void session.reorderChain(fromIndex, toIndex);
  }

  return (
    <DndContext
      sensors={disabled ? [] : sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ol
          aria-label="Audio chain"
          className="flex flex-wrap items-center justify-center gap-2 overflow-visible"
        >
          {chain.map((slot, index) => (
            <li key={slot.id} className="overflow-visible">
              <AudioChainSlotView
                slot={slot}
                chain={chain}
                stomps={stomps}
                pedal={pedal}
                disabled={disabled}
                isFirst={index === 0}
                isLast={index === chain.length - 1}
              />
            </li>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
