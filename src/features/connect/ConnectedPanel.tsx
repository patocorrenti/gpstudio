import { Bluetooth, Unplug, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LinkMode } from "@/device/link";
import { displayModelName, type DeviceModel } from "@/device/models";

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

export function ConnectedPanel({
  linkMode,
  endpointLabel,
  model,
  error,
  busy,
  onDisconnect,
}: {
  linkMode: LinkMode;
  endpointLabel: string;
  model: DeviceModel;
  error: string | null;
  busy: boolean;
  onDisconnect: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Connected</DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          {linkMode === "bluetooth" ? (
            <Bluetooth className="size-3.5" />
          ) : (
            <Usb className="size-3.5" />
          )}
          {linkModeLabel(linkMode)} · {connectedDetail(endpointLabel, model)}
        </DialogDescription>
      </DialogHeader>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onDisconnect}
        >
          <Unplug />
          Disconnect
        </Button>
      </DialogFooter>
    </>
  );
}
