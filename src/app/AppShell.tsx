import { Heart } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import logo from "@/assets/img/gp-studio-logo.svg";
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
      <header className="flex items-center gap-2 border-b px-6 py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
        <Link to="/" className="mr-auto w-fit md:mr-0" aria-label="GP Studio">
          <img
            src={logo}
            alt="GP Studio"
            className="h-3.5 w-auto dark:invert"
          />
        </Link>
        <div className="flex items-center gap-2 pr-2 md:pr-0">
          <GlobalSettingsControl />
          <ConnectionStatus />
          <PedalFootControls />
        </div>
        <div className="flex items-center gap-2 md:justify-end md:gap-3">
          <MainMenu />
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-6">
        <Outlet />
      </main>
      <footer className="flex items-center gap-4 border-t py-2 pr-6 pl-6 text-[12px] leading-none text-muted-foreground/70">
        <p className="min-w-0 flex-1 text-left">
          <span className="font-bold">GP Studio</span>
          {' '}v1.0.0-beta.3{' · '}
          <Link
            to="/about"
            className="text-foreground/60 transition-colors hover:text-foreground"
          >
            © 2026 Pato Correnti
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[12px]">
          <span>Like it?</span>
          <Button
            variant="default"
            size="xs"
            className="h-5 gap-0.5 border-emerald-600 bg-emerald-600 px-1.5 text-[10px] text-white hover:bg-emerald-500 hover:text-white dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 [&_svg:not([class*='size-'])]:size-2.5"
            asChild
          >
            <a
              href="https://ko-fi.com/patocorrenti"
              target="_blank"
              rel="noopener noreferrer"
            >
              Support
              <Heart className="size-2.5 fill-current" aria-hidden />
            </a>
          </Button>
        </div>
      </footer>
    </div>
    </ConnectDialogProvider>
  );
}
