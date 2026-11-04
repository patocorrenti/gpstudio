type OpenHandler = () => void;

let openHandler: OpenHandler | null = null;
let pendingOpen = false;

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
