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
