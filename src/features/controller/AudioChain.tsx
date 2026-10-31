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
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, Ellipsis } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { DeviceModel } from "@/device/models";
import {
  chainSlotBypassed,
  chainSlotLabel,
  isEffectSlot,
  isMovableEffect,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
  type EffectId,
  type StompAssignment,
} from "@/device/session";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";
import { ChainSlotIcon } from "@/features/controller/ChainSlotIcon";
import { SlotStompMark } from "@/features/controller/StompAssignment";
import { cn } from "@/lib/utils";

/** Cable through the icon: pt-1.5 + grip h-3 + gap-2 + half of size-14. */
const CHAIN_CABLE_TOP = "calc(3.375rem + 1px)";
/** Mobile: taller top (pt-3 + grip h-5 + gap-2.5 + half icon). */
const CHAIN_CABLE_TOP_MOBILE = "calc(4.375rem + 1px)";

function slotClassName(enabled: boolean, highlighted: boolean): string {
  return cn(
    "relative flex min-w-18 flex-col items-center gap-2 rounded-lg px-2 pt-3 pb-4 text-center transition-[background-color,box-shadow] duration-150 max-md:min-w-20 max-md:gap-2.5 md:pt-1.5 md:pb-2",
    enabled ? "bg-muted text-foreground dark:bg-muted/40" : "text-muted-foreground",
    enabled &&
      highlighted &&
      "bg-muted/90 shadow-[inset_0_0_0_1px] shadow-foreground/12 dark:bg-muted/55 dark:shadow-foreground/18",
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
  highlighted,
  onHoverSlot,
  onRevealSlot,
}: {
  slot: AudioChainSlot;
  chain: AudioChain;
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  highlighted: boolean;
  onHoverSlot?: (id: ChainSlotId | null) => void;
  onRevealSlot?: (id: EffectId) => void;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const bypassed = chainSlotBypassed(chain, slot.id);
  const power = slot.enabled ? "on" : "off";
  const effectId = isEffectSlot(slot.id) ? slot.id : null;
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
      className={cn(slotClassName(slot.enabled, highlighted), sortable && "cursor-grab")}
      onPointerEnter={() => {
        if (!slot.enabled) {
          return;
        }
        onHoverSlot?.(slot.id);
      }}
      onPointerLeave={() => onHoverSlot?.(null)}
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
          "relative z-10 flex h-5 w-full items-center justify-center md:h-3",
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
          "pointer-events-none absolute z-[1] hidden h-0.5 bg-muted-foreground/15 transition-opacity md:block",
          isDragging && "opacity-0",
          isFirst ? "left-[-0.75rem]" : "left-[-0.25rem]",
          isLast ? "right-[-0.75rem]" : "right-[-0.25rem]",
        )}
        style={{ top: CHAIN_CABLE_TOP }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-[1] h-0.5 bg-muted-foreground/15 transition-opacity md:hidden",
          isDragging && "opacity-0",
          isFirst ? "left-[-0.75rem]" : "left-[-0.25rem]",
          isLast ? "right-[-0.75rem]" : "right-[-0.25rem]",
        )}
        style={{ top: CHAIN_CABLE_TOP_MOBILE }}
      />
      <div className="relative flex min-h-6 w-full flex-col items-center justify-center">
        <div className={cn("relative", slot.enabled ? "z-10" : "z-0")}>
          {onRevealSlot && slot.enabled && !bypassed && effectId !== null ? (
            <button
              type="button"
              className="relative cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-events-none md:cursor-grab"
              aria-label={`Show ${label} controls`}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (window.matchMedia("(min-width: 768px)").matches) {
                  return;
                }
                onRevealSlot(effectId);
              }}
            >
              <ChainSlotIcon id={slot.id} enabled={slot.enabled} />
            </button>
          ) : (
            <>
              <ChainSlotIcon id={slot.id} enabled={slot.enabled} />
              {bypassed ? (
                <span
                  className="pointer-events-none absolute inset-0 z-10 flex translate-y-[3px] items-center justify-center"
                  aria-hidden="true"
                >
                  <Ban
                    className={cn(
                      "size-11 drop-shadow-sm",
                      slot.enabled
                        ? "text-destructive"
                        : "text-muted-foreground/35",
                    )}
                    strokeWidth={2.5}
                  />
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <Switch
        size="sm"
        checked={slot.enabled}
        disabled={disabled}
        className={cn(
          "relative z-10 hidden md:inline-flex",
          "data-checked:bg-primary/45 data-unchecked:bg-foreground/20 dark:data-unchecked:bg-muted-foreground/45 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-primary-foreground",
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
      <Switch
        size="default"
        checked={slot.enabled}
        disabled={disabled}
        className={cn(
          "relative z-10 mt-3 md:hidden",
          "data-checked:bg-primary/45 data-unchecked:bg-foreground/20 dark:data-unchecked:bg-muted-foreground/45 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-primary-foreground",
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
  hoveredSlot = null,
  onHoverSlot,
  onRevealSlot,
}: {
  chain: AudioChain;
  stomps: StompAssignment;
  pedal: DeviceModel;
  disabled: boolean;
  hoveredSlot?: ChainSlotId | null;
  onHoverSlot?: (id: ChainSlotId | null) => void;
  onRevealSlot?: (id: EffectId) => void;
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
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div className="w-full overflow-x-auto pb-3 md:pb-0">
          <ol
            aria-label="Audio chain"
            className="mx-auto flex w-max min-w-full items-center justify-center gap-2 px-3"
          >
            {chain.map((slot, index) => (
              <li key={slot.id} className="shrink-0 overflow-visible">
                <AudioChainSlotView
                  slot={slot}
                  chain={chain}
                  stomps={stomps}
                  pedal={pedal}
                  disabled={disabled}
                  isFirst={index === 0}
                  isLast={index === chain.length - 1}
                  highlighted={slot.enabled && hoveredSlot === slot.id}
                  onHoverSlot={onHoverSlot}
                  onRevealSlot={onRevealSlot}
                />
              </li>
            ))}
          </ol>
        </div>
      </SortableContext>
    </DndContext>
  );
}
