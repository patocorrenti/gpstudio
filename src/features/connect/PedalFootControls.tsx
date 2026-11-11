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
import type { StompPressVariant } from "@/device/encode";
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

/**
 * DEBUG (GP-5 Bluetooth CTL investigation): the shipped CC 69 = 127 is ignored
 * on GP-5 over Bluetooth. There, each variant is its own press button, so the
 * operator can test which one the pedal accepts. Remove once settled.
 */
const DEBUG_VARIANTS: { value: StompPressVariant; label: string }[] = [
  { value: "cc127", label: "Footswitch: CC 69 = 127" },
  { value: "cc0then127", label: "Footswitch: CC 69 = 0, 127" },
  { value: "emulated", label: "Footswitch: emulated (CC 48–57)" },
];
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

  // GP-5 Bluetooth ignores CC 69 and CC 58. The footswitch stays available there
  // with debug press variants; the tuner stays hidden.
  const gp5Bluetooth = snapshot.model === "gp5" && snapshot.linkMode === "bluetooth";

  const busy =
    snapshot.sync !== "ready" || snapshot.chainSync === "syncing" || snapshot.snapFileSend;
  const presses = switchButtons(snapshot.model);
  const tunerOn = snapshot.tunerOn;

  return (
    <div className="hidden md:block">
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
          <PopoverContent align="end" className="w-60 gap-0.5 p-1">
            {gp5Bluetooth ? (
              <>
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Debug: each button sends one press
                </p>
                {DEBUG_VARIANTS.map((variant) => (
                  <Button
                    key={variant.value}
                    type="button"
                    variant="ghost"
                    className="h-8 w-full justify-start px-2 text-xs font-normal"
                    onClick={() => {
                      // Not disabled while busy: the session logs why it drops a press.
                      console.info("[GP Studio stomp debug] click", {
                        variant: variant.value,
                        busy,
                      });
                      navigate("/");
                      void session.pressStomp(0, variant.value).catch((error: unknown) => {
                        console.info("[GP Studio stomp debug] error", error);
                      });
                    }}
                  >
                    {variant.label}
                  </Button>
                ))}
              </>
            ) : (
              <>
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
              </>
            )}
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    </div>
  );
}
