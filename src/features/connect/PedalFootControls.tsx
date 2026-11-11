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
 * on GP-5 over Bluetooth. These variants are offered there only, so the
 * operator can test which one the pedal accepts. Remove once settled.
 */
const DEBUG_VARIANTS: { value: StompPressVariant; label: string }[] = [
  { value: "cc127", label: "CC 69 = 127" },
  { value: "cc0then127", label: "CC 69 = 0, then 127" },
  { value: "emulated", label: "Emulated (CC 48–57)" },
];
const DEBUG_VARIANT_KEY = "gpstudio.debug.gp5BtStompVariant";

function readDebugVariant(): StompPressVariant {
  try {
    const stored = localStorage.getItem(DEBUG_VARIANT_KEY);
    if (DEBUG_VARIANTS.some((variant) => variant.value === stored)) {
      return stored as StompPressVariant;
    }
  } catch {
    // Storage unavailable; use the default.
  }
  return "cc127";
}

function writeDebugVariant(variant: StompPressVariant): void {
  try {
    localStorage.setItem(DEBUG_VARIANT_KEY, variant);
  } catch {
    // Storage unavailable; the choice lasts for this page only.
  }
}

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
  const [debugVariant, setDebugVariant] = useState<StompPressVariant>(readDebugVariant);

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
          <PopoverContent align="end" className="w-52 gap-0.5 p-1">
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
                  void session.pressStomp(
                    press.index,
                    gp5Bluetooth ? debugVariant : "cc127",
                  );
                }}
              >
                {press.label}
              </Button>
            ))}
            {gp5Bluetooth ? (
              <div className="mt-1 border-t pt-1" role="radiogroup" aria-label="Debug press method">
                <p className="px-2 py-1 text-xs text-muted-foreground">Debug: press method</p>
                {DEBUG_VARIANTS.map((variant) => (
                  <Button
                    key={variant.value}
                    type="button"
                    role="radio"
                    aria-checked={debugVariant === variant.value}
                    variant={debugVariant === variant.value ? "secondary" : "ghost"}
                    className="h-7 w-full justify-start px-2 text-xs font-normal"
                    onClick={() => {
                      setDebugVariant(variant.value);
                      writeDebugVariant(variant.value);
                    }}
                  >
                    {variant.label}
                  </Button>
                ))}
              </div>
            ) : (
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
            )}
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    </div>
  );
}
