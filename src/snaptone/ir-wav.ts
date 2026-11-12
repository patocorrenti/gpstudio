/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Copyright (c) 2026 VLTN Tone Studio contributors. Modified for GP Studio by Patricio Correnti, 2026-11-12.
 * Upstream: app/src/renderer/src/userir/convert.ts at 1eb3facf38d9a9bf18783ad31bed3dfa0149184c.
 * GP-5 family only (512 samples); the resampler is loaded on demand.
 */

// WAV -> User IR data block, as Valeton Suite 2.1.0 prepares an IR: channel 0, r8brain resample to 44.1 kHz,
// JUCE 24-bit rounding, the first 512 samples the pedal keeps. Two Suite quirks are fixed on purpose: chunks are
// walked instead of read at fixed offsets, and stereo 24-bit/44.1 kHz files use channel 0 instead of being sent
// interleaved. Clean mono files give the same bytes as Suite.

export const IR_RATE = 44_100;
export const IR_SAMPLES = 512;
export const IR_DATA_BYTES = IR_SAMPLES * 4;
/** Energy past sample 512, relative to the whole IR, above which the cut is worth mentioning. */
export const AUDIBLE_CUT_DB = -60;

export interface UserIrFile {
  /** 512 24-bit samples as int32 LE (2048 bytes), for the session's User IR upload. */
  data: Uint8Array;
  sourceRate: number;
  sourceFrames: number;
  sourceChannels: number;
  sourceBits: number;
  /** The IR was longer than the 512 samples (about 11.6 ms) the pedal keeps. */
  truncated: boolean;
  /**
   * Energy of the part past sample 512 relative to the whole IR, in dB (at 44.1 kHz).
   * null when nothing is cut or the IR is silent.
   */
  cutDb: number | null;
  /** The cut part is above {@link AUDIBLE_CUT_DB}: worth telling the user. */
  audibleCut: boolean;
}

function cutEnergyDb(samples: Float32Array): number | null {
  if (samples.length <= IR_SAMPLES) {
    return null;
  }
  let total = 0;
  let tail = 0;
  for (let i = 0; i < samples.length; i++) {
    const energy = (samples[i] ?? 0) ** 2;
    total += energy;
    if (i >= IR_SAMPLES) {
      tail += energy;
    }
  }
  if (total === 0) {
    return null;
  }
  return tail === 0 ? -Infinity : 10 * Math.log10(tail / total);
}

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

interface WavFormat {
  format: number;
  channels: number;
  rate: number;
  bits: number;
}

const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o] ?? 0, b[o + 1] ?? 0, b[o + 2] ?? 0, b[o + 3] ?? 0);

/** Walk the RIFF chunks for `fmt ` and `data`. */
function readChunks(wav: Uint8Array): { fmt: WavFormat; data: Uint8Array } {
  if (wav.length < 12 || fourcc(wav, 0) !== "RIFF" || fourcc(wav, 8) !== "WAVE") {
    throw new Error("This file is not a WAV file.");
  }
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let fmt: WavFormat | null = null;
  let data: Uint8Array | null = null;
  for (let o = 12; o + 8 <= wav.length; ) {
    const id = fourcc(wav, o);
    const size = view.getUint32(o + 4, true);
    const body = o + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= wav.length) {
      let format = view.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE keeps the real format tag at the start of its sub-format GUID.
      if (format === FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= wav.length) {
        format = view.getUint16(body + 24, true);
      }
      fmt = {
        format,
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      // Streaming writers may leave the size unset; take what the file holds.
      data = wav.subarray(body, Math.min(body + size, wav.length));
    }
    o = body + size + (size & 1); // chunks are padded to an even length
  }
  if (!fmt) {
    throw new Error("This WAV file has no format chunk.");
  }
  if (!data) {
    throw new Error("This WAV file has no audio data.");
  }
  return { fmt, data };
}

/** Sample reader for one supported encoding, returning -1..1 (JUCE: int / 2^(bits - 1)), or null if unsupported. */
function sampleReader({ format, bits }: WavFormat, view: DataView): ((o: number) => number) | null {
  if (format === FORMAT_FLOAT && bits === 32) {
    return (o) => view.getFloat32(o, true);
  }
  if (format !== FORMAT_PCM) {
    return null;
  }
  switch (bits) {
    case 8:
      return (o) => (view.getUint8(o) - 128) / 128;
    case 16:
      return (o) => view.getInt16(o, true) / 0x8000;
    case 24:
      return (o) => (view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16)) / 0x800000;
    case 32:
      return (o) => view.getInt32(o, true) / 0x80000000;
  }
  return null;
}

