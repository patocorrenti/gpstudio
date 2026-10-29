import { isTauriRuntime } from "@/midi/detect";

/** Android browsers. The desktop shell is excluded. */
export function isAndroidWeb(): boolean {
  if (typeof navigator === "undefined" || isTauriRuntime()) {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}
