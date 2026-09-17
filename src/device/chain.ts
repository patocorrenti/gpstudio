import type { DeviceModel } from "@/device/models";

export const EFFECT_IDS = [
  "nr",
  "pre",
  "dst",
  "ns",
  "amp",
  "cab",
  "eq",
  "mod",
  "dly",
  "rvb",
] as const;

export type EffectId = (typeof EFFECT_IDS)[number];
export type ChainSlotId = EffectId | "exp";

export type AudioChainSlot = {
  id: ChainSlotId;
  enabled: boolean;
};

export type AudioChain = AudioChainSlot[];

export const CHAIN_LABELS: Record<ChainSlotId, string> = {
  nr: "NR",
  pre: "PRE",
  dst: "DST",
  ns: "NS",
  amp: "AMP",
  cab: "CAB",
  eq: "EQ",
  mod: "MOD",
  dly: "DLY",
  rvb: "RVB",
  exp: "EXP",
};

/** Manual: NR, PRE, MOD, DLY, RVB can move. Stored for a later edit change. */
export const MOVABLE_EFFECTS: ReadonlySet<EffectId> = new Set([
  "nr",
  "pre",
  "mod",
  "dly",
  "rvb",
]);

/** Manual: DST, NS, AMP, CAB, EQ stay fixed. Stored for a later edit change. */
export const FIXED_EFFECTS: ReadonlySet<EffectId> = new Set([
  "dst",
  "ns",
  "amp",
  "cab",
  "eq",
]);

export function chainSlotLabel(id: ChainSlotId): string {
  return CHAIN_LABELS[id];
}

export function defaultChain(model: DeviceModel): AudioChain {
  const slots: AudioChain = EFFECT_IDS.map((id) => ({ id, enabled: false }));
  if (model === "gp50") {
    slots.push({ id: "exp", enabled: false });
  }
  return slots;
}
