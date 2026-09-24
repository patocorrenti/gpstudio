import { Button } from "@/components/ui/button";
import { useDeviceSession, useSessionSnapshot } from "@/features/connect/DeviceSessionProvider";

/**
 * Enter / exit the pedal tuner (CC 58). No pitch display — the pedal shows it.
 */
export function TunerControl({ disabled }: { disabled: boolean }) {
  const session = useDeviceSession();
  const snapshot = useSessionSnapshot();
  const tunerOn =
    snapshot.status === "connected" ? snapshot.tunerOn : false;

  return (
    <Button
      type="button"
      variant={tunerOn ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      aria-label={tunerOn ? "Exit tuner" : "Enter tuner"}
      aria-pressed={tunerOn}
      onClick={() => {
        void session.setTuner(!tunerOn);
      }}
    >
      Tuner
    </Button>
  );
}
