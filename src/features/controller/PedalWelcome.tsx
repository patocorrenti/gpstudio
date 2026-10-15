import logoDark from "@/assets/img/gp-studio-logo-dark.png";
import logoLight from "@/assets/img/gp-studio-logo-light.png";
import pedalsConnectBlack from "@/assets/img/pedal-connect-black.png";
import pedalsConnectLight from "@/assets/img/pedal-connect-light.png";
import { Button } from "@/components/ui/button";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";

export function PedalWelcome() {
  const { openConnect } = useConnectDialog();

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 pb-16 text-muted-foreground transition-colors hover:text-foreground"
      aria-haspopup="dialog"
      aria-label="Connect a pedal"
      onClick={openConnect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openConnect();
        }
      }}
    >
      <div className="flex w-fit flex-col items-end gap-1.5">
        <img
          src={logoLight}
          alt="GP Studio"
          className="h-[30px] w-auto dark:hidden"
        />
        <img
          src={logoDark}
          alt="GP Studio"
          className="hidden h-[30px] w-auto dark:block"
        />
        <span className="text-[10px] leading-none tracking-wide text-muted-foreground/70">
          v1.0.0-beta.3
        </span>
      </div>
      <div className="mt-[-24px] flex flex-col items-center gap-3">
        <img
          src={pedalsConnectBlack}
          alt=""
          aria-hidden
          className="w-[400px] opacity-70 transition-opacity group-hover:opacity-100 dark:hidden"
        />
        <img
          src={pedalsConnectLight}
          alt=""
          aria-hidden
          className="hidden w-[450px] opacity-70 transition-opacity group-hover:opacity-100 dark:block"
        />
        <div className="flex flex-col items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            className="relative h-10 overflow-hidden border-lime-400 bg-lime-400 px-4 text-sm whitespace-normal text-black/80 shadow-none transition-[color,background-color,box-shadow] hover:bg-lime-300 hover:text-black/80 hover:shadow-[0_0_10px_1px] hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-lime-400/10 dark:hover:text-lime-300 dark:hover:shadow-[0_0_12px_1px] dark:hover:shadow-lime-400/25"
            onClick={(event) => {
              event.stopPropagation();
              openConnect();
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/30 to-transparent motion-safe:animate-button-shine group-hover/button:invisible dark:via-lime-200/22"
            />
            <span className="relative">Connect a Multi-Effects</span>
          </Button>
          <p className="text-sm text-muted-foreground">Valeton GP5 or GP50</p>
        </div>
      </div>
    </div>
  );
}
