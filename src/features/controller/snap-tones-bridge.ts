/** Toast when Bluetooth cannot manage SnapTone files. */
export const SNAP_USB_REQUIRED = "Managing SnapTones requires USB.";

type OpenHandler = () => void;

export type SnapToneLoadSource = "computer" | "tone3000";

export type SnapToneLoadRequest = {
  slot: number;
  source: SnapToneLoadSource;
  nonce: number;
};

type LoadListener = (request: SnapToneLoadRequest) => void;

let openHandler: OpenHandler | null = null;
let pendingOpen = false;

let loadListener: LoadListener | null = null;
let pendingLoad: SnapToneLoadRequest | null = null;

/** PatchBar registers while Controller is mounted. */
export function setSnapTonesOpenHandler(handler: OpenHandler | null): void {
  openHandler = handler;
  if (handler && pendingOpen) {
    pendingOpen = false;
    handler();
  }
}

/** Opens the SnapTones dialog when Controller has registered a handler. */
export function requestOpenSnapTones(): boolean {
  if (!openHandler) {
    pendingOpen = true;
    return false;
  }
  openHandler();
  return true;
}

/** SnapToneDialog registers while Controller is mounted. */
export function setSnapToneLoadListener(listener: LoadListener | null): void {
  loadListener = listener;
  if (listener && pendingLoad) {
    const request = pendingLoad;
    pendingLoad = null;
    listener(request);
  }
}

/** Starts My Computer / TONE3000 load for a user SnapTone slot (50–79). */
export function requestSnapToneLoad(slot: number, source: SnapToneLoadSource): boolean {
  const request: SnapToneLoadRequest = { slot, source, nonce: Date.now() };
  if (!loadListener) {
    pendingLoad = request;
    return false;
  }
  loadListener(request);
  return true;
}
