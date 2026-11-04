export type SnapTonesOpenOptions = {
  /** When false, factory SnapTones are omitted. Default true. */
  showFactory?: boolean;
};

type OpenHandler = (options?: SnapTonesOpenOptions) => void;

let openHandler: OpenHandler | null = null;

/** PatchBar registers while Controller is mounted. */
export function setSnapTonesOpenHandler(handler: OpenHandler | null): void {
  openHandler = handler;
}

/** Opens the SnapTones dialog when Controller has registered a handler. */
export function requestOpenSnapTones(options?: SnapTonesOpenOptions): boolean {
  if (!openHandler) {
    return false;
  }
  openHandler(options);
  return true;
}
