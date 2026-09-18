import { Ban, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  chainSlotBypassed,
  chainSlotLabel,
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
} from "@/device/session";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center justify-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Previous patch"
        onClick={() => void session.stepPatch(-1)}
      >
        <ChevronLeft />
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
          className="h-auto min-w-40 justify-center py-2.5 text-2xl font-semibold tabular-nums"
        >
          <SelectValue>
            {currentName ? formatPatchOption(patch, currentName) : formatPatch(patch)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72 min-w-40">
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
        onClick={() => void session.stepPatch(1)}
      >
        <ChevronRight />
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
}: {
  slot: AudioChainSlot;
  chain: AudioChain;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const icon = CHAIN_SLOT_ICONS[slot.id];
  const bypassed = chainSlotBypassed(chain, slot.id);
  const power = slot.enabled ? "on" : "off";

  return (
    <div className={slotClassName(slot.enabled)}>
      <div className="relative flex min-h-6 w-full flex-col items-center justify-center gap-1">
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
        className="data-checked:bg-primary/45 data-unchecked:bg-foreground/20 dark:data-unchecked:bg-input/80 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-muted-foreground"
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
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {chain.map((slot, index) => (
        <li key={`${slot.id}-${index}`}>
          <AudioChainSlotView slot={slot} chain={chain} disabled={disabled} />
        </li>
      ))}
    </ol>
  );
}

function PatchBody({
  chain,
  busy,
}: {
  chain: AudioChain;
  busy: boolean;
}) {
  return (
    <div className="relative mt-10 flex min-h-40 w-full flex-1 flex-col items-center">
      <div
        className={cn("flex w-full justify-center", busy && "invisible")}
        aria-hidden={busy}
      >
        <AudioChainRow chain={chain} disabled={busy} />
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
      <PatchBody chain={snapshot.chain} busy={snapshot.chainSync === "syncing"} />
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
