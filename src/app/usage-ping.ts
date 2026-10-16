import { isPwaInstalled } from "@/app/pwa-install";

declare const __APP_VERSION__: string;

/** Best-effort open ping for the production web app. Failures are ignored. */
export function reportUsageOpen(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  const mode = isPwaInstalled() ? "standalone" : "browser";
  const params = new URLSearchParams({
    v: __APP_VERSION__,
    mode,
  });
  void fetch(`/usage?${params}`, {
    method: "GET",
    cache: "no-store",
    keepalive: true,
  }).catch(() => {});
}
