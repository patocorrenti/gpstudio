import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  chainSlotLabel,
  formatPatch,
  formatPatchOption,
  PATCH_COUNT,
  type AudioChain,
  type AudioChainSlot,
} from "@/device/session";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { cn } from "@/lib/utils";

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
    "min-w-14 rounded-lg border px-3 py-2 text-center text-sm font-semibold tracking-wide",
    enabled
      ? "border-foreground/20 bg-muted text-foreground"
      : "border-border text-muted-foreground opacity-50",
  );
}

function AudioChainSlotView({
  slot,
  disabled,
}: {
  slot: AudioChainSlot;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const label = chainSlotLabel(slot.id);
  const state = slot.enabled ? "on" : "off";

  if (slot.id === "exp") {
    return (
      <div aria-label={`${label} ${state}`} className={slotClassName(slot.enabled)}>
        {label}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${label} ${state}`}
      aria-pressed={slot.enabled}
      className={slotClassName(slot.enabled)}
      disabled={disabled}
      onClick={() => {
        void session.toggleChainSlot(slot.id);
      }}
    >
      {label}
    </button>
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
          <AudioChainSlotView slot={slot} disabled={disabled} />
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
