import { Ban, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import iconAmp from "@/assets/img/icon-AMP.png";
import iconCab from "@/assets/img/icon-CAB.png";
import iconDly from "@/assets/img/icon-DLY.png";
import iconDst from "@/assets/img/icon-DST.png";
import iconEq from "@/assets/img/icon-EQ.png";
import iconMod from "@/assets/img/icon-MOD.png";
import iconNr from "@/assets/img/icon-NR.png";
import iconNs from "@/assets/img/icon-NS.png";
import iconPre from "@/assets/img/icon-PRE.png";
import iconRvb from "@/assets/img/icon-RVB.png";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EFFECT_IDS,
  STOMP_WRITE_SPIKES,
  assignmentToggle,
  chainSlotBypassed,
  chainSlotLabel,
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
  type AudioChain,
  type AudioChainSlot,
  type EffectId,
  type StompAssignment,
  type StompWriteSpikeId,
  type ChainSlotId,
} from "@/device/session";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { cn } from "@/lib/utils";

/** Distance from the top of each slot to the cable. py-3 + half of size-14 + 1px. */
const CHAIN_CABLE_TOP = "calc(2.5rem + 1px)";

const CHAIN_SLOT_ICONS: Partial<Record<ChainSlotId, string>> = {
  nr: iconNr,
  pre: iconPre,
  dst: iconDst,
  ns: iconNs,
  amp: iconAmp,
  cab: iconCab,
  eq: iconEq,
  mod: iconMod,
  dly: iconDly,
  rvb: iconRvb,
};

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

