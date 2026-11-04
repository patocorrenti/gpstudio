export const TONE3000_WINDOW_NAME = "gpstudio-tone3000";

const POPUP_FEATURES = "popup,width=520,height=760";

let held: Window | null = null;

/** Call during the click that starts Tone3000. A later open is blocked. */
export function openTone3000Popup(): Window | null {
  const popup = window.open("", TONE3000_WINDOW_NAME, POPUP_FEATURES);
  if (!popup) {
    return null;
  }
  return popup;
}

export function holdTone3000Popup(popup: Window): void {
  held = popup;
}

export function peekTone3000Popup(): Window | null {
  return held;
}

export function takeTone3000Popup(): Window | null {
  const popup = held;
  held = null;
  return popup;
}

export function navigateTone3000Popup(popup: Window, url: string): void {
  popup.location.href = url;
  popup.focus();
}

export function closeTone3000Popup(popup: Window | null): void {
  if (popup && !popup.closed) {
    popup.close();
  }
}
