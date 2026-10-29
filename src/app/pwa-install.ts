import { isTauriRuntime } from "@/midi/detect";

/** Chromium `beforeinstallprompt` event (not in all lib.dom typings). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallAvailability = "installable" | "installed" | "unavailable";

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function initPwaInstallPrompt(): void {
  if (isTauriRuntime() || listening || typeof window === "undefined") {
    return;
  }
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribePwaInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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

export function getPwaInstallAvailability(): PwaInstallAvailability {
  if (isPwaInstalled()) {
    return "installed";
  }
  if (deferredPrompt) {
    return "installable";
  }
  return "unavailable";
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
  notify();
  await promptEvent.prompt();
  await promptEvent.userChoice;
  notify();
  return "prompted";
}