function PatchBar({
  patch,
  patchNames,
}: {
  patch: number;
  patchNames: (string | null)[];
}) {
  const session = useDeviceSession();
  const currentName = patchNames[patch];

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Previous patch"
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(-1)}
      >
        <ChevronLeft className="size-6" />
      </Button>
      <Select
        value={String(patch)}
        onValueChange={(value) => {
          void session.setPatch(Number.parseInt(value, 10));
        }}
      >
        <SelectTrigger
          aria-label="Select patch"
          size="default"
          className="h-12 min-h-12 w-72 min-w-72 justify-center border-transparent bg-muted py-0 text-xl font-semibold tabular-nums data-[size=default]:h-12 dark:border-transparent dark:bg-muted/40 dark:hover:bg-muted/50"
        >
          <SelectValue>
            {currentName ? formatPatchOption(patch, currentName) : formatPatch(patch)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72 min-w-72">
          {patchOptions.map((option) => (
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
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Next patch"
        className="size-12 bg-muted dark:bg-muted/40 dark:hover:bg-muted/50"
        onClick={() => void session.stepPatch(1)}
      >
        <ChevronRight className="size-6" />
      </Button>
    </div>
  );
}

function slotClassName(enabled: boolean): string {
  return cn(
    "relative flex min-w-18 flex-col items-center gap-2 rounded-lg px-3 py-3 text-center",
    enabled ? "bg-muted text-foreground dark:bg-muted/40" : "text-muted-foreground",
  );
}

function AudioChainSlotView({
  slot,
  chain,
  disabled,
  isFirst,
  isLast,
}: {
  slot: AudioChainSlot;
  chain: AudioChain;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const icon = CHAIN_SLOT_ICONS[slot.id];
  const bypassed = chainSlotBypassed(chain, slot.id);
  const power = slot.enabled ? "on" : "off";

  return (
    <div className={slotClassName(slot.enabled)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-0 h-0.5 bg-muted-foreground/25",
          isFirst ? "left-[-0.75rem]" : "left-[-0.25rem]",
          isLast ? "right-[-0.75rem]" : "right-[-0.25rem]",
        )}
        style={{ top: CHAIN_CABLE_TOP }}
      />
      <div className="relative z-10 flex min-h-6 w-full flex-col items-center justify-center gap-1">
        <div className="relative">
          {icon ? (
            <img
              src={icon}
              alt=""
              className={cn("size-14 object-contain", !slot.enabled && "opacity-50")}
            />
          ) : null}
          {bypassed ? (
            <span
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              aria-hidden="true"
            >
              <Ban className="size-11 text-destructive drop-shadow-sm" strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "text-xs font-semibold tracking-wide",
            !slot.enabled && "opacity-50",
          )}
        >
          {label}
        </span>
      </div>
      <Switch
        size="sm"
        checked={slot.enabled}
        disabled={disabled}
        className={cn(
          "relative z-10",
          "data-checked:bg-primary/45 data-unchecked:bg-foreground/20 dark:data-unchecked:bg-input/80 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-muted-foreground",
        )}
        aria-label={bypassed ? `${label} ${power}, bypassed` : `${label} ${power}`}
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

function AudioChainRow({
  chain,
  disabled,
}: {
  chain: AudioChain;
  disabled: boolean;
}) {
  return (
    <ol
      aria-label="Audio chain"
      className="flex flex-wrap items-center justify-center gap-2 overflow-visible"
    >
      {chain.map((slot, index) => (
        <li key={`${slot.id}-${index}`} className="overflow-visible">
          <AudioChainSlotView
            slot={slot}
            chain={chain}
            disabled={disabled}
            isFirst={index === 0}
            isLast={index === chain.length - 1}
          />
        </li>
      ))}
    </ol>
  );
}

function emptyLike(stomps: StompAssignment): StompAssignment {
  return stomps.map(() => []);
}

function StompAssignmentRow({
  index,
  assigned,
  disabled,
  onChange,
}: {
  index: number;
  assigned: EffectId[];
  disabled: boolean;
  onChange: (index: number, next: EffectId[]) => void;
}) {
  const selected = new Set(assigned);
  const label = `Stomp ${index + 1}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <ul
        aria-label={label}
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        {EFFECT_IDS.map((id) => {
          const on = selected.has(id);
          const moduleLabel = chainSlotLabel(id);
          return (
            <li key={id}>
              <Button
                type="button"
                size="xs"
                variant={on ? "default" : "outline"}
                disabled={disabled}
                aria-pressed={on}
                aria-label={`${label} ${moduleLabel} ${on ? "on" : "off"}`}
                onClick={() => {
                  const next = on
                    ? assigned.filter((item) => item !== id)
                    : [...assigned, id];
                  onChange(index, next);
                }}
              >
                {moduleLabel}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StompAssignmentSection({
  stomps,
  disabled,
}: {
  stomps: StompAssignment;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  return (
    <div className="mt-8 flex w-full flex-col items-center gap-6">
      {stomps.map((assigned, index) => (
        <StompAssignmentRow
          key={index}
          index={index}
          assigned={assigned}
          disabled={disabled}
          onChange={(stompIndex, next) => {
            void session.setStompAssignment(stompIndex, next);
          }}
        />
      ))}
    </div>
  );
}

function SpikeBlock({
  spike,
  assigned,
  disabled,
  onAssigned,
}: {
  spike: (typeof STOMP_WRITE_SPIKES)[number];
  assigned: StompAssignment;
  disabled: boolean;
  onAssigned: (id: StompWriteSpikeId, next: StompAssignment) => void;
}) {
  const session = useDeviceSession();
  return (
    <div className="rounded-lg border border-border px-3 py-3">
      <p className="text-center text-sm font-medium">{spike.title}</p>
      <p className="mt-0.5 text-center text-xs text-muted-foreground">{spike.hint}</p>
      <div className="mt-3 flex flex-col items-center gap-4">
        {assigned.map((stomp, index) => (
          <StompAssignmentRow
            key={index}
            index={index}
            assigned={stomp}
            disabled={disabled}
            onChange={(stompIndex, next) => {
              const previous = assigned[stompIndex] ?? [];
              const nextStomps = assigned.map((current, currentIndex) =>
                currentIndex === stompIndex ? next : current,
              );
              onAssigned(spike.id, nextStomps);
              const toggle = assignmentToggle(previous, next);
              void session.spikeStompWrite(
                spike.id,
                nextStomps,
                stompIndex,
                toggle?.id,
                toggle?.enabled,
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StompWriteSpikePanel({
  stomps,
  disabled,
}: {
  stomps: StompAssignment;
  disabled: boolean;
}) {
  const dumpKey = JSON.stringify(stomps);
  const [byId, setById] = useState<Partial<Record<StompWriteSpikeId, StompAssignment>>>(
    {},
  );

  useEffect(() => {
    setById({});
  }, [dumpKey]);

  const current = STOMP_WRITE_SPIKES.filter((spike) => !spike.retired);
  const retired = STOMP_WRITE_SPIKES.filter((spike) => spike.retired);

  return (
    <div className="mt-10 w-full max-w-3xl border-t border-dashed border-border pt-6">
      <h2 className="text-center text-sm font-semibold">Write spike</h2>
      <p className="mx-auto mt-1 max-w-xl text-center text-xs text-muted-foreground">
        This round is H7 (top). Assign then unassign DST on Stomp 1. Chips here do
        not change the dump row above.
      </p>
      <div className="mt-4 flex flex-col gap-5">
        {current.map((spike) => (
          <SpikeBlock
            key={spike.id}
            spike={spike}
            assigned={byId[spike.id] ?? emptyLike(stomps)}
            disabled={disabled}
            onAssigned={(id, next) => {
              setById((currentMap) => ({ ...currentMap, [id]: next }));
            }}
          />
        ))}
      </div>
      {retired.length > 0 ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-center text-xs text-muted-foreground">
            Previous candidates (ignored)
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            {retired.map((spike) => (
              <SpikeBlock
                key={spike.id}
                spike={spike}
                assigned={byId[spike.id] ?? emptyLike(stomps)}
                disabled={disabled}
                onAssigned={(id, next) => {
                  setById((currentMap) => ({ ...currentMap, [id]: next }));
                }}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PatchBody({
  chain,
  stomps,
  busy,
}: {
  chain: AudioChain;
  stomps: StompAssignment;
  busy: boolean;
}) {
  return (
    <div className="relative mt-4 flex min-h-40 w-full flex-1 flex-col items-center">
      <div
        className={cn("flex w-full flex-col items-center", busy && "invisible")}
        aria-hidden={busy}
      >
        <AudioChainRow chain={chain} disabled={busy} />
        <StompAssignmentSection stomps={stomps} disabled={busy} />
        <StompWriteSpikePanel stomps={stomps} disabled={busy} />
      </div>
      {busy ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background"
          role="status"
          aria-label="Syncing audio chain"
        >
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}

function SyncingController() {
  return (
    <section role="status" className="flex flex-1 flex-col items-center">
      <p className="text-muted-foreground">Syncing with the pedal…</p>
    </section>
  );
}

function ConnectedController() {
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== "connected") {
    return null;
  }
  if (snapshot.sync === "syncing") {
    return <SyncingController />;
  }

  return (
    <section className="flex flex-1 flex-col items-center">
      <PatchBar patch={snapshot.patch} patchNames={snapshot.patchNames} />
      <PatchBody
        chain={snapshot.chain}
        stomps={snapshot.stomps}
        busy={snapshot.chainSync === "syncing"}
      />
    </section>
  );
}

export function ControllerPage() {
  return (
    <RequirePedal>
      <ConnectedController />
    </RequirePedal>
  );
}
