import { Star, X } from "lucide-react";
import type { ListedPedal } from "@/app/preferences";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { displayModelName } from "@/device/models";
import { PedalThumb } from "@/features/connect/PedalThumb";

export function EndpointList({
  endpoints,
  busy,
  onPick,
  onForget,
  onClearFavorite,
}: {
  endpoints: Array<ListedPedal & { favorite: boolean }>;
  busy: boolean;
  onPick: (endpoint: ListedPedal) => void;
  onForget: (endpoint: ListedPedal) => void;
  onClearFavorite: () => void;
}) {
  if (endpoints.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
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
              <div className="flex items-stretch gap-1 rounded-lg border border-border bg-background py-1 pr-1.5 pl-1 dark:border-input dark:bg-input/30">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start gap-3 py-1.5 pl-1 hover:bg-transparent dark:hover:bg-transparent"
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
                {endpoint.favorite || endpoint.remembered ? (
                  <div
                    className={
                      endpoint.favorite
                        ? "flex w-6 shrink-0 flex-col items-center gap-2.5 pt-0.5"
                        : "flex w-6 shrink-0 flex-col items-center justify-center"
                    }
                  >
                    {endpoint.favorite ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Your favorite connection, click to remove"
                            disabled={busy}
                            className="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center disabled:pointer-events-none disabled:opacity-50"
                            onClick={onClearFavorite}
                          >
                            <Star
                              aria-hidden
                              className="size-3.5 fill-white text-white drop-shadow"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Your favorite connection, click to remove
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    {endpoint.remembered ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            className="size-6 shrink-0 rounded-full"
                            aria-label="Remove device"
                            disabled={busy}
                            onClick={() => onForget(endpoint)}
                          >
                            <X className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Remove device</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  );
}
