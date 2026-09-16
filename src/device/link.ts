export type LinkMode = "usb" | "bluetooth";

export type LinkCapabilities = {
  liveFromPedal: boolean;
  commandToPedal: boolean;
};

export function capabilitiesForLink(linkMode: LinkMode): LinkCapabilities {
  return {
    liveFromPedal: linkMode === "bluetooth",
    commandToPedal: linkMode === "usb",
  };
}
