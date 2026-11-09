import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IosWebNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      role="status"
      aria-labelledby="ios-web-notice-title"
      className="flex items-start gap-3 border-b bg-muted/40 px-6 py-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <h2 id="ios-web-notice-title" className="font-medium">
          Try a browser with Bluetooth
        </h2>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          On iPhone or iPad, Bluefy or a similar browser can reach the pedal.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <XIcon />
      </Button>
    </section>
  );
}
