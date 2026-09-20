import type { ReactNode } from "react";
import { Unplug } from "lucide-react";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";

export function NoPedalsConnected() {
  const { openConnect } = useConnectDialog();

  return (
    <button
      type="button"
      className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
      aria-haspopup="dialog"
      aria-label="Connect a pedal"
      onClick={openConnect}
    >
      <Unplug className="size-8" aria-hidden />
      <div>
        <div>No pedals connected</div>
        <div className="text-xs text-muted-foreground">
          Connect a <span className="text-foreground">Valeton GP5 or GP50</span>
        </div>
      </div>
    </button>
  );
}

export function RequirePedal({ children }: { children: ReactNode }) {
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== "connected") {
    return <NoPedalsConnected />;
  }
  return children;
}
