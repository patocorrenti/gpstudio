import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DeviceModel } from "@/device/models";
import {
  useDeviceSession,
  useSessionSnapshot,
} from "@/features/connect/DeviceSessionProvider";

const GP5_SWITCH = [{ index: 0, label: "Switch", aria: "Press switch" }] as const;

const GP50_SWITCH = [
  { index: 0, label: "Switch A", aria: "Press switch A" },
  { index: 1, label: "Switch B", aria: "Press switch B" },
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

  if (snapshot.status !== "connected") {
    return null;
  }

  const busy =
    snapshot.sync !== "ready" || snapshot.chainSync === "syncing";
  const presses = switchButtons(snapshot.model);
  const tunerOn = snapshot.tunerOn;

  return (
    <div
      role="group"
      aria-label="Pedal footswitches"
      className="flex items-center gap-2"
    >
      {presses.map((press) => (
        <Button
          key={press.index}
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          aria-label={press.aria}
          onClick={() => {
            navigate("/");
            void session.pressStomp(press.index);
          }}
        >
          {press.label}
        </Button>
      ))}
      <Button
        type="button"
        variant={tunerOn ? "default" : "outline"}
        size="sm"
        disabled={busy}
        aria-label={tunerOn ? "Exit tuner" : "Enter tuner"}
        aria-pressed={tunerOn}
        onClick={() => {
          navigate("/");
          void session.setTuner(!tunerOn);
        }}
      >
        Tuner
      </Button>
    </div>
  );
}
