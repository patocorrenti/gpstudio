export function isNativeDesktop(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window as Window & { isTauri?: boolean };
  return host.isTauri === true || "__TAURI_INTERNALS__" in window;
}

export function isTone3000ControlVisible(input: {
  connected: boolean;
  usb: boolean;
  publishableKey: string;
  tauri: boolean;
}): boolean {
  return input.connected && input.usb && input.publishableKey.trim().length > 0 && !input.tauri;
}

function assertVisibility(): void {
  const key = "pub_key";
  if (!isTone3000ControlVisible({ connected: true, usb: true, publishableKey: key, tauri: false })) {
    throw new Error("USB with a publishable key must show the control");
  }
  if (isTone3000ControlVisible({ connected: true, usb: false, publishableKey: key, tauri: false })) {
    throw new Error("Bluetooth must hide the control");
  }
  if (isTone3000ControlVisible({ connected: false, usb: false, publishableKey: key, tauri: false })) {
    throw new Error("A disconnected pedal must hide the control");
  }
  if (isTone3000ControlVisible({ connected: true, usb: true, publishableKey: key, tauri: true })) {
    throw new Error("The native window must hide the control");
  }
  if (isTone3000ControlVisible({ connected: true, usb: true, publishableKey: "  ", tauri: false })) {
    throw new Error("An empty publishable key must hide the control");
  }
}

assertVisibility();
