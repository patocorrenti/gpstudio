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
const userIr3 = modelByWire("cab", [0x02, 0x00, 0x10, 0x0a]);
const factoryCab = modelByWire("cab", [0x01, 0x00, 0x00, 0x0a]);
const userIr20 = modelByWire("cab", [0x13, 0x00, 0x10, 0x0a]);
if (
  userIr3?.id !== "cab-user-ir-03" ||
  userIr3.label !== "User IR 03" ||
  userIr3.userIrSlot !== 3 ||
  !userIr3.devices.has("gp5") ||
  !userIr3.devices.has("gp50") ||
  userIr3.controls[0]?.label !== "VOL" ||
  userIr3.controls[0]?.max !== 100
) {
  throw new Error("CAB wire 02 00 10 0a must be User IR 03");
}
if (factoryCab?.id !== "cab-twd-cp-1x8") {
  throw new Error("Factory CAB wires must still resolve");
}
if (userIr20?.id !== "cab-user-ir-20" || userIr20.userIrSlot !== 20) {
  throw new Error("CAB wire 13 00 10 0a must be User IR 20");
}

const cWah = BY_ID.get("pre-c-wah");
const acSim = BY_ID.get("pre-ac-sim");
const cabAc = BY_ID.get("cab-ac");
if (!cWah?.devices.has("gp50") || cWah.devices.has("gp5")) {
  throw new Error("C-Wah must be GP-50 only");
}
if (!acSim?.devices.has("gp50") || acSim.devices.has("gp5")) {
  throw new Error("AC Sim must be GP-50 only");
}
if (!cabAc?.devices.has("gp50") || cabAc.devices.has("gp5")) {
  throw new Error("CAB AC must be GP-50 only");
}
if (modelsForKind("pre", "gp5").some((model) => model.id === "pre-c-wah" || model.id === "pre-ac-sim")) {
  throw new Error("GP-5 PRE must omit C-Wah and AC Sim");
}
if (modelsForKind("cab", "gp5").some((model) => model.id === "cab-ac")) {
  throw new Error("GP-5 CAB must omit AC");
}
if (!modelsForKind("pre", "gp50").some((model) => model.id === "pre-c-wah")) {
  throw new Error("GP-50 PRE must include C-Wah");
}

const aChorus = BY_ID.get("mod-a-chorus");
if (!aChorus) {
  throw new Error("MOD catalog must include A-Chorus");
}
const aChorusGp5 = controlsForPedal(aChorus, "gp5");
const aChorusGp50 = controlsForPedal(aChorus, "gp50");
if (aChorusGp5.some((control) => control.label === "Sync")) {
  throw new Error("GP-5 A-Chorus must omit Sync");
}
if (!aChorusGp50.some((control) => control.label === "Sync")) {
  throw new Error("GP-50 A-Chorus must include Sync");
}
const bBoost = BY_ID.get("pre-b-boost");
if (!bBoost) {
  throw new Error("PRE catalog must include B-Boost");
}
for (const pedal of ["gp5", "gp50"] as const) {
  const labels = controlsForPedal(bBoost, pedal).map((control) => control.label);
  if (labels.join(",") !== "Gain,VOL,Bass,Treble") {
    throw new Error(`B-Boost on ${pedal} must be Gain, VOL, Bass, Treble`);
  }
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

export function controlOnPedal(control: FxControl, pedal: DeviceModel): boolean {
  return !control.devices || control.devices.has(pedal);
}

export function controlsForPedal(model: FxModel, pedal: DeviceModel): FxControl[] {
  return model.controls.filter((control) => controlOnPedal(control, pedal));
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

export function controlByIndex(
  model: FxModel,
  index: number,
  pedal?: DeviceModel,
): FxControl | undefined {
  return model.controls.find(
    (control) =>
      control.index === index && (pedal === undefined || controlOnPedal(control, pedal)),
  );
}
