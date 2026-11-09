import { isTauriRuntime } from "@/midi/detect";

/**
 * iPhone, iPod, and iPad browsers, including iPadOS desktop mode
 * (Macintosh UA with a touch screen). The desktop shell is excluded.
 */
export function isIosWeb(): boolean {
  if (typeof navigator === "undefined" || isTauriRuntime()) {
    return false;
  }
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * True when this browser exposes Web Bluetooth. Safari and Chrome on iPhone
 * and iPad do not. Bluefy does, and desktop Chrome and Edge do too.
 */
export function hasWebBluetooth(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const bluetooth = (navigator as Navigator & { bluetooth?: unknown }).bluetooth;
  return typeof bluetooth === "object" && bluetooth !== null;
}
