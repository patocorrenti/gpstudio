import { Bug } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionStatus } from "@/features/connect/ConnectionStatus";
import { ConnectDialogProvider } from "@/features/connect/ConnectDialogProvider";
import MainMenu from "@/components/main-menu";

export function AppShell() {
  return (
    <ConnectDialogProvider>
      <Toaster />
      <div className="relative flex min-h-svh flex-col bg-background text-foreground">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b px-6 py-3">
        <p className="text-lg font-semibold tracking-tight">
          GP Studio
        </p>
        <ConnectionStatus />
        <div className="flex items-center justify-end gap-3">
          <MainMenu />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-6">
        <Outlet />
      </main>
      <footer className="flex items-center gap-4 border-t py-2 pr-24 pl-6 text-[11px] leading-none text-muted-foreground/60">
        <p className="min-w-0 flex-1 text-center">
          <span className="font-bold">GP Studio</span>
          {" · Independent controller for Valeton GP5/50 · Version 0.1.0 [ Beta Testing ] · "}
          <Link to="/about" className="text-foreground/60">
            Pato Correnti
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
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 z-20 size-20 overflow-hidden"
      >
        <div className="absolute bottom-3.5 -right-6 w-28 rotate-[-45deg] bg-amber-400/70 py-px text-center text-[8px] font-bold tracking-[0.22em] text-black/80">
          BETA
        </div>
      </div>
    </div>
    </ConnectDialogProvider>
  );
}
