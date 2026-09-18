import type { EffectId } from "@/device/chain";
import type { DeviceModel } from "@/device/models";

export type ControlDisplay =
  | "percent"
  | "toggle"
  | "bipolar"
  | "rate"
  | "time"
  | "enum";

export type FxControl = {
  index: number;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  display: ControlDisplay;
};

/** Packed 4-byte wire identity from the current-preset dump / model SET. */
export type WireIdentity = readonly [number, number, number, number];

export type FxModel = {
  id: string;
  kind: EffectId;
  label: string;
  devices: ReadonlySet<DeviceModel>;
  wire: WireIdentity;
  controls: readonly FxControl[];
};
