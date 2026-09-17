import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  useDeviceSession,
  useInboundLog,
} from "@/features/connect/DeviceSessionProvider";

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function MidiInMonitor() {
  const session = useDeviceSession();
  const events = useInboundLog();

  useEffect(() => {
    session.setInboundCapture(true);
    return () => {
      session.setInboundCapture(false);
    };
  }, [session]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-sm font-medium">MIDI in</h1>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={events.length === 0}
          onClick={() => session.clearInboundLog()}
        >
          Clear
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Waiting for MIDI from the pedal…
        </p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
          {[...events].reverse().map((event) => (
            <li
              key={event.id}
              className="border-t border-border/60 py-1.5 first:border-t-0"
            >
              <div className="flex gap-2 text-foreground">
                <span className="shrink-0 text-muted-foreground">
                  {formatTime(event.at)}
                </span>
                <span>{event.summary}</span>
              </div>
              <p className="break-all pl-[4.75rem] text-muted-foreground">
                {event.hex}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
