import { effectIdForModuleCc, gp50Cc, moduleEnabledFromCc } from "@/device/cc";
import {
  controlByIndex,
  defaultValuesFor,
  modelById,
  modelByWire,
  modelsForKind,
  snapControlValue,
  type WireIdentity,
} from "@/device/catalog";
import type { AudioChain, ChainSlotId, EffectId } from "@/device/chain";
import {
  decodeLiveChainOrder,
  decodeLiveOnOffChanges,
  decodeLivePatchVolume,
  decodeLiveSlotControl,
  decodeLiveSlotModel,
} from "@/device/chain-codec";
import { capabilitiesForLink } from "@/device/link";
import { writeDumpPatchVolume } from "@/device/patch-store";
import type { ChainSync, SessionSnapshot } from "@/device/session/device-session";
import {
  controlWriteKey,
  PATCH_VOLUME_WRITE_KEY,
} from "@/device/session/writes";

export type ConnectedSnapshot = Extract<SessionSnapshot, { status: "connected" }>;

export type LiveFollowHost = {
  snapshot: ConnectedSnapshot;
  currentPatchDump: Uint8Array | null;
  dropPatchWrite: (key: string, sentValue: number) => void;
  dropControlWrite: (key: string, sentValue: number) => void;
  clearControlWritesForKind: (kind: EffectId) => void;
  setChain: (chain: AudioChain) => void;
  isWorkingModified: (chain: AudioChain, chainSync: ChainSync) => boolean;
  assignSnapshot: (next: ConnectedSnapshot) => void;
  emitSnapshot: () => void;
};

export function applyLivePatchVolume(host: LiveFollowHost, message: Uint8Array): boolean {
  const volume = decodeLivePatchVolume(message);
  if (volume === null) {
    return false;
  }
  if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
    return true;
  }
  if (host.snapshot.chainSync === "syncing") {
    return true;
  }
  host.dropPatchWrite(PATCH_VOLUME_WRITE_KEY, volume);
  if (host.snapshot.patchVolume === volume) {
    return true;
  }
  if (host.currentPatchDump) {
    writeDumpPatchVolume(host.snapshot.model, host.currentPatchDump, volume);
  }
  const next = { ...host.snapshot, patchVolume: volume };
  host.assignSnapshot({
    ...next,
    modified: host.isWorkingModified(next.chain, next.chainSync),
  });
  host.emitSnapshot();
  return true;
}

export function applyLiveModule(host: LiveFollowHost, message: Uint8Array): boolean {
  const fromCc = decodeLiveOnOffCc(message);
  const reports = fromCc ? [fromCc] : decodeLiveOnOffChanges(message);
  if (reports.length === 0) {
    return false;
  }
  if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
    return true;
  }
  if (host.snapshot.chainSync === "syncing") {
    return true;
  }
  for (const report of reports) {
    setChainSlotEnabled(host, report.id, report.enabled);
  }
  return true;
}

export function applyLiveChainOrder(host: LiveFollowHost, message: Uint8Array): boolean {
  const order = decodeLiveChainOrder(message);
  if (!order) {
    return false;
  }
  if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
    return true;
  }
  if (host.snapshot.chainSync === "syncing") {
    return true;
  }
  const previousById = new Map(host.snapshot.chain.map((slot) => [slot.id, slot] as const));
  const exp = host.snapshot.chain.find((slot) => slot.id === "exp");
  const chain: AudioChain = order.map((id) => {
    const previous = previousById.get(id);
    return {
      id,
      enabled: previous?.enabled ?? false,
      modelId: previous?.modelId,
      values: previous?.values,
    };
  });
  if (exp) {
    chain.push({ id: "exp", enabled: exp.enabled });
  }
  host.setChain(chain);
  return true;
}

export function applyLiveSlot(host: LiveFollowHost, message: Uint8Array): boolean {
  const modelChange = decodeLiveSlotModel(message);
  if (modelChange) {
    if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
      return true;
    }
    applyLiveSlotModel(host, modelChange.kind, modelChange.wire);
    return true;
  }
  const controlChange = decodeLiveSlotControl(message);
  if (!controlChange) {
    return false;
  }
  if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
    return true;
  }
  applyLiveSlotControl(host, controlChange.kind, controlChange.index, controlChange.value);
  return true;
}

function applyLiveSlotModel(host: LiveFollowHost, kind: EffectId, wire: WireIdentity): void {
  if (host.snapshot.sync !== "ready" || host.snapshot.chainSync === "syncing") {
    return;
  }
  const index = host.snapshot.chain.findIndex((slot) => slot.id === kind);
  if (index < 0) {
    return;
  }
  let model = modelByWire(kind, wire);
  if (!model) {
    const sole = modelsForKind(kind, host.snapshot.model);
    if (sole.length !== 1) {
      return;
    }
    model = sole[0];
  }
  if (!model.devices.has(host.snapshot.model)) {
    return;
  }
  host.clearControlWritesForKind(kind);
  const values = defaultValuesFor(model);
  const chain = host.snapshot.chain.map((entry, slotIndex) =>
    slotIndex === index ? { ...entry, modelId: model.id, values } : entry,
  );
  host.setChain(chain);
}

function applyLiveSlotControl(
  host: LiveFollowHost,
  kind: EffectId,
  controlIndex: number,
  value: number,
): void {
  if (host.snapshot.sync !== "ready" || host.snapshot.chainSync === "syncing") {
    return;
  }
  const index = host.snapshot.chain.findIndex((slot) => slot.id === kind);
  if (index < 0) {
    return;
  }
  const slot = host.snapshot.chain[index];
  if (slot.modelId === undefined || slot.values === undefined) {
    return;
  }
  const model = modelById(slot.modelId);
  if (!model || model.kind !== kind) {
    return;
  }
  const control = controlByIndex(model, controlIndex, host.snapshot.model);
  if (!control || controlIndex >= slot.values.length) {
    return;
  }
  const nextValue = snapControlValue(control, value);
  host.dropControlWrite(controlWriteKey(kind, controlIndex), nextValue);
  if (slot.values[controlIndex] === nextValue) {
    return;
  }
  const values = slot.values.slice();
  values[controlIndex] = nextValue;
  const chain = host.snapshot.chain.map((entry, slotIndex) =>
    slotIndex === index ? { ...entry, values } : entry,
  );
  host.setChain(chain);
}

/** Module and EXP on/off only. Inbound CC 7, CC 73, and CC 74 do not change the snapshot. */
function decodeLiveOnOffCc(message: Uint8Array): { id: ChainSlotId; enabled: boolean } | null {
  if ((message[0] & 0xf0) !== 0xb0 || message.length < 3) {
    return null;
  }
  if (message[1] === gp50Cc.expOnOff) {
    return { id: "exp", enabled: moduleEnabledFromCc(message[2]) };
  }
  const id = effectIdForModuleCc(message[1]);
  if (!id) {
    return null;
  }
  return { id, enabled: moduleEnabledFromCc(message[2]) };
}

function setChainSlotEnabled(host: LiveFollowHost, id: ChainSlotId, enabled: boolean): void {
  const index = host.snapshot.chain.findIndex((slot) => slot.id === id);
  if (index < 0 || host.snapshot.chain[index].enabled === enabled) {
    return;
  }
  const chain = host.snapshot.chain.map((slot, slotIndex) =>
    slotIndex === index ? { ...slot, enabled } : slot,
  );
  host.setChain(chain);
}
