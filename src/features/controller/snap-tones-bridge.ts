type OpenHandler = () => void;

let openHandler: OpenHandler | null = null;

/** PatchBar registers while Controller is mounted. */
export function setSnapTonesOpenHandler(handler: OpenHandler | null): void {
  openHandler = handler;
}

/** Opens the SnapTones dialog when Controller has registered a handler. */
export function requestOpenSnapTones(): boolean {
  if (!openHandler) {
    return false;
  }
  openHandler();
  return true;
}
