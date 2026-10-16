import { isTauriRuntime } from "@/midi/detect";

/** Chromium `beforeinstallprompt` event (not in all lib.dom typings). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;

export function initPwaInstallPrompt(): void {
  if (isTauriRuntime() || listening || typeof window === "undefined") {
    return;
  }
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export type PwaInstallResult = "prompted" | "installed" | "unavailable";

/** Show the browser install UI when a deferred prompt is available. */
export async function promptPwaInstall(): Promise<PwaInstallResult> {
  if (isPwaInstalled()) {
    return "installed";
  }
  if (!deferredPrompt) {
    return "unavailable";
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  await promptEvent.prompt();
  await promptEvent.userChoice;
  return "prompted";
}
