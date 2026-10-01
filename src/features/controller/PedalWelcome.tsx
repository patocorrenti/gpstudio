import logo from "@/assets/img/gp-studio-logo.svg";
import pedalsLineBlack from "@/assets/img/gp5-50-line-black.png";
import pedalsLineWhite from "@/assets/img/gp5-50-line-white.png";
import { useConnectDialog } from "@/features/connect/ConnectDialogProvider";

export function PedalWelcome() {
  const { openConnect } = useConnectDialog();

  return (
    <button
      type="button"
      className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 pb-16 text-muted-foreground transition-colors hover:text-foreground"
      aria-haspopup="dialog"
      aria-label="Connect a pedal"
      onClick={openConnect}
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground dark:text-muted-foreground/70">
          Welcome to
        </p>
        <img
          src={logo}
          alt="GP Studio"
          className="h-[45px] w-auto dark:invert"
        />
        <span
          aria-hidden
          className="mt-2.5 rounded-[3px] bg-emerald-400 px-1.5 py-px text-[10px] font-bold tracking-[0.18em] text-black/80"
        >
          Closed Beta
        </span>
      </div>
      <div className="mt-2 flex flex-col items-center gap-2">
        <img
          src={pedalsLineBlack}
          alt=""
          aria-hidden
          className="w-[176px] opacity-70 transition-opacity group-hover:opacity-100 dark:hidden"
        />
        <img
          src={pedalsLineWhite}
          alt=""
          aria-hidden
          className="hidden w-[176px] opacity-70 transition-opacity group-hover:opacity-100 dark:block"
        />
        <p>Connect a Valeton GP5 or GP50 to get started...</p>
      </div>
    </button>
  );
}
