import { Button } from "@/components/ui/button";
import type { LinkEndpoint } from "@/device/endpoint";
import { displayModelName } from "@/device/models";
import { PedalThumb } from "@/features/connect/PedalThumb";

export function EndpointList({
  endpoints,
  busy,
  onPick,
}: {
  endpoints: LinkEndpoint[];
  busy: boolean;
  onPick: (endpoint: LinkEndpoint) => void;
}) {
  if (endpoints.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p id="select-pedal-label" className="text-sm text-center font-light text-foreground/60">
        Select a pedal
      </p>
      <ul
        className="flex max-h-64 flex-col gap-1 overflow-y-auto"
        aria-labelledby="select-pedal-label"
      >
        {endpoints.map((endpoint) => (
          <li key={endpoint.id}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 py-2 pl-2"
              disabled={busy}
              onClick={() => onPick(endpoint)}
            >
              <PedalThumb model={endpoint.suggestedModel} />
              <span className="flex flex-col items-start text-left">
                <span>{endpoint.label}</span>
                {endpoint.suggestedModel ? (
                  <span className="text-xs text-muted-foreground">
                    {displayModelName(endpoint.suggestedModel)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Model unknown
                  </span>
                )}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
