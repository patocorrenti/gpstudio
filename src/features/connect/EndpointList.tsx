import { X, Zap } from "lucide-react";
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
import { cn } from "cn";

export function EndpointList({
  endpoints,
  busy,
  showStartup,
  onPick,
  onForget,
  onToggleStartup,
}: {
  endpoints: Array<ListedPedal & { startup: boolean }>;
  busy: boolean;
  showStartup: boolean;
  onPick: (endpoint: ListedPedal) => void;
  onForget: (endpoint: ListedPedal) => void;
  onToggleStartup: (endpoint: ListedPedal, enabled: boolean) => void;
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
          {endpoints.map((endpoint) => {
            const showActions = showStartup || endpoint.remembered;
            return (
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
                  {showActions ? (
                    <div className="flex shrink-0 flex-col items-end justify-between self-stretch py-0.5 pr-0.5">
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
                      {showStartup ? (
                        <div className="flex items-center gap-1.5">
                          {endpoint.startup ? (
                            <span className="whitespace-nowrap text-[0.65rem] leading-none text-muted-foreground">
                              Quick connect
                            </span>
                          ) : null}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                className={cn(
                                  "size-6 shrink-0 rounded-full",
                                  endpoint.startup
                                    ? "border-foreground/50 bg-foreground/50 text-background hover:bg-foreground/50 hover:text-background dark:bg-foreground/50 dark:text-background dark:hover:bg-foreground/50 dark:hover:text-background"
                                    : "border-muted-foreground/40 bg-transparent text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/70",
                                )}
                                aria-label={
                                  endpoint.startup
                                    ? "Quick connect enabled, click to disable"
                                    : "Quick connect disabled, click to enable"
                                }
                                aria-pressed={endpoint.startup}
                                disabled={busy}
                                onClick={() =>
                                  onToggleStartup(endpoint, !endpoint.startup)
                                }
                              >
                                <Zap
                                  className={cn(
                                    "size-3",
                                    endpoint.startup && "fill-current",
                                  )}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <b>Quick connect:</b> Automatically connect on startup
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}