/** JUCE's float -> 24-bit writer: roundToInt(clamp(x, -1, 1) * 0x7fffffff) >> 8. */
function to24(x: number): number {
  const c = x < -1 ? -1 : x > 1 ? 1 : x;
  return Math.floor(Math.floor(c * 0x7fffffff + 0.5) / 256);
}

/** int32 LE per sample: the sign-extended 24-bit value (not left-justified). */
function encodeSamples(samples24: Int32Array): Uint8Array {
  const out = new Uint8Array(samples24.length * 4);
  const view = new DataView(out.buffer);
  samples24.forEach((s, i) => {
    if (s < -0x800000 || s > 0x7fffff) {
      throw new RangeError(`User IR sample ${i} is not a 24-bit integer: ${s}`);
    }
    view.setInt32(i * 4, s, true);
  });
  return out;
}

/** Parse a WAV file down to its format and channel 0 as -1..1 floats. Throws a user-facing Error. */
function decodeWav(wav: Uint8Array): { fmt: WavFormat; samples: Float32Array } {
  const { fmt, data } = readChunks(wav);
  if (fmt.channels < 1 || fmt.rate < 1 || fmt.bits < 8 || fmt.bits % 8 !== 0) {
    throw new Error("This WAV file has an invalid format header.");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const read = sampleReader(fmt, view);
  if (!read) {
    throw new Error(
      `This WAV encoding isn't supported (format ${fmt.format}, ${fmt.bits}-bit). Use 16-, 24- or 32-bit PCM or 32-bit float.`,
    );
  }
  const frameBytes = (fmt.bits / 8) * fmt.channels;
  const frames = Math.floor(data.length / frameBytes);
  if (frames === 0) {
    throw new Error("This WAV file contains no audio.");
  }
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    samples[i] = read(i * frameBytes);
  }
  return { fmt, samples };
}

/**
 * Parse a WAV file and turn it into the 2048-byte User IR block the GP-5 and GP-50 take.
 * Throws a user-facing Error. The resampler (r8brain port in `htkpa.ts`) loads only when the file is not 44.1 kHz.
 */
export async function prepareUserIr(wav: Uint8Array): Promise<UserIrFile> {
  const { fmt, samples: source } = decodeWav(wav);
  const sourceFrames = source.length;

  // Zero-filled: shorter IRs are padded with silence, as Suite does.
  const samples24 = new Int32Array(IR_SAMPLES);
  let frames44 = sourceFrames;
  let cutDb: number | null;
  if (fmt.rate === IR_RATE && fmt.format === FORMAT_PCM && fmt.bits === 24) {
    // Suite's direct path: the 24-bit values go to the pedal untouched (int / 2^23 is exact in a float).
    const n = Math.min(sourceFrames, IR_SAMPLES);
    for (let i = 0; i < n; i++) {
      samples24[i] = Math.round((source[i] ?? 0) * 0x800000);
    }
    cutDb = cutEnergyDb(source);
  } else {
    let ch0 = source;
    if (fmt.rate !== IR_RATE) {
      const { convertSampleRate } = await import("./htkpa");
      ch0 = convertSampleRate(source, fmt.rate, IR_RATE);
    }
    frames44 = ch0.length;
    if (frames44 === 0) {
      throw new Error("This IR is too short to use.");
    }
    const n = Math.min(frames44, IR_SAMPLES);
    for (let i = 0; i < n; i++) {
      samples24[i] = to24(ch0[i] ?? 0);
    }
    cutDb = cutEnergyDb(ch0);
  }
  return {
    data: encodeSamples(samples24),
    sourceRate: fmt.rate,
    sourceFrames,
    sourceChannels: fmt.channels,
    sourceBits: fmt.bits,
    truncated: frames44 > IR_SAMPLES,
    cutDb,
    audibleCut: cutDb !== null && cutDb > AUDIBLE_CUT_DB,
  };
}

/** Build a mono WAV in memory. For checks only. */
export function encodeTestWav(samples: readonly number[], rate: number, bits: 16 | 24): Uint8Array {
  const bytesPer = bits / 8;
  const dataBytes = samples.length * bytesPer;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const tag = (o: number, text: string) => {
    for (let i = 0; i < 4; i++) {
      out[o + i] = text.charCodeAt(i);
    }
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, FORMAT_PCM, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPer, true);
  view.setUint16(32, bytesPer, true);
  view.setUint16(34, bits, true);
  tag(36, "data");
  view.setUint32(40, dataBytes, true);
  samples.forEach((value, index) => {
    const at = 44 + index * bytesPer;
    if (bits === 16) {
      view.setInt16(at, value, true);
    } else {
      out[at] = value & 0xff;
      out[at + 1] = (value >> 8) & 0xff;
      out[at + 2] = (value >> 16) & 0xff;
    }
  });
  return out;
}
