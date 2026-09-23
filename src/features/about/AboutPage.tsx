export function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-10">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            About GP Studio
          </h1>
          <p className="text-sm text-muted-foreground/60">
            GP Studio is an independent controller for Valeton GP-5 and GP-50.
          </p>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          It is the controller I always wanted to have — now that I found the
          pedal I didn't know I always wanted.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The project is headed toward open source. With luck, more people will
          join in, and GP Studio will gain the features they need too.
        </p>
        <div className="space-y-2 border-y border-border/60 py-4 text-muted-foreground leading-relaxed">
          <p>
            <a
              href="https://forms.gle/wbZYesraBR2QevhUA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
            >
              Subscribe
            </a>{" "}
            to stay informed about the project.
          </p>
          <p>
            <a
              href="https://forms.gle/PhvZEPBty96WWzDDA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
            >
              Report a bug
            </a>{" "}
            if something is off.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">What's next</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>
            Stomp control and global pedal settings, so the beta can wrap up
          </li>
          <li>Desktop builds for Windows, Mac, and Linux</li>
          <li>Publish the project as open source</li>
          <li>
            Share it with the community and gather feedback and ideas
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Changelog</h2>
        <h3 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-mono">Version 0.2.2</span>
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Fixed Bluetooth disconnecting after the first preset dump</li>
          <li>Fixed console errors on app load</li>
        </ul>
        <h3 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-mono">Version 0.2.1</span>
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Global settings control for GP-5</li>
        </ul>
        <h3 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-mono">Version 0.2.0</span>
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Removed the blink when changing patches over Bluetooth</li>
          <li>Global settings control for GP-50</li>
          <li>Patch volume (GP-5 and GP-50) and patch BPM (GP-50) on the patch bar</li>
          <li>Separate module catalogs for GP-5 and GP-50</li>
          <li>User IR support for CAB slots</li>
          <li>Patch search</li>
          <li>Model search with description and Based on</li>
        </ul>
        <h3 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-mono">Version 0.1.1</span>
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Faster and more stable connection to the pedal</li>
        </ul>
        <h3 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-mono">Version 0.1.0</span>
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground leading-relaxed marker:text-muted-foreground/40">
          <li>Connect GP-5 and GP-50 over USB and Bluetooth</li>
          <li>Live patch control (00–99) with names from the pedal</li>
          <li>
            Current-patch audio chain: on/off, order, factory models, and knobs
          </li>
          <li>Drag-and-drop reorder of movable modules</li>
          <li>Save, rename, and duplicate the current patch</li>
          <li>
            Download and load Valeton .prst files for the connected model
          </li>
          <li>Follow live pedal changes over Bluetooth</li>
          <li>MIDI in log</li>
          <li>Light and dark appearance</li>
        </ul>
      </div>
    </section>
  );
}
