import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DeviceSession } from "@/device/session";

const DeviceSessionContext = createContext<DeviceSession | null>(null);

let sharedSession: DeviceSession | undefined;

function getSharedSession(): DeviceSession {
  sharedSession ??= new DeviceSession();
  return sharedSession;
}

export function DeviceSessionProvider({ children }: { children: ReactNode }) {
  const session = getSharedSession();
  return (
    <DeviceSessionContext.Provider value={session}>
      {children}
    </DeviceSessionContext.Provider>
  );
}

export function useDeviceSession(): DeviceSession {
  const session = useContext(DeviceSessionContext);
  if (!session) {
    throw new Error("useDeviceSession must be used within DeviceSessionProvider");
  }
  return session;
}

export function useSessionSnapshot() {
  const session = useDeviceSession();
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
}

export function useInboundLog() {
  const session = useDeviceSession();
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getInboundLog(),
    () => session.getInboundLog(),
  );
}
