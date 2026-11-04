/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/shared/nam.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 */

import { A2_CHANNELS, A2_DILATIONS, A2_HEAD_TAPS, A2_KERNEL_SIZES, a2WeightCount, checkNam, NamCheckError } from "./nam";

export const A1_UNSUPPORTED = "A1 captures aren't supported yet";

export type NamKind = "A1" | "A2" | "unsupported";

export interface NamInspection {
  kind: NamKind;
  version?: string;
  sampleRate?: number;
  name?: string;
  reason?: string;
}

function metaName(model: unknown): string | undefined {
  if (!model || typeof model !== "object" || !("metadata" in model)) {
    return undefined;
  }
  const meta = model.metadata;
  if (!meta || typeof meta !== "object" || !("name" in meta)) {
    return undefined;
  }
  const name = meta.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

function sampleRateOf(model: unknown): number | undefined {
  if (!model || typeof model !== "object" || !("sample_rate" in model)) {
    return undefined;
  }
  const rate = model.sample_rate;
  return typeof rate === "number" ? rate : undefined;
}

/** Inspect a `.nam` without opening a MIDI link. */
export function inspectNamSync(file: ArrayBuffer): NamInspection {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file);
  } catch {
    return { kind: "unsupported", reason: "This file is not a NAM capture." };
  }
  let model: unknown;
  try {
    model = JSON.parse(text) as unknown;
  } catch {
    return { kind: "unsupported", reason: "This file is not a NAM capture." };
  }
  try {
    const check = checkNam(model);
    if (check.arch === "A1") {
      return { kind: "unsupported", reason: A1_UNSUPPORTED, version: check.version };
    }
    const name = metaName(model);
    const sampleRate = sampleRateOf(model);
    return {
      kind: "A2",
      version: check.version,
      ...(name ? { name } : {}),
      ...(sampleRate !== undefined ? { sampleRate } : {}),
    };
  } catch (error) {
    const reason = error instanceof NamCheckError ? error.detail : "This file is not a NAM capture.";
    return { kind: "unsupported", reason };
  }
}

export function inspectNam(file: ArrayBuffer): Promise<NamInspection> {
  return Promise.resolve(inspectNamSync(file));
}

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function syntheticA2(): string {
  const channels = A2_CHANNELS[0] ?? 3;
  const layer = {
    channels,
    bottleneck: channels,
    input_size: 1,
    condition_size: 1,
    kernel_sizes: A2_KERNEL_SIZES,
    dilations: A2_DILATIONS,
    activation: A2_KERNEL_SIZES.map(() => ({ type: "LeakyReLU", negative_slope: 0.01 })),
    gating_mode: A2_KERNEL_SIZES.map(() => "none"),
    secondary_activation: A2_KERNEL_SIZES.map(() => null),
    head1x1: { active: false },
    layer1x1: { active: true, groups: 1 },
    head: { out_channels: 1, kernel_size: A2_HEAD_TAPS, bias: true },
    groups_input: 1,
    groups_input_mixin: 1,
  };
  return JSON.stringify({
    version: "0.7.1",
    architecture: "SlimmableContainer",
    sample_rate: 48000,
    metadata: { name: "Bench Amp" },
    config: {
      submodels: [
        {
          max_value: 1,
          model: {
            version: "0.7.1",
            architecture: "WaveNet",
            sample_rate: 48000,
            weights: Array.from({ length: a2WeightCount(channels) }, () => 0),
            config: { head_scale: 1, in_channels: 1, layers: [layer] },
          },
        },
      ],
    },
  });
}

function syntheticA1(): string {
  return JSON.stringify({
    version: "0.5.4",
    architecture: "WaveNet",
    sample_rate: 48000,
    metadata: { name: "Old" },
    weights: [0],
    config: {
      head_scale: 1,
      layers: [
        {
          channels: 16,
          input_size: 1,
          head_size: 8,
          kernel_size: 3,
          dilations: [1],
          activation: "Tanh",
          condition_size: 1,
          gated: false,
        },
        {
          channels: 8,
          input_size: 16,
          head_size: 1,
          kernel_size: 3,
          dilations: [1],
          activation: "Tanh",
          condition_size: 1,
          gated: false,
        },
      ],
    },
  });
}

function assertInspect(): void {
  const a2 = inspectNamSync(bytesOf(syntheticA2()));
  if (a2.kind !== "A2" || a2.version !== "0.7.1" || a2.name !== "Bench Amp") {
    throw new Error("A2 inspect must return kind, version, and name");
  }
  const a1 = inspectNamSync(bytesOf(syntheticA1()));
  if (a1.kind !== "unsupported" || a1.reason !== A1_UNSUPPORTED) {
    throw new Error("A1 inspect must be unsupported");
  }
  const bad = inspectNamSync(bytesOf("not-json"));
  if (bad.kind !== "unsupported" || !bad.reason) {
    throw new Error("Invalid NAM must return an English reason");
  }
}

assertInspect();
