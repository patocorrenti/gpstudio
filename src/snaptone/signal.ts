/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/shared/host/snaptone.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 */

/** Valeton's nam_input_wav.wav: 16-bit PCM, 44.1 kHz, at least 70 s. */
export const SIGNAL_RATE = 44100;
export const SIGNAL_FRAMES = 70 * SIGNAL_RATE;

/** Channel 0 as 16-bit samples. */
export function readSignalWav(bytes: Uint8Array): Int16Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) =>
    String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
  if (bytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new Error("The SnapTone test signal is not a WAV file.");
  }
  let format: { code: number; channels: number; rate: number; bits: number } | null = null;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (tag(offset) === "fmt ") {
      format = {
        code: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (tag(offset) === "data") {
      if (!format || format.code !== 1 || format.bits !== 16 || format.rate !== SIGNAL_RATE) {
        throw new Error("The SnapTone test signal must be 16-bit PCM at 44.1 kHz.");
      }
      const frames = Math.floor(Math.min(size, bytes.length - body) / (2 * format.channels));
      if (frames < SIGNAL_FRAMES) {
        throw new Error("The SnapTone test signal is shorter than 70 seconds.");
      }
      const out = new Int16Array(frames);
      for (let index = 0; index < frames; index += 1) {
        out[index] = view.getInt16(body + index * 2 * format.channels, true);
      }
      return out;
    }
    offset = body + size + (size & 1);
  }
  throw new Error("The SnapTone test signal has no audio data.");
}
