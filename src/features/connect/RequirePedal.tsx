import type { ReactNode } from "react";
import { Unplug } from "lucide-react";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";

export function NoPedalsConnected() {
  return (
    <section
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3"
    >
      <Unplug className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">No pedals connected</p>
    </section>
  );
}

export function RequirePedal({ children }: { children: ReactNode }) {
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== "connected") {
    return <NoPedalsConnected />;
  }
  return children;
}
