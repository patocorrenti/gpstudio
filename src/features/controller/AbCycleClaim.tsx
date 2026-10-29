import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CycleId = "patch" | "module";
type StopFn = () => void;

type AbCycleClaimValue = {
  moduleOpen: boolean;
  setModuleOpen: (open: boolean) => void;
  registerStop: (id: CycleId, stop: StopFn | null) => void;
  stopOther: (id: CycleId) => void;
};

const AbCycleClaimContext = createContext<AbCycleClaimValue | null>(null);

export function AbCycleClaimProvider({ children }: { children: ReactNode }) {
  const stops = useRef<Record<CycleId, StopFn | null>>({ patch: null, module: null });
  const [moduleOpen, setModuleOpen] = useState(false);
  const api = useRef({
    registerStop(id: CycleId, stop: StopFn | null) {
      stops.current[id] = stop;
    },
    stopOther(id: CycleId) {
      const other: CycleId = id === "patch" ? "module" : "patch";
      stops.current[other]?.();
    },
  });
  const value = useMemo<AbCycleClaimValue>(
    () => ({
      moduleOpen,
      setModuleOpen,
      registerStop: api.current.registerStop,
      stopOther: api.current.stopOther,
    }),
    [moduleOpen],
  );

  return (
    <AbCycleClaimContext.Provider value={value}>{children}</AbCycleClaimContext.Provider>
  );
}

export function useAbCycleClaim(): AbCycleClaimValue {
  const value = useContext(AbCycleClaimContext);
  if (!value) {
    throw new Error("Patch A/B and module A/B share a Controller claim.");
  }
  return value;
}
