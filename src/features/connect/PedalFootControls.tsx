import { useState } from "react";
import { SportShoe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DeviceModel } from "@/device/models";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";

const GP5_SWITCH = [
  { index: 0, label: "Footswitch", aria: "Press footswitch" },
] as const;

const GP50_SWITCH = [
  { index: 0, label: "Footswitch A", aria: "Press footswitch A" },
  { index: 1, label: "Footswitch B", aria: "Press footswitch B" },
] as const;

function switchButtons(pedal: DeviceModel) {
  return pedal === "gp5" ? GP5_SWITCH : GP50_SWITCH;
}

/**
 * Pedal footswitch press and tuner — shell chrome next to Global, not the patch body.
 */
export function PedalFootControls() {
  const navigate = useNavigate();
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const [open, setOpen] = useState(false);

  if (snapshot.status !== "connected") {
    return null;
  }

  const busy =
    snapshot.sync !== "ready" || snapshot.chainSync === "syncing";
  const presses = switchButtons(snapshot.model);
  const tunerOn = snapshot.tunerOn;

  return (
    <TooltipProvider delayDuration={0}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (busy && next) {
            return;
          }
          if (next) {
            navigate("/");
          }
          setOpen(next);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={busy}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Press Footswitch"
              >
                <SportShoe className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Press Footswitch</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-44 gap-0.5 p-1">
          {presses.map((press) => (
            <Button
              key={press.index}
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-8 w-full justify-start px-2 font-normal"
              aria-label={press.aria}
              onClick={() => {
                setOpen(false);
                navigate("/");
                void session.pressStomp(press.index);
              }}
            >
              {press.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={tunerOn ? "secondary" : "ghost"}
            disabled={busy}
            className="h-8 w-full justify-start px-2 font-normal"
            aria-label={tunerOn ? "Exit tuner" : "Enter tuner"}
            aria-pressed={tunerOn}
            onClick={() => {
              navigate("/");
              void session.setTuner(!tunerOn);
            }}
          >
            Tuner
          </Button>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
