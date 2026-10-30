import { useEffect, useState } from "react";
import { Download, Heart } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import logoDark from "@/assets/img/gp-studio-logo-dark.png";
import logoLight from "@/assets/img/gp-studio-logo-light.png";
import { isIosWeb } from "@/app/ios-web";
import {
  getPwaInstallAvailability,
  promptPwaInstall,
  subscribePwaInstall,
  type PwaInstallAvailability,
} from "@/app/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionStatus } from "@/features/connect/ConnectionStatus";
import { ConnectDialogProvider } from "@/features/connect/ConnectDialogProvider";
import { GlobalSettingsControl } from "@/features/connect/GlobalSettingsModal";
import { PedalFootControls } from "@/features/connect/PedalFootControls";
import { IosWebNotice } from "@/features/controller/IosWebNotice";
import MainMenu from "@/components/main-menu";

function FooterSupportCta() {
  return (
    <div className="flex shrink-0 items-center gap-1 text-[12px]">
      <span className="text-lime-400">Like it?</span>
      <Button
        variant="ghost"
        size="xs"
        className="h-5 gap-1 border-transparent bg-muted px-1.5 text-[11px] text-foreground hover:bg-muted/80 hover:text-foreground dark:bg-muted/40 dark:text-white dark:hover:bg-muted/50 dark:hover:text-white [&_svg:not([class*='size-'])]:size-3"
        asChild
      >
        <a
          href="https://ko-fi.com/patocorrenti"
          target="_blank"
          rel="noopener noreferrer"
        >
          Support
          <Heart
            className="size-3 fill-lime-400 text-lime-400"
            aria-hidden
          />
        </a>
      </Button>
    </div>
  );
}

function FooterInstallCta() {
  return (
    <Button
      type="button"
      size="xs"
      className="h-5 shrink-0 gap-1 border-lime-400 bg-lime-400 px-1.5 text-[11px] text-black/80 shadow-none transition-[color,background-color,box-shadow] hover:bg-lime-300 hover:text-black/80 hover:shadow-[0_0_10px_1px] hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-lime-400/10 dark:hover:text-lime-300 dark:hover:shadow-[0_0_12px_1px] dark:hover:shadow-lime-400/25 [&_svg:not([class*='size-'])]:size-3"
      onClick={() => {
        void promptPwaInstall().then((result) => {
          if (result === "installed") {
            toast("GP Studio is already installed.");
            return;
          }
          if (result === "unavailable") {
            toast(
              "Use Install app in your Chrome or Edge menu to install GP Studio.",
            );
          }
        });
      }}
    >
      <Download className="size-3 shrink-0" aria-hidden />
      Install App
    </Button>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const showIosNotice = pathname === "/" && isIosWeb();
  const [installAvailability, setInstallAvailability] =
    useState<PwaInstallAvailability>(() => getPwaInstallAvailability());

  useEffect(() => {
    setInstallAvailability(getPwaInstallAvailability());
    return subscribePwaInstall(() => {
      setInstallAvailability(getPwaInstallAvailability());
    });
  }, []);

  const showInstallCta = installAvailability === "installable";

  return (
    <ConnectDialogProvider>
      <Toaster />
      <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b px-6 py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
        <Link to="/" className="mr-auto w-fit md:mr-0" aria-label="GP Studio">
          <img
            src={logoLight}
            alt="GP Studio"
            className="h-3.5 w-auto dark:hidden"
          />
          <img
            src={logoDark}
            alt="GP Studio"
            className="hidden h-3.5 w-auto dark:block"
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
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col bg-linear-to-t from-muted/80 to-transparent p-6 dark:from-[oklch(0.11_0.055_255)] dark:via-[oklch(0.15_0.05_255)/80] dark:to-transparent">
          <Outlet />
        </main>
        {showIosNotice ? <IosWebNotice /> : null}
      </div>
      <footer className="flex items-center gap-4 border-t bg-background pt-2 pr-6 pb-2.5 pl-6 text-[12px] leading-none text-muted-foreground/70">
        <p className="min-w-0 flex-1 text-left">
          <span className="font-bold">GP Studio</span>
          {' '}v1.0.2{' · '}
          <Link
            to="/about"
            className="text-foreground/60 transition-colors hover:text-foreground"
          >
            © 2026 Pato Correnti
          </Link>
        </p>
        {showInstallCta ? <FooterInstallCta /> : <FooterSupportCta />}
      </footer>
    </div>
    </ConnectDialogProvider>
  );
}
