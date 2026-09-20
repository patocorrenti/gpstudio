import { Skeleton } from "@/components/ui/skeleton";
import type { DeviceModel } from "@/device/models";

const EFFECT_SLOT_COUNT = 10;
const MODULE_CONTROL_COUNTS = [4, 3, 5] as const;

function ChainSlotSkeleton() {
  return <Skeleton className="h-[8.25rem] w-18 rounded-lg" />;
}

function ModulePanelSkeleton({ controls }: { controls: number }) {
  return (
    <div className="flex min-w-0 w-full flex-col gap-3 rounded-lg bg-muted/60 px-4 py-3 dark:bg-muted/30">
      <div className="flex items-center gap-3 pb-2">
        <Skeleton className="size-6 shrink-0" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-8 min-w-0 flex-1" />
      </div>
      {Array.from({ length: controls }, (_, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-8" />
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PatchBodySkeleton({ pedal }: { pedal: DeviceModel }) {
  const slotCount = pedal === "gp50" ? EFFECT_SLOT_COUNT + 1 : EFFECT_SLOT_COUNT;

  return (
    <div
      className="flex w-full flex-col items-center"
      role="status"
      aria-label="Loading patch"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {Array.from({ length: slotCount }, (_, index) => (
          <ChainSlotSkeleton key={index} />
        ))}
      </div>
      <div className="mt-6 grid w-full max-w-6xl grid-cols-1 gap-2 px-2 pb-6 md:grid-cols-2 lg:grid-cols-3">
        {MODULE_CONTROL_COUNTS.slice(0, 2).map((controls, index) => (
          <ModulePanelSkeleton key={index} controls={controls} />
        ))}
        <div className="hidden lg:block">
          <ModulePanelSkeleton controls={MODULE_CONTROL_COUNTS[2]} />
        </div>
      </div>
    </div>
  );
}
