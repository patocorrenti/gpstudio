import { Loader2 } from "lucide-react";
import type { DeviceModel } from "@/device/models";
import type { AudioChain } from "@/device/session";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { AudioChainRow } from "@/features/controller/AudioChain";
import { PatchBar } from "@/features/controller/PatchBar";
import { SlotControlPanels } from "@/features/controller/SlotControls";
import { cn } from "@/lib/utils";

function PatchBody({
  chain,
  pedal,
  busy,
}: {
  chain: AudioChain;
  pedal: DeviceModel;
  busy: boolean;
}) {
  return (
    <div className="relative mt-6 flex min-h-40 w-full flex-1 flex-col items-center">
      <div
        className={cn("flex w-full flex-col items-center", busy && "invisible")}
        aria-hidden={busy}
      >
        <AudioChainRow chain={chain} disabled={busy} />
        <SlotControlPanels chain={chain} pedal={pedal} disabled={busy} />
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
      <PatchBar
        patch={snapshot.patch}
        patchNames={snapshot.patchNames}
        busy={snapshot.chainSync === "syncing"}
        canExportPatch={snapshot.canExportPatch}
      />
      <PatchBody
        chain={snapshot.chain}
        pedal={snapshot.model}
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
