/** Toast when Bluetooth cannot manage User IR files. */
export const IR_USB_REQUIRED = "Managing IRs requires USB.";

type OpenHandler = () => void;

export type UserIrLoadSource = "computer" | "tone3000";

export type UserIrLoadRequest = {
  slot: number;
  source: UserIrLoadSource;
  nonce: number;
};

type LoadListener = (request: UserIrLoadRequest) => void;

let openHandler: OpenHandler | null = null;
let pendingOpen = false;
let loadListener: LoadListener | null = null;
let pendingLoad: UserIrLoadRequest | null = null;

/** PatchBar registers while Controller is mounted. */
export function setUserIrOpenHandler(handler: OpenHandler | null): void {
  openHandler = handler;
  if (handler && pendingOpen) {
    pendingOpen = false;
    handler();
  }
}

/** Opens the IR dialog when Controller has registered a handler. */
export function requestOpenUserIr(): boolean {
  if (!openHandler) {
    pendingOpen = true;
    return false;
  }
  openHandler();
  return true;
}

/** UserIrDialog registers while Controller is mounted. */
export function setUserIrLoadListener(listener: LoadListener | null): void {
  loadListener = listener;
  if (listener && pendingLoad) {
    const request = pendingLoad;
    pendingLoad = null;
    listener(request);
  }
}

/** Starts My Computer / TONE3000 load for User IR slot 1–20. */
export function requestUserIrLoad(slot: number, source: UserIrLoadSource): boolean {
  const request: UserIrLoadRequest = { slot, source, nonce: Date.now() };
  if (!loadListener) {
    pendingLoad = request;
    return false;
  }
  loadListener(request);
  return true;
}
