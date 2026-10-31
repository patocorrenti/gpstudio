import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ConnectDialogApi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openConnect: () => void;
  registerConnectOpener: (opener: () => void) => () => void;
};

const ConnectDialogContext = createContext<ConnectDialogApi | null>(null);

export function ConnectDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<(() => void) | null>(null);
  const registerConnectOpener = useCallback((opener: () => void) => {
    openerRef.current = opener;
    return () => {
      if (openerRef.current === opener) {
        openerRef.current = null;
      }
    };
  }, []);
  const openConnect = useCallback(() => {
    if (openerRef.current) {
      openerRef.current();
      return;
    }
    setOpen(true);
  }, []);
  const value = useMemo(
    () => ({
      open,
      setOpen,
      openConnect,
      registerConnectOpener,
    }),
    [open, openConnect, registerConnectOpener],
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
