import { AMP_MODELS } from "@/device/catalog/amp";
import { CAB_MODELS } from "@/device/catalog/cab";
import { DLY_MODELS } from "@/device/catalog/dly";
import { DST_MODELS } from "@/device/catalog/dst";
import { EQ_MODELS } from "@/device/catalog/eq";
import { MOD_MODELS } from "@/device/catalog/mod";
import { NR_MODELS } from "@/device/catalog/nr";
import { NS_MODELS } from "@/device/catalog/ns";
import { PRE_MODELS } from "@/device/catalog/pre";
import { RVB_MODELS } from "@/device/catalog/rvb";
import type { FxControl, FxModel, WireIdentity } from "@/device/catalog/types";
import type { EffectId } from "@/device/chain";
import type { DeviceModel } from "@/device/models";

export type { ControlDisplay, FxControl, FxModel, WireIdentity } from "@/device/catalog/types";

const MODELS_BY_KIND: Record<EffectId, readonly FxModel[]> = {
  nr: NR_MODELS,
  pre: PRE_MODELS,
  dst: DST_MODELS,
  ns: NS_MODELS,
  amp: AMP_MODELS,
  cab: CAB_MODELS,
  eq: EQ_MODELS,
  mod: MOD_MODELS,
  dly: DLY_MODELS,
  rvb: RVB_MODELS,
};

/** Dump float slots per kind (hidden padding indexes included). */
export const KIND_VALUE_COUNT: Record<EffectId, number> = {
  nr: 1,
  pre: 7,
  dst: 5,
  ns: 5,
  amp: 7,
  cab: 1,
  eq: 6,
  mod: 5,
  dly: 8,
  rvb: 7,
};

function wireKey(wire: WireIdentity): string {
  return wire.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const BY_ID = new Map<string, FxModel>();
const BY_KIND_WIRE = new Map<string, FxModel>();

for (const models of Object.values(MODELS_BY_KIND)) {
  for (const model of models) {
    if (BY_ID.has(model.id)) {
      throw new Error(`Duplicate factory model id ${model.id}`);
    }
    BY_ID.set(model.id, model);
    const key = `${model.kind}:${wireKey(model.wire)}`;
    if (BY_KIND_WIRE.has(key)) {
      throw new Error(`Duplicate wire identity for ${model.kind}: ${key}`);
    }
    BY_KIND_WIRE.set(key, model);
  }
}

const tweedy = BY_ID.get("amp-tweedy");
const bellman = BY_ID.get("amp-bellman-59n");
if (!tweedy || !bellman) {
  throw new Error("AMP catalog must include Tweedy and Bellman 59N");
}
if (
  tweedy.controls.length === bellman.controls.length &&
  tweedy.controls.every(
    (control, index) =>
      control.label === bellman.controls[index]?.label &&
      control.index === bellman.controls[index]?.index,
  )
) {
  throw new Error("Tweedy and Bellman 59N must have distinct control sets");
}

export function modelsForKind(kind: EffectId, pedal: DeviceModel): FxModel[] {
  return MODELS_BY_KIND[kind].filter((model) => model.devices.has(pedal));
}

export function modelById(id: string): FxModel | undefined {
  return BY_ID.get(id);
}

export function modelByWire(kind: EffectId, wire: WireIdentity): FxModel | undefined {
  return BY_KIND_WIRE.get(`${kind}:${wireKey(wire)}`);
}

export function defaultValuesFor(model: FxModel): number[] {
  const values = Array.from({ length: KIND_VALUE_COUNT[model.kind] }, () => 0);
  for (const control of model.controls) {
    if (control.index >= 0 && control.index < values.length) {
      values[control.index] = control.default;
    }
  }
  return values;
}

export function snapControlValue(control: FxControl, value: number): number {
  if (!Number.isFinite(value)) {
    return control.default;
  }
  const clamped = Math.min(control.max, Math.max(control.min, value));
  if (!(control.step > 0)) {
    return clamped;
  }
  const snapped =
    control.min + Math.round((clamped - control.min) / control.step) * control.step;
  const bounded = Math.min(control.max, Math.max(control.min, snapped));
  if (control.step >= 1) {
    return bounded;
  }
  const decimals = String(control.step).split(".")[1]?.length ?? 0;
  return Number(bounded.toFixed(decimals));
}

export function snapModelValues(model: FxModel, raw: number[]): number[] {
  const values = Array.from({ length: KIND_VALUE_COUNT[model.kind] }, (_, index) => {
    const next = raw[index];
    return Number.isFinite(next) ? next : 0;
  });
  for (const control of model.controls) {
    if (control.index >= 0 && control.index < values.length) {
      values[control.index] = snapControlValue(control, values[control.index] ?? control.default);
    }
  }
  return values;
}

export function controlByIndex(model: FxModel, index: number): FxControl | undefined {
  return model.controls.find((control) => control.index === index);
}
