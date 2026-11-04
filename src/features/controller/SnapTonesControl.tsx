import { AudioLines, AudioWaveform } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";
import { requestOpenSnapTones } from "@/features/controller/snap-tones-bridge";

const headerChipClass =
  "size-8 gap-0 px-0 text-xs md:h-7 md:w-auto md:gap-2 md:px-2 md:text-[0.72rem]";

/** Header controls: SnapTones (+ placeholder IR) when USB is connected. */
export function SnapTonesControl() {
  const navigate = useNavigate();
  const snapshot = useSessionSnapshot();

  if (snapshot.status !== "connected" || snapshot.linkMode !== "usb") {
    return null;
  }

  const busy =
    snapshot.sync !== "ready" || snapshot.chainSync === "syncing" || snapshot.snapFileSend;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-2">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              className={headerChipClass}
              aria-label="IR"
              onClick={() => {
                navigate("/");
              }}
            >
              <AudioWaveform className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="hidden md:inline">IR</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">IR</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
