export type DeviceModel = "gp5" | "gp50";

export function displayModelName(model: DeviceModel): string {
  return model === "gp50" ? "GP-50" : "GP-5";
}

/** Heuristic from a USB MIDI port label. GP-50 is matched before GP-5. */
export function suggestModelFromLabel(label: string): DeviceModel | undefined {
  if (/gp-?50/i.test(label)) {
    return "gp50";
  }
  if (/gp-?5(?!0)/i.test(label)) {
    return "gp5";
  }
  return undefined;
}
