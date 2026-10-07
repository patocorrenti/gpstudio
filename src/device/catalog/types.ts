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
  /** Omit for both pedals. */
  devices?: ReadonlySet<DeviceModel>;
};

/** Packed 4-byte wire identity from the current-preset dump / model SET. */
export type WireIdentity = readonly [number, number, number, number];

export type FxModel = {
  id: string;
  kind: EffectId;
  label: string;
  /** Manual / factory blurb for this model. */
  description?: string;
  /** Shown under the model name. Starts with "Based on" so it reads as a reference. */
  basedOn?: string;
  devices: ReadonlySet<DeviceModel>;
  wire: WireIdentity;
  /** Onboard user-IR slot 1–20. Catalog label stays the English fallback. */
  userIrSlot?: number;
  /** Onboard user SnapTone slot 1–24. Catalog label stays the English fallback. */
  userNsSlot?: number;
  controls: readonly FxControl[];
};
