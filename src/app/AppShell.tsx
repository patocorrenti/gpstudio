import { Bug } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import logo from "@/assets/img/gpstudio-logo-black.svg";
import logoWhite from "@/assets/img/gpstudio-logo-white.svg";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionStatus } from "@/features/connect/ConnectionStatus";
import { ConnectDialogProvider } from "@/features/connect/ConnectDialogProvider";
import { GlobalSettingsControl } from "@/features/connect/GlobalSettingsModal";
import { PedalFootControls } from "@/features/connect/PedalFootControls";
import MainMenu from "@/components/main-menu";

export function AppShell() {
  return (
    <ConnectDialogProvider>
      <Toaster />
      <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b px-6 py-3">
        <Link to="/" className="w-fit" aria-label="GP Studio">
          <img
            src={logo}
            alt="GP Studio"
            className="h-5 w-auto dark:hidden"
          />
          <img
            src={logoWhite}
            alt=""
            aria-hidden
            className="hidden h-5 w-auto dark:block"
          />
        </Link>
        <div className="flex items-center gap-2">
          <GlobalSettingsControl />
          <ConnectionStatus />
          <PedalFootControls />
        </div>
        <div className="flex items-center justify-end gap-3">
          <MainMenu />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-6">
        <Outlet />
      </main>
      <footer className="flex items-center gap-4 border-t py-2 pr-6 pl-6 text-[11px] leading-none text-muted-foreground/60">
        <p className="min-w-0 flex-1 text-center">
          <span className="font-bold">GP Studio</span>
          {' '}v0.4.0
          {" · Compatible with Valeton GP5/50 · "}
          <Link to="/about" className="text-foreground/60">
            © 2026 Pato Correnti
          </Link>
        </p>
        <Button
          variant="outline"
          size="xs"
          className="shrink-0 border-amber-500/50 bg-amber-400/15 text-[11px] text-amber-950 hover:bg-amber-400/30 dark:text-amber-100"
          asChild
        >
          <a
            href="https://forms.gle/PhvZEPBty96WWzDDA"
            target="_blank"
            rel="noreferrer"
          >
            <Bug />
            Report a Bug
          </a>
        </Button>
      </footer>
    </div>
    </ConnectDialogProvider>
  );
}
