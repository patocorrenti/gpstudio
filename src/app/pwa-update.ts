/**
 * Service worker update checks. Browsers only look for a new sw.js on navigation, so an installed
 * PWA that is resumed from the background (common on Android) can keep running an old version for
 * days. We also check when the app comes back to the foreground, every hour, and on demand.
 */

type Listener = () => void;

export type AppUpdateState = "unavailable" | "idle" | "ready";
export type AppUpdateCheck = "current" | "downloading" | "ready" | "failed" | "unavailable";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MIN_FOREGROUND_GAP_MS = 60 * 1000;

let registration: ServiceWorkerRegistration | null = null;
let applyUpdate: (() => Promise<void>) | null = null;
let updateReady = false;
let lastCheck = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Called once the service worker is registered: starts the background checks. */
export function trackPwaUpdates(
  reg: ServiceWorkerRegistration,
  apply: () => Promise<void>,
): void {
  registration = reg;
  applyUpdate = apply;
  lastCheck = Date.now();
  notify();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastCheck > MIN_FOREGROUND_GAP_MS) {
      void checkForAppUpdate();
    }
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void checkForAppUpdate();
    }
  }, CHECK_INTERVAL_MS);
}

/** Called when a new version is installed and waiting for a reload. */
export function markPwaUpdateReady(): void {
  updateReady = true;
  notify();
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppUpdateState(): AppUpdateState {
  if (!registration) {
    return "unavailable";
  }
  return updateReady ? "ready" : "idle";
}

/** Asks the server for a newer sw.js. When there is one, the update toast shows once it is installed. */
export async function checkForAppUpdate(): Promise<AppUpdateCheck> {
  if (!registration) {
    return "unavailable";
  }
  if (updateReady || registration.waiting) {
    return "ready";
  }
  lastCheck = Date.now();
  try {
    await registration.update();
  } catch {
    return "failed";
  }
  if (registration.waiting) {
    return "ready";
  }
  return registration.installing ? "downloading" : "current";
}

/** Activates the waiting version and reloads the app. */
export async function applyAppUpdate(): Promise<void> {
  await applyUpdate?.();
}
