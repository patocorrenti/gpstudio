import { RefreshCw } from "lucide-react";
import type { DeviceModel } from "@/device/models";
import type { AudioChain, StompAssignment } from "@/device/session";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";
import { AudioChainRow } from "@/features/controller/AudioChain";
import { PatchBar } from "@/features/controller/PatchBar";
import { PatchBodySkeleton } from "@/features/controller/PatchBodySkeleton";
import { PedalWelcome } from "@/features/controller/PedalWelcome";
import { SlotControlPanels } from "@/features/controller/SlotControls";

function PatchBody({
  chain,
  stomps,
  pedal,
  busy,
}: {
  chain: AudioChain;
  stomps: StompAssignment;
  pedal: DeviceModel;
  busy: boolean;
}) {
  return (
    <div className="relative mt-6 flex min-h-40 w-full flex-1 flex-col items-center">
      {busy ? (
        <PatchBodySkeleton pedal={pedal} />
      ) : (
        <div className="flex w-full flex-col items-center">
          <AudioChainRow
            chain={chain}
            stomps={stomps}
            pedal={pedal}
            disabled={busy}
          />
          <SlotControlPanels chain={chain} pedal={pedal} disabled={busy} />
        </div>
      )}
    </div>
  );
}

function SyncingController() {
  return (
    <section
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3"
    >
      <RefreshCw className="size-8 animate-spin text-muted-foreground" aria-hidden />
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
    <section className="flex w-full flex-1 flex-col items-center">
      <PatchBar
        patch={snapshot.patch}
        patchNames={snapshot.patchNames}
        busy={snapshot.chainSync === "syncing"}
        canExportPatch={snapshot.canExportPatch}
        modified={snapshot.modified}
        model={snapshot.model}
        patchVolume={snapshot.patchVolume}
        patchBpm={snapshot.patchBpm}
      />
      <PatchBody
        chain={snapshot.chain}
        stomps={snapshot.stomps}
        pedal={snapshot.model}
        busy={snapshot.chainSync === "syncing"}
      />
    </section>
  );
}

export function ControllerPage() {
  return (
    <RequirePedal fallback={<PedalWelcome />}>
      <ConnectedController />
    </RequirePedal>
  );
}
