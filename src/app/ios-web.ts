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
