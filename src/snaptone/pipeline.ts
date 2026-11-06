/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Copyright (c) 2026 VLTN Tone Studio contributors. Modified for GP Studio by Patricio Correnti, 2026-10-30 to 2026-11-04.
 * Upstream: app/src/renderer/src/snaptone/pipeline.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 * The optional cab-IR convolution in that file is not ported.
 */

import { parseA2, renderA2 } from "./a2";
import { cloneToSnapToneFile } from "./file";
import { cloneSnapTone, convertSampleRate, type HtkpaKernel } from "./htkpa";
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

function cancelled(): DOMException {
  return new DOMException("Conversion cancelled", "AbortError");
}

/** Check the NAM text and return the A2 JSON with what the converter needs before rendering. */
export function prepareA2(namText: string): { json: string; rate: number; prewarm: number } {
  const { json, check } = prepareNam(namText);
  if (check.arch !== "A2") {
    throw new Error("A1 captures aren't supported yet");
  }
  const model = parseA2(json);
  return { json, rate: model.sampleRate ?? DEFAULT_MODEL_RATE, prewarm: model.prewarm };
}

/** The 44.1 kHz test signal at the model rate, rounded to 24-bit. The same for every model at that rate. */
export function buildExcitation(excitation: Int16Array, rate: number): Float32Array {
  const source = Float32Array.from(excitation, (value) => value / 32768);
  return pcmRoundTrip(rate === SIGNAL_RATE ? source : convertSampleRate(source, SIGNAL_RATE, rate), 24);
}

/** One render chunk: input frames [from, end) of the excitation; outputs from `start` on are kept. */
export interface RenderChunk {
  from: number;
  start: number;
  end: number;
}

/**
 * Split `length` frames into `parts` chunks. A2 is feed-forward: output frame t only depends on input frames
 * t − prewarm … t, so a chunk rendered after `prewarm` frames of real history (zeros before frame 0, as the
 * kernel's own prewarm) gives the same floats as the one-pass render.
 */
export function planRenderChunks(length: number, prewarm: number, parts: number): RenderChunk[] {
  const count = Math.max(1, Math.min(parts, length));
  const size = Math.ceil(length / count);
  const chunks: RenderChunk[] = [];
  for (let start = 0; start < length; start += size) {
    chunks.push({ from: Math.max(0, start - prewarm), start, end: Math.min(length, start + size) });
  }
  return chunks;
}

/** Render one chunk of `input` (the whole excitation, or the slice that starts at chunk.from). */
export async function renderChunk(
  json: string,
  wasm: BufferSource,
  input: Float32Array,
  chunk: RenderChunk,
  inputOffset: number,
  onProgress?: (fraction: number) => void,
): Promise<Float32Array> {
  const model = parseA2(json);
  const slice = input.subarray(chunk.from - inputOffset, chunk.end - inputOffset);
  const rendered = await renderA2(wasm, model, slice, onProgress);
  return rendered.slice(chunk.start - chunk.from);
}

/** Render output → 8840-byte clone. `kernel` runs the hot loops in wasm with the same bytes. */
export function cloneRendered(input: Float32Array, rendered: Float32Array, rate: number, kernel: HtkpaKernel | null = null): Uint8Array {
  for (let index = 0; index < rendered.length; index += 1) {
    rendered[index] = Math.fround((rendered[index] ?? 0) * NAM_OUTPUT_GAIN);
  }
  return cloneSnapTone(input, pcmRoundTrip(rendered, 16), rate, kernel);
}

/** NAM A2 text + 44.1 kHz excitation → 2696-byte SnapTone file, in one thread. Reference path. */
export async function namTextToSnapToneFile(
  namText: string,
  excitation: Int16Array,
  wasm: BufferSource,
  onProgress: (phase: ClonePhase, fraction: number) => void = () => undefined,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    throw cancelled();
  }
  const { json, rate } = prepareA2(namText);
  onProgress("excitation", 0);
  const input = buildExcitation(excitation, rate);
  if (signal?.aborted) {
    throw cancelled();
  }
  const rendered = await renderA2(wasm, parseA2(json), input, (fraction) => onProgress("render", fraction));
  if (signal?.aborted) {
    throw cancelled();
  }
  onProgress("clone", 0);
  return cloneToSnapToneFile(cloneRendered(input, rendered, rate));
}

/** Same path, returning the 8840-byte clone before the file cut. Used by the golden check. */
export async function namTextToCloneBlob(
  namText: string,
  excitation: Int16Array,
  wasm: BufferSource,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    throw cancelled();
  }
  const { json, rate } = prepareA2(namText);
  const input = buildExcitation(excitation, rate);
  const rendered = await renderA2(wasm, parseA2(json), input);
  return cloneRendered(input, rendered, rate);
}
