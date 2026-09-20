import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeviceModel } from "@/device/models";
import { PedalThumb } from "@/features/connect/PedalThumb";

export function SelectModelPanel({
  pendingLabel,
  error,
  busy,
  onConnect,
  onBack,
}: {
  pendingLabel: string;
  error: string | null;
  busy: boolean;
  onConnect: (model: DeviceModel) => void;
  onBack: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Select model</DialogTitle>
        <DialogDescription>
          {pendingLabel} did not identify as GP-5 or GP-50. Choose the pedal
          before connecting.
        </DialogDescription>
      </DialogHeader>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col gap-2 py-3"
          disabled={busy}
          onClick={() => onConnect("gp5")}
        >
          <PedalThumb model="gp5" />
          GP-5
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col gap-2 py-3"
          disabled={busy}
          onClick={() => onConnect("gp50")}
        >
          <PedalThumb model="gp50" />
          GP-50
        </Button>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </DialogFooter>
    </>
  );
}
