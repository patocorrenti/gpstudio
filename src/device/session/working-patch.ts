import type { AudioChain, EffectId } from "@/device/chain";
import type { StompAssignment } from "@/device/chain-codec";
import { PATCH_COUNT } from "@/device/identity";
import type { DeviceModel } from "@/device/models";

export type WorkingBaseline = {
  chain: AudioChain;
  stomps: StompAssignment;
  patchVolume: number | null;
  patchBpm: number | null;
};

export function clampPatch(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(PATCH_COUNT - 1, Math.max(0, Math.trunc(value)));
}

export function wrapPatch(value: number): number {
  return ((value % PATCH_COUNT) + PATCH_COUNT) % PATCH_COUNT;
}

export function preserveExpEnabled(previous: AudioChain, next: AudioChain): AudioChain {
  const previousExp = previous.find((slot) => slot.id === "exp");
  if (!previousExp) {
    return next;
  }
  return next.map((slot) =>
    slot.id === "exp" ? { ...slot, enabled: previousExp.enabled } : slot,
  );
}

export function chainSlotsEqual(left: AudioChain, right: AudioChain): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a.id !== b.id || a.enabled !== b.enabled || a.modelId !== b.modelId) {
      return false;
    }
    const aValues = a.values;
    const bValues = b.values;
    if (aValues === undefined || bValues === undefined) {
      if (aValues !== bValues) {
        return false;
      }
      continue;
    }
    if (aValues.length !== bValues.length) {
      return false;
    }
    for (let valueIndex = 0; valueIndex < aValues.length; valueIndex += 1) {
      if (aValues[valueIndex] !== bValues[valueIndex]) {
        return false;
      }
    }
  }
  return true;
}

export function cloneChain(chain: AudioChain): AudioChain {
  return chain.map((slot) => ({
    ...slot,
    values: slot.values ? slot.values.slice() : undefined,
  }));
}

export function cloneStomps(stomps: StompAssignment): StompAssignment {
  return stomps.map((list) => list.slice());
}

/** Same effects per foot; order inside a foot does not matter. */
export function stompsEqual(left: StompAssignment, right: StompAssignment): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (!stompFootEqual(left[index], right[index])) {
      return false;
    }
  }
  return true;
}

function stompFootEqual(left: readonly EffectId[], right: readonly EffectId[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const counts = new Map<EffectId, number>();
  for (const id of left) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const id of right) {
    const next = (counts.get(id) ?? 0) - 1;
    if (next < 0) {
      return false;
    }
    counts.set(id, next);
  }
  return true;
}

export function patchDiffersFromBaseline(
  baseline: WorkingBaseline,
  chain: AudioChain,
  stomps: StompAssignment,
  patchVolume: number | null,
  patchBpm: number | null,
  model: DeviceModel,
): boolean {
  if (!chainSlotsEqual(chain, baseline.chain)) {
    return true;
  }
  if (!stompsEqual(stomps, baseline.stomps)) {
    return true;
  }
  if (patchVolume !== baseline.patchVolume) {
    return true;
  }
  return model === "gp50" && patchBpm !== baseline.patchBpm;
}

export function isWorkingModified(
  baseline: WorkingBaseline | null,
  chain: AudioChain,
  chainSync: "idle" | "syncing",
  stomps: StompAssignment,
  patchVolume: number | null,
  patchBpm: number | null,
  model: DeviceModel,
): boolean {
  if (chainSync === "syncing" || baseline === null) {
    return false;
  }
  return patchDiffersFromBaseline(baseline, chain, stomps, patchVolume, patchBpm, model);
}
