import { useEffect, useState } from "react";
import { Bug, Download, Heart, Mail, RefreshCw } from "lucide-react";
import {
  getPwaInstallAvailability,
  promptPwaInstall,
  subscribePwaInstall,
} from "@/app/pwa-install";
import {
  applyAppUpdate,
  checkForAppUpdate,
  getAppUpdateState,
  subscribePwaUpdate,
  type AppUpdateCheck,
} from "@/app/pwa-update";
import githubMark from "@/assets/img/github-mark.svg";
import microsoftStoreBadgeDark from "@/assets/img/get-it-from-microsoft-dark.svg";
import microsoftStoreBadgeLight from "@/assets/img/get-it-from-microsoft-light.svg";
import { Button } from "@/components/ui/button";

const actionButtonClassName =
  "h-auto w-full flex-row items-center justify-start gap-2.5 whitespace-normal px-4 py-3 min-[500px]:flex-col min-[500px]:items-center min-[500px]:justify-center min-[500px]:gap-1.5";

const actionLabelClassName =
  "flex flex-col items-start gap-0.5 text-left min-[500px]:items-center min-[500px]:text-center";

const CHANGELOG_URL =
  "https://github.com/patocorrenti/gpstudio/blob/main/CHANGELOG.md";

// Show again once the Edge-hosted PWA is listed in the Microsoft Store.
const SHOW_MICROSOFT_STORE_BADGE = false;

const UPDATE_CHECK_MESSAGES: Partial<Record<AppUpdateCheck, string>> = {
  current: "You're on the latest version.",
  downloading: "Downloading the new version…",
  failed: "Couldn't check. Are you offline?",
};

const textButtonClassName =
  "inline-flex cursor-pointer items-center gap-1.5 text-foreground/80 underline underline-offset-4 hover:text-foreground disabled:cursor-default disabled:opacity-60";

function UpdateCheck() {
  const [state, setState] = useState(getAppUpdateState);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setState(getAppUpdateState());
    };
    sync();
    return subscribePwaUpdate(sync);
  }, []);

  if (state === "unavailable") {
    return null;
  }

  if (state === "ready") {
    return (
      <p className="text-sm text-muted-foreground">
        A new version is ready.{" "}
        <button
          type="button"
          className={textButtonClassName}
          onClick={() => {
            void applyAppUpdate();
          }}
        >
          Reload to update
        </button>
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      <button
        type="button"
        className={textButtonClassName}
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          setMessage(null);
          const result = await checkForAppUpdate();
          setChecking(false);
          setMessage(UPDATE_CHECK_MESSAGES[result] ?? null);
        }}
      >
        <RefreshCw
          className={`size-3.5 shrink-0 ${checking ? "motion-safe:animate-spin" : ""}`}
          aria-hidden
        />
        {checking ? "Checking…" : "Check for updates"}
      </button>
      {message ? <span aria-live="polite">{message}</span> : null}
    </p>
  );
}

