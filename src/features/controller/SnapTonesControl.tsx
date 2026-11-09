import { AudioLines } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import {
  requestOpenSnapTones,
  SNAP_USB_REQUIRED,
} from "@/features/controller/snap-tones-bridge";

const headerChipClass =
  "size-8 gap-0 px-0 text-xs md:h-7 md:w-auto md:gap-2 md:px-2 md:text-[0.72rem]";

/** Header SnapTones control. Bluetooth can only explain that management requires USB. */
export function SnapTonesControl() {
  const navigate = useNavigate();
  const snapshot = useSessionSnapshot();

  if (snapshot.status !== "connected") {
    return null;
  }

  const usb = snapshot.linkMode === "usb";
  const busy =
    usb &&
    (snapshot.sync !== "ready" || snapshot.chainSync === "syncing" || snapshot.snapFileSend);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className={headerChipClass}
            aria-label="SnapTones"
            onClick={() => {
              if (!usb) {
                toast(SNAP_USB_REQUIRED);
                return;
              }
              navigate("/");
              requestOpenSnapTones();
            }}
          >
            <AudioLines className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="hidden md:inline">SnapTones</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">SnapTones</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
