import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capabilitiesForLink } from "@/device/link";
import { formatPatch, PATCH_COUNT } from "@/device/session";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";
import { RequirePedal } from "@/features/connect/RequirePedal";

const patchOptions = Array.from({ length: PATCH_COUNT }, (_, index) => index);

function PatchBar({ patch }: { patch: number }) {
  const session = useDeviceSession();

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Previous patch"
        onClick={() => void session.stepPatch(-1)}
      >
        <ChevronLeft />
      </Button>
      <Select
        value={String(patch)}
        onValueChange={(value) => {
          void session.setPatch(Number.parseInt(value, 10));
        }}
      >
        <SelectTrigger
          aria-label="Select patch"
          size="default"
          className="h-auto min-w-28 justify-center py-2.5 text-2xl font-semibold tabular-nums"
        >
          <SelectValue>{formatPatch(patch)}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72 min-w-28">
          {patchOptions.map((option) => (
            <SelectItem
              key={option}
              value={String(option)}
              className="font-medium tabular-nums"
            >
              {formatPatch(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Next patch"
        onClick={() => void session.stepPatch(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

function ConnectedController() {
  const snapshot = useSessionSnapshot();
  if (snapshot.status !== "connected") {
    return null;
  }

  if (!capabilitiesForLink(snapshot.linkMode).commandToPedal) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center">
        <p className="text-muted-foreground">
          Patch control is not available over Bluetooth yet.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center">
      <PatchBar patch={snapshot.patch} />
    </section>
  );
}

export function ControllerPage() {
  return (
    <RequirePedal>
      <ConnectedController />
    </RequirePedal>
  );
}
