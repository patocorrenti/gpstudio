import type { AudioChain } from "@/device/chain";
import { PATCH_COUNT } from "@/device/identity";
import type { DeviceModel } from "@/device/models";

export type WorkingBaseline = {
  chain: AudioChain;
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

export function patchDiffersFromBaseline(
  baseline: WorkingBaseline,
  chain: AudioChain,
  patchVolume: number | null,
  patchBpm: number | null,
  model: DeviceModel,
): boolean {
  if (!chainSlotsEqual(chain, baseline.chain)) {
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
  patchVolume: number | null,
  patchBpm: number | null,
  model: DeviceModel,
): boolean {
  if (chainSync === "syncing" || baseline === null) {
    return false;
  }
  return patchDiffersFromBaseline(baseline, chain, patchVolume, patchBpm, model);
}
