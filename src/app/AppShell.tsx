import { Link, Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <footer className="px-10 py-3 text-center text-[11px] border-t leading-none text-muted-foreground/60 ">
        <span className="font-bold">GP Studio</span>
        {" · Independent controller for Valeton GP5/50 · Version 0.1.0 [ Beta Testing ] · "}
        <Link to="/about" className="text-foreground/60">
          Pato Correnti
        </Link>
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
