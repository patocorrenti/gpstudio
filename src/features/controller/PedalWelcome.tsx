import logo from "@/assets/img/gp-studio-logo.svg";
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
      className="group -m-6 flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 bg-linear-to-t from-muted/80 to-transparent pb-16 text-muted-foreground transition-colors hover:text-foreground dark:from-[oklch(0.11_0.055_255)] dark:via-[oklch(0.15_0.05_255)/80] dark:to-transparent"
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
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground dark:text-muted-foreground/70">
          Welcome to
        </p>
        <img
          src={logo}
          alt="GP Studio"
          className="h-[30px] w-auto dark:invert"
        />
      </div>
      <div className="mt-[-12px] flex flex-col items-center gap-3">
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
            className="h-10 border-lime-400 bg-lime-400 px-4 text-sm whitespace-normal text-black/80 shadow-none transition-[color,background-color,box-shadow] hover:bg-lime-300 hover:text-black/80 hover:shadow-[0_0_10px_1px] hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-lime-400/10 dark:hover:text-lime-300 dark:hover:shadow-[0_0_12px_1px] dark:hover:shadow-lime-400/25"
            onClick={(event) => {
              event.stopPropagation();
              openConnect();
            }}
          >
            Connect a Multi-Effects
          </Button>
          <p className="text-sm text-muted-foreground">Valeton GP5 or GP50</p>
        </div>
      </div>
    </div>
  );
}
