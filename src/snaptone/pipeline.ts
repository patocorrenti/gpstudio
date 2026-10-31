/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/snaptone/pipeline.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 * The optional cab-IR convolution in that file is not ported.
 */

import { parseA2, renderA2 } from "./a2";
import { cloneToSnapToneFile } from "./file";
import { cloneSnapTone, convertSampleRate } from "./htkpa";
import { DEFAULT_MODEL_RATE, prepareNam } from "./nam";
import { SIGNAL_RATE } from "./signal";

const NAM_OUTPUT_GAIN = Math.fround(0.31);

export function pcmRoundTrip(samples: Float32Array, bits: 16 | 24): Float32Array {
  const shift = 2 ** (32 - bits);
  const scale = 2 ** (bits - 1);
  const out = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
    out[index] = Math.floor(Math.floor(clamped * 0x7fffffff + 0.5) / shift) / scale;
  }
  return out;
}

export type ClonePhase = "excitation" | "render" | "clone";

/** NAM A2 text + 44.1 kHz excitation → 2696-byte SnapTone file. */
export async function namTextToSnapToneFile(
  namText: string,
  excitation: Int16Array,
  wasm: BufferSource,
  onProgress: (phase: ClonePhase, fraction: number) => void = () => undefined,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    throw new DOMException("Conversion cancelled", "AbortError");
  }
  const { json, check } = prepareNam(namText);
  if (check.arch !== "A2") {
    throw new Error("A1 captures aren't supported yet");
  }
  const model = parseA2(json);
  const rate = model.sampleRate ?? DEFAULT_MODEL_RATE;
  onProgress("excitation", 0);
  const source = Float32Array.from(excitation, (value) => value / 32768);
  const input = pcmRoundTrip(rate === SIGNAL_RATE ? source : convertSampleRate(source, SIGNAL_RATE, rate), 24);
  if (signal?.aborted) {
    throw new DOMException("Conversion cancelled", "AbortError");
  }
  const rendered = await renderA2(wasm, model, input, (fraction) => onProgress("render", fraction));
  for (let index = 0; index < rendered.length; index += 1) {
    rendered[index] = Math.fround((rendered[index] ?? 0) * NAM_OUTPUT_GAIN);
  }
  if (signal?.aborted) {
    throw new DOMException("Conversion cancelled", "AbortError");
  }
  onProgress("clone", 0);
  const clone = cloneSnapTone(input, pcmRoundTrip(rendered, 16), rate);
  return cloneToSnapToneFile(clone);
}

/** Same path, returning the 8840-byte clone before the file cut. Used by the golden check. */
export async function namTextToCloneBlob(
  namText: string,
  excitation: Int16Array,
  wasm: BufferSource,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    throw new DOMException("Conversion cancelled", "AbortError");
  }
  const { json, check } = prepareNam(namText);
  if (check.arch !== "A2") {
    throw new Error("A1 captures aren't supported yet");
  }
  const model = parseA2(json);
  const rate = model.sampleRate ?? DEFAULT_MODEL_RATE;
  const source = Float32Array.from(excitation, (value) => value / 32768);
  const input = pcmRoundTrip(rate === SIGNAL_RATE ? source : convertSampleRate(source, SIGNAL_RATE, rate), 24);
  const rendered = await renderA2(wasm, model, input);
  for (let index = 0; index < rendered.length; index += 1) {
    rendered[index] = Math.fround((rendered[index] ?? 0) * NAM_OUTPUT_GAIN);
  }
  return cloneSnapTone(input, pcmRoundTrip(rendered, 16), rate);
}
