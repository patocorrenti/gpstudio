import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { displayModelName, type DeviceModel } from "@/device/models";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import type { MidiEndpoint } from "@/midi/types";

function compactName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function connectedDetail(label: string, model: DeviceModel): string {
  const modelName = displayModelName(model);
  if (compactName(label) === compactName(modelName)) {
    return modelName;
  }
  return `${label} · ${modelName}`;
}

export function ConnectionStatus() {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const [open, setOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<MidiEndpoint[]>([]);
  const [pending, setPending] = useState<MidiEndpoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = snapshot.status === "connected";
  const askingModel = pending !== null && !connected;

  async function scan() {
    setBusy(true);
    setError(null);
    try {
      const list = await session.discover();
      setEndpoints(list);
    } catch (cause) {
      setEndpoints([]);
      setError(
        cause instanceof Error ? cause.message : "Could not list USB devices.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || connected) {
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    void session
      .discover()
      .then((list) => {
        if (!cancelled) {
          setEndpoints(list);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setEndpoints([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not list USB devices.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, connected, session]);

  async function connectWith(endpoint: MidiEndpoint, model: DeviceModel) {
    setBusy(true);
    setError(null);
    try {
      await session.connect(endpoint, model);
      setPending(null);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }

  function pickDevice(endpoint: MidiEndpoint) {
    if (endpoint.suggestedModel) {
      void connectWith(endpoint, endpoint.suggestedModel);
      return;
    }
    setPending(endpoint);
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await session.disconnect();
      setPending(null);
      await scan();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setBusy(false);
    }
  }

  const label = connected ? snapshot.endpoint.label : "Connect";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={connected ? `Connected to ${label}` : "Connect a pedal"}
        onClick={() => setOpen(true)}
      >
        <span
          aria-hidden
          className={
            connected
              ? "size-2 rounded-full bg-emerald-500"
              : "size-2 rounded-full bg-muted-foreground/50"
          }
        />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPending(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {connected ? (
            <>
              <DialogHeader>
                <DialogTitle>Connected</DialogTitle>
                <DialogDescription>
                  {connectedDetail(snapshot.endpoint.label, snapshot.model)}
                </DialogDescription>
              </DialogHeader>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  Disconnect
                </Button>
              </DialogFooter>
            </>
          ) : askingModel && pending ? (
            <>
              <DialogHeader>
                <DialogTitle>Select model</DialogTitle>
                <DialogDescription>
                  {pending.label} did not identify as GP-5 or GP-50. Choose the
                  pedal before connecting.
                </DialogDescription>
              </DialogHeader>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void connectWith(pending, "gp5")}
                >
                  GP-5
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void connectWith(pending, "gp50")}
                >
                  GP-50
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Connect</DialogTitle>
                <DialogDescription>
                  Connect the pedal to your computer via USB.
                  <br />
                  Bluetooth is not supported yet.
                </DialogDescription>
              </DialogHeader>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {busy && endpoints.length === 0 && !error ? (
                <p className="text-sm text-muted-foreground">Looking for USB devices…</p>
              ) : null}
              {!busy && endpoints.length === 0 && !error ? (
                <div
                  role="status"
                  className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>No USB devices found. Connect the pedal and try again.</p>
                </div>
              ) : null}
              {endpoints.length > 0 ? (
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {endpoints.map((endpoint) => (
                    <li key={endpoint.id}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start py-2"
                        disabled={busy}
                        onClick={() => pickDevice(endpoint)}
                      >
                        <span className="flex flex-col items-start text-left">
                          <span>{endpoint.label}</span>
                          {endpoint.suggestedModel ? (
                            <span className="text-xs text-muted-foreground">
                              {displayModelName(endpoint.suggestedModel)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Model unknown
                            </span>
                          )}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void scan()}
                >
                  Refresh
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
