import { RequirePedal } from "@/features/connect/RequirePedal";
import { MidiInMonitor } from "@/features/log/MidiInMonitor";

export function LogPage() {
  return (
    <RequirePedal>
      <MidiInMonitor />
    </RequirePedal>
  );
}
