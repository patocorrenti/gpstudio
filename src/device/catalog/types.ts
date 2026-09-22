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
  /** Manual / factory blurb for this model. */
  description?: string;
  /** Named gear this model is based on, when the description identifies one. */
  basedOn?: string;
  devices: ReadonlySet<DeviceModel>;
  wire: WireIdentity;
  /** Onboard user-IR slot 1–20. Catalog label stays the English fallback. */
  userIrSlot?: number;
  controls: readonly FxControl[];
};
