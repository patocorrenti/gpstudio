import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ConnectDialogApi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openConnect: () => void;
};

const ConnectDialogContext = createContext<ConnectDialogApi | null>(null);

export function ConnectDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({
      open,
      setOpen,
      openConnect: () => setOpen(true),
    }),
    [open],
  );
  return (
    <ConnectDialogContext.Provider value={value}>
      {children}
    </ConnectDialogContext.Provider>
  );
}

export function useConnectDialog(): ConnectDialogApi {
  const api = useContext(ConnectDialogContext);
  if (!api) {
    throw new Error("useConnectDialog must be used within ConnectDialogProvider");
  }
  return api;
}
