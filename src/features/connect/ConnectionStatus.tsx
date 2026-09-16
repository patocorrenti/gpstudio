import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import gp5Thumb from "@/assets/img/gp5-thumb.png";
import gp50Thumb from "@/assets/img/gp50-thumb.png";
import type { LinkEndpoint } from "@/device/endpoint";
import type { LinkMode } from "@/device/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import type { BluetoothEndpoint } from "@/bluetooth/types";
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

function linkModeLabel(linkMode: LinkMode): string {
  return linkMode === "bluetooth" ? "Bluetooth" : "USB";
}

function pedalThumbSrc(model: DeviceModel | undefined): string | undefined {
  if (model === "gp5") {
    return gp5Thumb;
  }
  if (model === "gp50") {
    return gp50Thumb;
  }
  return undefined;
}

function PedalThumb({ model }: { model?: DeviceModel }) {
  const src = pedalThumbSrc(model);
  return (
    <span
      aria-hidden
      className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted ring-foreground/10"
    >
      {src ? (
        <img src={src} alt="" className="size-full object-contain p-1" />
      ) : null}
    </span>
  );
}

export function ConnectionStatus() {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const [open, setOpen] = useState(false);
  const [linkTab, setLinkTab] = useState<LinkMode>("usb");
  const [usbEndpoints, setUsbEndpoints] = useState<MidiEndpoint[]>([]);
  const [bleEndpoints, setBleEndpoints] = useState<BluetoothEndpoint[]>([]);
  const [pending, setPending] = useState<LinkEndpoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = snapshot.status === "connected";
  const askingModel = pending !== null && !connected;

  async function scanUsb() {
    setBusy(true);
    setError(null);
    try {
      const list = await session.discover();
      setUsbEndpoints(list);
    } catch (cause) {
      setUsbEndpoints([]);
      setError(
        cause instanceof Error ? cause.message : "Could not list USB devices.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function scanBluetooth(interactive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const list = await session.discoverBluetooth({ interactive });
      setBleEndpoints(list);
    } catch (cause) {
      setBleEndpoints([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not list Bluetooth pedals.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || connected || linkTab !== "usb") {
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    void session
      .discover()
      .then((list) => {
        if (!cancelled) {
          setUsbEndpoints(list);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setUsbEndpoints([]);
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
  }, [open, connected, linkTab, session]);

  async function connectWith(endpoint: LinkEndpoint, model: DeviceModel) {
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

  function pickDevice(endpoint: LinkEndpoint) {
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
      setLinkTab("usb");
      await scanUsb();
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
          if (next) {
            setLinkTab("usb");
          } else {
            setPending(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {snapshot.status === "connected" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connected</DialogTitle>
                <DialogDescription>
                  {linkModeLabel(snapshot.linkMode)} ·{" "}
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-col gap-2 py-3"
                  disabled={busy}
                  onClick={() => void connectWith(pending, "gp5")}
                >
                  <PedalThumb model="gp5" />
                  GP-5
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-col gap-2 py-3"
                  disabled={busy}
                  onClick={() => void connectWith(pending, "gp50")}
                >
                  <PedalThumb model="gp50" />
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
              </DialogHeader>
              <Tabs
                value={linkTab}
                onValueChange={(value) => {
                  if (value !== "usb" && value !== "bluetooth") {
                    return;
                  }
                  setError(null);
                  setLinkTab(value);
                  if (value === "bluetooth" && bleEndpoints.length === 0) {
                    void scanBluetooth(true);
                  }
                }}
                className="gap-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="usb">USB</TabsTrigger>
                  <TabsTrigger value="bluetooth">Bluetooth</TabsTrigger>
                </TabsList>
                <TabsContent value="usb" className="flex flex-col gap-4">
                  <DialogDescription className="text-center">
                    One-way connection - super fast.
                  </DialogDescription>
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                  {busy && usbEndpoints.length === 0 && !error ? (
                    <p className="text-sm text-muted-foreground">
                      Looking for USB devices…
                    </p>
                  ) : null}
                  {!busy && usbEndpoints.length === 0 && !error ? (
                    <div
                      role="status"
                      className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                    >
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <p>
                        No USB devices found. Connect the pedal and try again.
                      </p>
                    </div>
                  ) : null}
                  {usbEndpoints.length > 0 ? (
                    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                      {usbEndpoints.map((endpoint) => (
                        <li key={endpoint.id}>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto w-full justify-start gap-3 py-2 pl-2"
                            disabled={busy}
                            onClick={() => pickDevice(endpoint)}
                          >
                            <PedalThumb model={endpoint.suggestedModel} />
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
                </TabsContent>
                <TabsContent value="bluetooth" className="flex flex-col gap-4">
                  <DialogDescription className="text-center">
                    Two-way connection - slower.
                  </DialogDescription>
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                  {busy && bleEndpoints.length === 0 && !error ? (
                    <p className="text-sm text-muted-foreground">
                      Looking for Bluetooth pedals…
                    </p>
                  ) : null}
                  {!busy && bleEndpoints.length === 0 && !error ? (
                    <div
                      role="status"
                      className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                    >
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <p>
                        No Bluetooth pedals found.<br />
                        Put the pedal in pairing mode and refresh.
                      </p>
                    </div>
                  ) : null}
                  {bleEndpoints.length > 0 ? (
                    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                      {bleEndpoints.map((endpoint) => (
                        <li key={endpoint.id}>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-auto w-full justify-start gap-3 py-2 pl-2"
                            disabled={busy}
                            onClick={() => pickDevice(endpoint)}
                          >
                            <PedalThumb model={endpoint.suggestedModel} />
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
                </TabsContent>
              </Tabs>
              {linkTab === "usb" || linkTab === "bluetooth" ? (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void (linkTab === "usb"
                        ? scanUsb()
                        : scanBluetooth(true))
                    }
                  >
                    Refresh
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
