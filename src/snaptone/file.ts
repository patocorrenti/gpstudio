/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/gp5/lib/snaptone.mjs cloneToSnapToneFile at 9591679.
 */

const FILE_SIZE = 0x88 + 0xa00;
const EXTEND_SIZE = 0xa00;
const ARR2_MAX = 0x200;

function crc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc;
}

/** 8840-byte clone blob → 2696-byte SnapTone file. Same bytes for GP-5 and GP-50. */
export function cloneToSnapToneFile(blob: Uint8Array): Uint8Array {
  if (blob.length < FILE_SIZE) {
    throw new Error(`SnapTone clone is too short (${blob.length} bytes).`);
  }
  const out = new Uint8Array(FILE_SIZE);
  out.set(blob.subarray(0, FILE_SIZE));
  const view = new DataView(out.buffer);
  for (let offset = 0x18; offset < 0x68; offset += 8) {
    if (out.subarray(offset, offset + 8).every((byte) => byte === 0xff)) {
      view.setFloat64(offset, -1, true);
    }
  }
  view.setUint32(4, FILE_SIZE, true);
  view.setUint32(0x14, EXTEND_SIZE, true);
  view.setUint32(0x84, Math.min(view.getUint32(0x84, true), ARR2_MAX), true);
  const crc = crc16Modbus(out.subarray(12));
  out[8] = crc >> 8;
  out[9] = crc & 0xff;
  return out;
}

export const SNAPTONE_FILE_SIZE = FILE_SIZE;
