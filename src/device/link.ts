export type LinkMode = "usb" | "bluetooth";

export type LinkCapabilities = {
  liveFromPedal: boolean;
};

export function capabilitiesForLink(linkMode: LinkMode): LinkCapabilities {
  return {
    liveFromPedal: linkMode === "bluetooth",
  };
}
