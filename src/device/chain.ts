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

/** Manual: NR, PRE, MOD, DLY, RVB can move. */
export const MOVABLE_EFFECTS: ReadonlySet<EffectId> = new Set([
  "nr",
  "pre",
  "mod",
  "dly",
  "rvb",
]);

/** Manual: DST, NS, AMP, CAB, EQ stay fixed and contiguous, in this order. */
export const FIXED_EFFECT_ORDER = ["dst", "ns", "amp", "cab", "eq"] as const;

export const FIXED_EFFECTS: ReadonlySet<EffectId> = new Set(FIXED_EFFECT_ORDER);

export function chainSlotLabel(id: ChainSlotId): string {
  return CHAIN_LABELS[id];
}

export function isMovableEffect(id: ChainSlotId): id is EffectId {
  return id !== "exp" && MOVABLE_EFFECTS.has(id);
}

function isFixedEffect(id: ChainSlotId): id is EffectId {
  return id !== "exp" && FIXED_EFFECTS.has(id);
}

/** DST…EQ stay one contiguous block in FIXED_EFFECT_ORDER. No module between them. */
function fixedBlockIntact(chain: AudioChain): boolean {
  const effects = chain.filter((slot) => slot.id !== "exp");
  const start = effects.findIndex((slot) => slot.id === FIXED_EFFECT_ORDER[0]);
  if (start < 0) {
    return false;
  }
  for (let offset = 0; offset < FIXED_EFFECT_ORDER.length; offset += 1) {
    if (effects[start + offset]?.id !== FIXED_EFFECT_ORDER[offset]) {
      return false;
    }
  }
  const fixedCount = effects.filter((slot) => isFixedEffect(slot.id)).length;
  return fixedCount === FIXED_EFFECT_ORDER.length;
}

/**
 * Move one movable effect among the ten effect slots.
 * Invalid moves (fixed/EXP/same index/out of range, or a split of the
 * DST–NS–AMP–CAB–EQ block) return the same array.
 * EXP stays last on GP-50. Each slot keeps its `enabled`.
 */
export function reorderChain(
  chain: AudioChain,
  fromIndex: number,
  toIndex: number,
): AudioChain {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= chain.length ||
    toIndex >= chain.length
  ) {
    return chain;
  }
  const from = chain[fromIndex];
  const to = chain[toIndex];
  if (!isMovableEffect(from.id) || to.id === "exp") {
    return chain;
  }
  const next = chain.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  if (!fixedBlockIntact(next)) {
    return chain;
  }
  return next;
}

const BYPASSED_WHEN_NS_ON: ReadonlySet<ChainSlotId> = new Set(["amp", "cab"]);

/** AMP and CAB are bypassed while NS is on. Does not change stored on/off. */
export function chainSlotBypassed(chain: AudioChain, id: ChainSlotId): boolean {
  if (!BYPASSED_WHEN_NS_ON.has(id)) {
    return false;
  }
  return chain.some((slot) => slot.id === "ns" && slot.enabled);
}

export function defaultChain(model: DeviceModel): AudioChain {
  const slots: AudioChain = EFFECT_IDS.map((id) => ({ id, enabled: false }));
  if (model === "gp50") {
    slots.push({ id: "exp", enabled: false });
  }
  return slots;
}
