import { useEffect, useRef, useState } from "react";
import { Bluetooth, Usb } from "lucide-react";
import { toast } from "sonner";
import type { BluetoothEndpoint } from "@/bluetooth/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { LinkEndpoint } from "@/device/endpoint";
import type { LinkMode } from "@/device/link";
import type { DeviceModel } from "@/device/models";
import type { MidiEndpoint } from "@/midi/types";
import { ConnectedPanel } from "@/features/connect/ConnectedPanel";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";
import { ScanPanel } from "@/features/connect/ScanPanel";
import { SelectModelPanel } from "@/features/connect/SelectModelPanel";

export function ConnectionStatus() {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const { open, setOpen } = useConnectDialog();
  const [linkTab, setLinkTab] = useState<LinkMode>("usb");
  const [usbEndpoints, setUsbEndpoints] = useState<MidiEndpoint[]>([]);
  const [bleEndpoints, setBleEndpoints] = useState<BluetoothEndpoint[]>([]);
  const [pending, setPending] = useState<LinkEndpoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = snapshot.status === "connected";
  const askingModel = pending !== null && !connected;
  const previousStatus = useRef(snapshot.status);

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = snapshot.status;
    if (previous !== "connected" || snapshot.status !== "disconnected") {
      return;
    }
    setOpen(false);
    setPending(null);
    setError(null);
    toast("Pedal disconnected");
  }, [snapshot.status, setOpen]);

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
      await toast
        .promise(session.connect(endpoint, model), {
          loading: "Connecting…",
          success: `Connected to ${endpoint.label}`,
          error: (cause) =>
            cause instanceof Error ? cause.message : "Could not connect.",
        })
        .unwrap();
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
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setBusy(false);
    }
  }

  const label = connected ? snapshot.endpoint.label : "Disconnected";

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
        className={connected ? "gap-2.5" : undefined}
      >
        <span
          aria-hidden
          className={
            connected
              ? "size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_2px] shadow-emerald-400"
              : "size-2 shrink-0 rounded-full bg-muted-foreground/50"
          }
        />
        {label}
        {connected ? (
          snapshot.linkMode === "bluetooth" ? (
            <Bluetooth className="text-muted-foreground" />
          ) : (
            <Usb className="text-muted-foreground" />
          )
        ) : null}
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
            <ConnectedPanel
              linkMode={snapshot.linkMode}
              endpointLabel={snapshot.endpoint.label}
              model={snapshot.model}
              error={error}
              busy={busy}
              onDisconnect={() => void disconnect()}
            />
          ) : askingModel && pending ? (
            <SelectModelPanel
              pendingLabel={pending.label}
              error={error}
              busy={busy}
              onConnect={(model) => void connectWith(pending, model)}
              onBack={() => setPending(null)}
            />
          ) : (
            <ScanPanel
              linkTab={linkTab}
              onLinkTabChange={(value) => {
                setError(null);
                setLinkTab(value);
                if (value === "bluetooth" && bleEndpoints.length === 0) {
                  void scanBluetooth(true);
                }
              }}
              usbEndpoints={usbEndpoints}
              bleEndpoints={bleEndpoints}
              error={error}
              busy={busy}
              onPickDevice={pickDevice}
              onRefresh={() =>
                void (linkTab === "usb" ? scanUsb() : scanBluetooth(true))
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
