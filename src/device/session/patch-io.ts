import { chainSlotLabel, isEffectSlot, type AudioChain, type EffectId } from "@/device/chain";
import { controlsForPedal, modelById } from "@/device/catalog";
import { decodePresetDump } from "@/device/chain-codec";
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
import {
  decodePrstFile,
  encodePrstFile,
  writeDumpPatchBpm,
  writeDumpPatchVolume,
} from "@/device/patch-store";
import { GP5_TOB_PRST_HEX, GP50_TOB_PRST_HEX } from "@/device/prst-tob-fixtures";

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

/** Factory model the target catalog does not host (slot kind + catalog label). */
export type OmittedFactoryModel = {
  kind: EffectId;
  label: string;
};

export type PlannedUpload =
  | { ok: false; reason: "invalid" }
  | {
      ok: true;
      fileModel: DeviceModel;
      omissions: OmittedFactoryModel[];
      steps: UploadApplyStep[];
    };

function omittedFactoryModels(chain: AudioChain, target: DeviceModel): OmittedFactoryModel[] {
  const omissions: OmittedFactoryModel[] = [];
  for (const slot of chain) {
    if (!isEffectSlot(slot.id) || slot.modelId === undefined) {
      continue;
    }
    const fx = modelById(slot.modelId);
    if (!fx || fx.kind !== slot.id) {
      continue;
    }
    if (!fx.devices.has(target)) {
      omissions.push({ kind: slot.id, label: fx.label });
    }
  }
  return omissions;
}

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
    for (const control of controlsForPedal(fx, model)) {
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

/**
 * Decode a `.prst` as its own model, list factory models the target catalog
 * omits, and encode working-patch writes for the connected pedal.
 */
export function planUploadedPatch(
  bytes: Uint8Array,
  targetModel: DeviceModel,
  linkMode: LinkMode,
): PlannedUpload {
  const parsed = decodePrstFile(bytes);
  if (!parsed) {
    return { ok: false, reason: "invalid" };
  }
  const chain = decodePresetDump(parsed.dump, parsed.model, parsed.model);
  if (!chain) {
    return { ok: false, reason: "invalid" };
  }
  const omissions = omittedFactoryModels(chain, targetModel);
  const bpm = parsed.model === targetModel ? parsed.bpm : null;
  const steps = encodeUploadedPatchWrites(
    targetModel,
    linkMode,
    chain,
    parsed.volume,
    bpm,
  );
  if (!steps) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    fileModel: parsed.model,
    omissions,
    steps,
  };
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

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function writeNibbleBytes(data: Uint8Array, start: number, packed: Uint8Array): void {
  for (let index = 0; index < packed.length; index += 1) {
    data[start + index * 2] = (packed[index] >> 4) & 0x0f;
    data[start + index * 2 + 1] = packed[index] & 0x0f;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function stepsInclude(steps: UploadApplyStep[], packets: Uint8Array[] | null): boolean {
  if (!packets) {
    return false;
  }
  return packets.some((packet) =>
    steps.some((step) => sameBytes(step.bytes, packet)),
  );
}

function gp50PrstWithIdentity(kind: EffectId, wire: Uint8Array): Uint8Array {
  const parsed = decodePrstFile(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!parsed) {
    throw new Error("GP-50 TOB must decode for planner fixtures");
  }
  const dump = parsed.dump.slice();
  const identityAt: Partial<Record<EffectId, number>> = {
    pre: 278,
    cab: 302,
    mod: 318,
  };
  const at = identityAt[kind];
  if (at === undefined) {
    throw new Error(`Planner fixture has no identity offset for ${kind}`);
  }
  writeNibbleBytes(dump, at, wire);
  const encoded = encodePrstFile({ model: "gp50", name: parsed.name || "TOB", dump });
  if (!encoded) {
    throw new Error("Mutated GP-50 dump must re-encode as .prst");
  }
  return encoded;
}

function assertUploadPlannerFixtures(): void {
  const cWah = gp50PrstWithIdentity("pre", Uint8Array.from([0x08, 0x00, 0x00, 0x05]));
  const cWahPlan = planUploadedPatch(cWah, "gp5", "usb");
  if (
    !cWahPlan.ok ||
    cWahPlan.omissions.length !== 1 ||
    cWahPlan.omissions[0]?.kind !== "pre" ||
    cWahPlan.omissions[0]?.label !== "C-Wah" ||
    `${chainSlotLabel(cWahPlan.omissions[0].kind)} ${cWahPlan.omissions[0].label}` !==
      "PRE C-Wah"
  ) {
    throw new Error("GP-50 PRE C-Wah against GP-5 must report PRE C-Wah");
  }
  const cWahModel = encodeSlotModel("usb", "pre", [0x08, 0x00, 0x00, 0x05]);
  if (stepsInclude(cWahPlan.steps, cWahModel)) {
    throw new Error("GP-5 plan must not send a C-Wah model SET");
  }
  if (!cWahPlan.steps.some((step) => step.kind === "order")) {
    throw new Error("GP-5 plan must still send chain order");
  }
  if (!cWahPlan.steps.some((step) => step.kind === "module")) {
    throw new Error("GP-5 plan must still send module on/off");
  }

  const tob = planUploadedPatch(bytesFromHex(GP50_TOB_PRST_HEX), "gp5", "usb");
  if (!tob.ok) {
    throw new Error("GP-50 TOB must plan against GP-5");
  }
  if (tob.omissions.some((item) => item.label === "Sync")) {
    throw new Error("GP-50 TOB against GP-5 must not report Sync as an omission");
  }
  if (tob.omissions.length !== 0) {
    throw new Error("GP-50 TOB factory models must all be in the GP-5 catalog");
  }
  const fullTob = planUploadedPatch(bytesFromHex(GP50_TOB_PRST_HEX), "gp50", "usb");
  if (!fullTob.ok) {
    throw new Error("GP-50 TOB must plan against GP-50");
  }
  const gp50OnlyControls = fullTob.steps.filter(
    (step) =>
      step.kind === "control" &&
      !tob.steps.some((other) => sameBytes(other.bytes, step.bytes)),
  );
  if (gp50OnlyControls.length === 0) {
    throw new Error("GP-50 TOB must include at least one GP-50-only control such as Sync");
  }
  if (gp50OnlyControls.some((step) => stepsInclude(tob.steps, [step.bytes]))) {
    throw new Error("GP-5 plan must not send a Sync control SET");
  }
  const tobParsed = decodePrstFile(bytesFromHex(GP50_TOB_PRST_HEX));
  if (tobParsed?.bpm !== null && tobParsed?.bpm !== undefined) {
    const bpmPackets =
      tobParsed.bpm > 255
        ? encodePatchTempoCc("usb", tobParsed.bpm)
        : encodePatchBpm("usb", tobParsed.bpm);
    if (stepsInclude(tob.steps, bpmPackets)) {
      throw new Error("GP-50 file planned for GP-5 must not send a BPM write");
    }
  }

  const gp5OntoGp50 = planUploadedPatch(bytesFromHex(GP5_TOB_PRST_HEX), "gp50", "usb");
  if (!gp5OntoGp50.ok || gp5OntoGp50.omissions.length !== 0) {
    throw new Error("GP-5 TOB must plan onto GP-50 with no omissions");
  }
  const gp5Parsed = decodePrstFile(bytesFromHex(GP5_TOB_PRST_HEX));
  if (gp5Parsed?.bpm !== null && gp5Parsed?.bpm !== undefined) {
    const bpmPackets =
      gp5Parsed.bpm > 255
        ? encodePatchTempoCc("usb", gp5Parsed.bpm)
        : encodePatchBpm("usb", gp5Parsed.bpm);
    if (stepsInclude(gp5OntoGp50.steps, bpmPackets)) {
      throw new Error("GP-5 file planned for GP-50 must not include a BPM write");
    }
  } else if (gp5OntoGp50.steps.some((step) => {
    const sample = encodePatchBpm("usb", 120);
    return sample ? sameBytes(step.bytes, sample[0]) : false;
  })) {
    throw new Error("GP-5 file planned for GP-50 must not invent a BPM write");
  }

  const sameModel = planUploadedPatch(bytesFromHex(GP50_TOB_PRST_HEX), "gp50", "usb");
  if (!sameModel.ok || sameModel.omissions.length !== 0) {
    throw new Error("Same-model GP-50 TOB must plan with no omissions");
  }
  if (
    tobParsed?.bpm !== null &&
    tobParsed?.bpm !== undefined &&
    !stepsInclude(
      sameModel.steps,
      tobParsed.bpm > 255
        ? encodePatchTempoCc("usb", tobParsed.bpm)
        : encodePatchBpm("usb", tobParsed.bpm),
    )
  ) {
    throw new Error("Same-model GP-50 plan must still send patch BPM");
  }

  if (planUploadedPatch(new Uint8Array([0x00, 0x01]), "gp5", "usb").ok) {
    throw new Error("Invalid bytes must not plan an upload");
  }
}

assertUploadPlannerFixtures();
