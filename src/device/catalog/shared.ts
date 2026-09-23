import type { DeviceModel } from "@/device/models";

export const BOTH_PEDALS: ReadonlySet<DeviceModel> = new Set(["gp5", "gp50"]);
export const GP50_ONLY: ReadonlySet<DeviceModel> = new Set(["gp50"]);
export const GP5_ONLY: ReadonlySet<DeviceModel> = new Set(["gp5"]);
