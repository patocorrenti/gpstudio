import { Button } from "@/components/ui/button";
import type { DeviceModel } from "@/device/models";
import { useDeviceSession } from "@/features/connect/DeviceSessionProvider";

const GP5_PRESS = [{ index: 0, label: "Stomp", aria: "Press stomp" }] as const;

const GP50_PRESS = [
  { index: 0, label: "A", aria: "Press stomp A" },
  { index: 1, label: "B", aria: "Press stomp B" },
] as const;

/**
 * One press on GP-5, A and B on GP-50. Same row on USB and Bluetooth.
 * Assignment marks stay on the slots.
 */
export function StompPressRow({
  pedal,
  disabled,
}: {
  pedal: DeviceModel;
  disabled: boolean;
}) {
  const session = useDeviceSession();
  const presses = pedal === "gp5" ? GP5_PRESS : GP50_PRESS;

  return (
    <div
      role="group"
      aria-label="Stomp"
      className="mb-3 flex items-center justify-center gap-2"
    >
      {presses.map((press) => (
        <Button
          key={press.index}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={press.aria}
          onClick={() => {
            void session.pressStomp(press.index);
          }}
        >
          {press.label}
        </Button>
      ))}
    </div>
  );
}
