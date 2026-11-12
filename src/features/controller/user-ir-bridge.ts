/** Toast when Bluetooth cannot manage User IR files. */
export const IR_USB_REQUIRED = "Managing IRs requires USB.";

type OpenHandler = () => void;

let openHandler: OpenHandler | null = null;
let pendingOpen = false;

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
