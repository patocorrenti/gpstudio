import { isEffectSlot, type AudioChain } from "@/device/chain";
import { modelById } from "@/device/catalog";
import {
  encodeChainOrder,
  encodeModule,
  encodePatchBpm,
  encodePatchTempoCc,
  encodePatchVolume,
  encodeSlotControl,
  encodeSlotModel,
} from "@/device/encode";
import type { LinkMode } from "@/device/link";
import type { DeviceModel } from "@/device/models";
import { writeDumpPatchBpm, writeDumpPatchVolume } from "@/device/patch-store";

/**
 * Upload paces SETs. USB `output.send` and BLE `writeValueWithoutResponse`
 * both return before the pedal has applied the previous SysEx; a burst drops
 * trailing writes (often store `114a`). Gaps are apply-only, not the slider throttle.
 */
export const UPLOAD_WRITE_GAP_MS = { usb: 20, bluetooth: 40 } as const;
export const UPLOAD_MODEL_GAP_MS = { usb: 50, bluetooth: 80 } as const;
export const UPLOAD_COMMIT_GAP_MS = { usb: 80, bluetooth: 120 } as const;

export type UploadApplyStep = {
  kind: "model" | "control" | "order" | "module" | "global";
  bytes: Uint8Array;
};

export function encodeUploadedPatchWrites(
  model: DeviceModel,
  linkMode: LinkMode,
  chain: AudioChain,
  volume: number | null,
  bpm: number | null,
): UploadApplyStep[] | null {
  const steps: UploadApplyStep[] = [];
  for (const slot of chain) {
    if (!isEffectSlot(slot.id) || slot.modelId === undefined || slot.values === undefined) {
      continue;
    }
    const fx = modelById(slot.modelId);
    if (!fx || fx.kind !== slot.id || !fx.devices.has(model)) {
      continue;
    }
    const modelPackets = encodeSlotModel(linkMode, slot.id, fx.wire);
    if (!modelPackets) {
      continue;
    }
    for (const bytes of modelPackets) {
      steps.push({ kind: "model", bytes });
    }
    for (const control of fx.controls) {
      const value = slot.values[control.index];
      if (value === undefined) {
        continue;
      }
      const controlPackets = encodeSlotControl(linkMode, slot.id, control.index, value);
      if (!controlPackets) {
        continue;
      }
      for (const bytes of controlPackets) {
        steps.push({ kind: "control", bytes });
      }
    }
  }
  const orderPackets = encodeChainOrder(linkMode, chain);
  if (!orderPackets) {
    return null;
  }
  for (const bytes of orderPackets) {
    steps.push({ kind: "order", bytes });
  }
  for (const slot of chain) {
    if (!isEffectSlot(slot.id)) {
      continue;
    }
    steps.push({ kind: "module", bytes: encodeModule(linkMode, slot.id, slot.enabled) });
  }
  if (volume !== null) {
    const volumePackets = encodePatchVolume(linkMode, volume);
    if (volumePackets) {
      for (const bytes of volumePackets) {
        steps.push({ kind: "global", bytes });
      }
    }
  }
  if (bpm !== null) {
    // Family 1142 is one byte (40–255). BPM 256–260 needs official CC 73/74.
    const bpmPackets =
      bpm > 255 ? encodePatchTempoCc(linkMode, bpm) : encodePatchBpm(linkMode, bpm);
    if (bpmPackets) {
      for (const bytes of bpmPackets) {
        steps.push({ kind: "global", bytes });
      }
    }
  }
  return steps;
}

export function overlayDumpPatchGlobals(
  model: DeviceModel,
  dump: Uint8Array,
  volume: number | null,
  bpm: number | null,
): Uint8Array {
  const next = dump.slice();
  if (volume !== null) {
    writeDumpPatchVolume(model, next, volume);
  }
  if (model === "gp50" && bpm !== null) {
    writeDumpPatchBpm(model, next, bpm);
  }
  return next;
}