export function AboutPage() {
  const [canInstall, setCanInstall] = useState(
    () => getPwaInstallAvailability() === "installable",
  );

  useEffect(() => {
    const sync = () => {
      setCanInstall(getPwaInstallAvailability() === "installable");
    };
    sync();
    return subscribePwaInstall(sync);
  }, []);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            About GP Studio
          </h1>
          <p className="mt-5 mb-5 text-muted-foreground leading-relaxed">
            <a
              href={CHANGELOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
            >
              Version 1.0.2
            </a>{" "}
            · Free controller for the Valeton GP-5/50 multi-effects.
          </p>
          <UpdateCheck />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 min-[42rem]:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <Button
            asChild
            variant="outline"
            className={actionButtonClassName}
          >
            <a
              href="https://ko-fi.com/patocorrenti"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Heart
                className="size-5 shrink-0 fill-current text-lime-500 motion-safe:animate-heartbeat dark:text-lime-400"
                aria-hidden
              />
              <span className={actionLabelClassName}>
                <span className="text-sm font-semibold text-foreground">
                  Support GP Studio
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  if you like it
                </span>
              </span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className={actionButtonClassName}
          >
            <a
              href="https://forms.gle/wbZYesraBR2QevhUA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Mail className="size-5 shrink-0" aria-hidden />
              <span className={actionLabelClassName}>
                <span className="text-sm font-semibold text-foreground">
                  Subscribe
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  to stay informed
                </span>
              </span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className={actionButtonClassName}
          >
            <a
              href="https://forms.gle/PhvZEPBty96WWzDDA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Bug className="size-5 shrink-0" aria-hidden />
              <span className={actionLabelClassName}>
                <span className="text-sm font-semibold text-foreground">
                  Report a Bug
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  if something is off
                </span>
              </span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className={actionButtonClassName}
          >
            <a
              href="https://github.com/patocorrenti/gpstudio"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={githubMark}
                alt=""
                className="size-5 shrink-0 dark:invert"
              />
              <span className={actionLabelClassName}>
                <span className="text-sm font-semibold text-foreground">
                  Get the Code
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  it's open source!
                </span>
              </span>
            </a>
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground/60">
          GP Studio is 100% free. Support is entirely voluntary and comes with
          no products, services, features, priority, or other benefits.
        </p>
      </div>

      {canInstall ? (
        <div className="space-y-5 border-t border-border pt-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Install GP Studio
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
            <li>
              <span className="font-medium text-foreground/80">Works offline.</span>{" "}
              Tweak your tones anywhere, no internet needed.
            </li>
            <li>
              <span className="font-medium text-foreground/80">
                Feels like a real app.
              </span>{" "}
              Own window, Start menu and taskbar, no browser tabs.
            </li>
            <li>
              <span className="font-medium text-foreground/80">Always up to date.</span>{" "}
              New features arrive automatically.
            </li>
          </ul>
          <div className="flex flex-col items-start gap-3 min-[500px]:flex-row min-[500px]:items-center">
            <Button
              type="button"
              className="relative h-auto gap-2 overflow-hidden border-lime-400 bg-lime-400 px-8 py-3 text-base text-black/80 shadow-none transition-[color,background-color,box-shadow] hover:bg-lime-300 hover:text-black/80 hover:shadow-[0_0_10px_1px] hover:shadow-lime-400/30 dark:border-lime-400 dark:bg-transparent dark:text-lime-400 dark:hover:bg-lime-400/10 dark:hover:text-lime-300 dark:hover:shadow-[0_0_12px_1px] dark:hover:shadow-lime-400/25"
              onClick={() => {
                void promptPwaInstall();
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/30 to-transparent motion-safe:animate-button-shine group-hover/button:invisible dark:via-lime-200/22"
              />
              <Download className="relative size-4 shrink-0" aria-hidden />
              <span className="relative">Install now</span>
            </Button>
            {SHOW_MICROSOFT_STORE_BADGE ? (
              <>
                <span className="text-sm text-muted-foreground">or</span>
                <button
                  type="button"
                  className="inline-flex shrink-0 cursor-pointer rounded-md bg-transparent p-1 transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/50"
                  aria-label="Get it from Microsoft Store"
                >
                  <img
                    src={microsoftStoreBadgeLight}
                    alt=""
                    className="h-11 w-auto dark:hidden"
                  />
                  <img
                    src={microsoftStoreBadgeDark}
                    alt=""
                    className="hidden h-11 w-auto dark:block"
                  />
                </button>
              </>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground/60">
            Works on Windows, Mac and Linux (Chrome or Edge) and Android (Chrome,
            Bluetooth only).
            <br />
            iPhone and iPad can&apos;t connect to the pedal.
          </p>
        </div>
      ) : null}

      <div className="space-y-4 border-t border-border pt-6">
        <h2 className="text-xl font-semibold tracking-tight">
          A note from the author
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          I&apos;m{" "}
          <a
            href="https://patocorrenti.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
          >
            Pato Correnti
          </a>
          , a hobby guitarist, product engineer, and designer.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          <strong>GP Studio</strong> is the controller I always wanted to have —
          now that I found the pedal I didn&apos;t know I always wanted.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          I hope you enjoy using it as much as I enjoyed building it.
        </p>
      </div>
    </section>
  );
}
