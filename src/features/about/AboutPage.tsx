import { Bug, Download, Heart, Mail } from "lucide-react";
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

export function AboutPage() {
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
              Version 1.0.0-beta.3
            </a>{" "}
            · Free controller for the Valeton GP-5/50 multi-effects.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 min-[42rem]:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <Button
            asChild
            variant="default"
            className={`${actionButtonClassName} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600`}
          >
            <a
              href="https://ko-fi.com/patocorrenti"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Heart
                className="size-5 shrink-0 fill-current motion-safe:animate-heartbeat"
                aria-hidden
              />
              <span className={actionLabelClassName}>
                <span className="text-sm font-semibold">
                  Support GP Studio
                </span>
                <span className="text-xs font-normal opacity-70">
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

      <div className="space-y-5 border-t border-border pt-6">
        <h2 className="text-xl font-semibold tracking-tight">Install GP Studio</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>
            <span className="font-medium text-foreground/80">Works offline.</span>{" "}
            Tweak your tones anywhere, no internet needed.
          </li>
          <li>
            <span className="font-medium text-foreground/80">Feels like a real app.</span>{" "}
            Own window, Start menu and taskbar, no browser tabs.
          </li>
          <li>
            <span className="font-medium text-foreground/80">Always up to date.</span>{" "}
            New features arrive automatically.
          </li>
        </ul>
        <div className="flex flex-col items-start gap-3 min-[500px]:flex-row min-[500px]:items-center">
          <Button type="button" variant="outline" className="h-11 gap-2 px-4">
            <Download className="size-4 shrink-0" aria-hidden />
            Install from your browser
          </Button>
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
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground/60">
          Works on Windows, Mac and Linux (Chrome or Edge) and Android (Chrome,
          Bluetooth only).
          <br />
          iPhone and iPad can&apos;t connect to the pedal.
        </p>
      </div>

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
            Pato
          </a>
          , a hobby guitarist, product designer, and developer.
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
