export function IosWebNotice() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <section
        role="status"
        aria-labelledby="ios-web-notice-title"
        className="w-full max-w-sm rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10"
      >
        <h2 id="ios-web-notice-title" className="text-base font-medium">
          Connecting from iPhone or iPad isn't supported for now
        </h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          GP Studio talks to the pedal over USB and Bluetooth. iPhone and iPad
          block that in every browser, including Chrome.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          <a
            href="https://forms.gle/wbZYesraBR2QevhUA"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            Subscribe
          </a>{" "}
          to stay informed about the project.
        </p>
      </section>
    </div>
  );
}
