import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const CHANGELOG = [
  {
    version: "1.0.0-beta.2",
    notes: [
      "User SnapTone slots on NS, with names from the pedal",
      "Warn when downloading a patch that includes a custom SnapTone",
    ],
  },
  {
    version: "1.0.0-beta.1",
    notes: [
      "Quick connect remembers your pedals and connection preferences and connects automatically when the app opens",
      "Import and export presets between GP-5 and GP-50",
      "Global settings for GP-5",
      "Verifies the GP-50 is powered on when connecting over USB",
      "Responsive layout for phones",
    ],
  },
  {
    version: "0.5.0",
    notes: [
      "Added GP-5 compatibility",
      "Improved Bluetooth connection stability",
      "Improved USB connection stability",
    ],
  },
  {
    version: "0.4.0",
    notes: [
      "Footswitch and tuner control",
      "Many UI improvements",
      "Removed the upload warning when the patch has no changes",
      "Warn when downloading a patch that includes a custom IR",
      "Fixed custom IR names not showing over USB",
      "Released under the MIT license",
      "New connection screen",
      "Simplified Web Bluetooth connection steps",
    ],
  },
  {
    version: "0.3.1",
    notes: [
      "Substantial improvement to connection stability",
      "Unified connection strategy for USB and Bluetooth",
    ],
  },
  {
    version: "0.3.0",
    notes: ["Stomp control for GP-5 and Footswitch A-B for GP-50"],
  },
  {
    version: "0.2.2",
    notes: [
      "Fixed Bluetooth disconnecting after the first preset dump",
      "Fixed console errors on app load",
    ],
  },
  {
    version: "0.2.1",
    notes: ["Global settings control for GP-5"],
  },
  {
    version: "0.2.0",
    notes: [
      "Removed the blink when changing patches over Bluetooth",
      "Global settings control for GP-50",
      "Patch volume (GP-5 and GP-50) and patch BPM (GP-50) on the patch bar",
      "Separate module catalogs for GP-5 and GP-50",
      "User IR support for CAB slots",
      "Patch search",
      "Model search with description and Based on",
    ],
  },
  {
    version: "0.1.1",
    notes: ["Faster and more stable connection to the pedal"],
  },
  {
    version: "0.1.0",
    notes: [
      "Connect GP-5 and GP-50 over USB and Bluetooth",
      "Live patch control (00–99) with names from the pedal",
      "Current-patch audio chain: on/off, order, factory models, and knobs",
      "Drag-and-drop reorder of movable modules",
      "Save, rename, and duplicate the current patch",
      "Download and load Valeton .prst files for the connected model",
      "Follow live pedal changes over Bluetooth",
      "MIDI in log",
      "Light and dark appearance",
    ],
  },
] as const;

function ChangelogVersion({
  version,
  notes,
  defaultOpen = false,
}: {
  version: string;
  notes: readonly string[];
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/changelog">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]/changelog:rotate-90" />
        <span className="font-mono text-foreground">Version {version}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="list-disc space-y-2 pb-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-10">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            About GP Studio
          </h1>
          <p className="text-sm text-muted-foreground/60">
            GP Studio is an independent controller for the Valeton GP-5 and
            GP-50 multi-effects processors.
          </p>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          I'm{" "}
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
          now that I found the pedal I didn't know I always wanted.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          It's{" "}
          <a
            href="https://github.com/patocorrenti/gpstudio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
          >
            open source
          </a>
          , and I hope other people will find it useful, contribute to it, and
          help extend support to more models and platforms.
        </p>
        <div className="rounded-xl bg-muted/60 p-4 sm:p-5">
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="default"
              className="h-auto flex-col items-start gap-0.5 whitespace-normal border-emerald-600 bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-500 hover:text-white dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              <a
                href="https://github.com/sponsors/patocorrenti"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-sm font-semibold">Support GP Studio</span>
                <span className="text-xs font-normal opacity-70">
                  if you like it
                </span>
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 whitespace-normal px-4 py-3"
            >
              <a
                href="https://github.com/patocorrenti/gpstudio"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-sm font-semibold text-foreground">
                  Get the code
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  is open source
                </span>
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 whitespace-normal px-4 py-3"
            >
              <a
                href="https://forms.gle/wbZYesraBR2QevhUA"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-sm font-semibold text-foreground">
                  Subscribe
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  to stay informed
                </span>
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 whitespace-normal px-4 py-3"
            >
              <a
                href="https://forms.gle/PhvZEPBty96WWzDDA"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-sm font-semibold text-foreground">
                  Report a Bug
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  if something is off
                </span>
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">What's next</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Desktop builds for Windows, Mac, and Linux</li>
          <li>Publish the project as open source</li>
          <li>
            Share it with the community and gather feedback and ideas
          </li>
        </ul>
      </div>

      <div className="space-y-1 border-t border-border pt-10">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Changelog</h2>
        {CHANGELOG.map((entry, index) => (
          <ChangelogVersion
            key={entry.version}
            version={entry.version}
            notes={entry.notes}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
