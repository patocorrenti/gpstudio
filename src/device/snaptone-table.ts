import { modelsForKind } from "@/device/catalog";
import type { DeviceModel } from "@/device/models";
import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/** Protocol indices 50–79. */
export const USER_SNAP_FIRST = 50;
export const USER_SNAP_LAST = 79;
export const USER_SNAP_COUNT = USER_SNAP_LAST - USER_SNAP_FIRST + 1;
export const SNAP_FILE_BYTES = 2696;
export const SNAP_NAME_MAX = 10;

const FRAME_PAYLOAD_MAX = 19;
const IMPORT_HEADER = 74;

export interface SnapSlot {
  name: string | null;
  /** 0 holds a capture. 1 is empty or factory. null has not been read. */
  flag: number | null;
}

export function emptySnapSlots(): SnapSlot[] {
  return Array.from({ length: USER_SNAP_COUNT }, () => ({ name: null, flag: null }));
}

export function snapSlotHoldsCapture(slot: SnapSlot | undefined): boolean {
  return slot?.flag === 0;
}

export function factorySnapToneLabels(pedal: DeviceModel): { index: number; label: string }[] {
  return modelsForKind("ns", pedal)
    .filter((model) => model.wire[0] < USER_SNAP_FIRST)
    .map((model) => ({ index: model.wire[0], label: model.label }));
}

/** Letters and digits, at most 10. Empty becomes `X`, matching the pedal's stored form. */
export function sanitizeSnapToneName(name: string): string {
  const cut = name.replaceAll(".nam", "").replace(/[^a-zA-Z0-9]/g, "").slice(0, SNAP_NAME_MAX);
  return cut === "" ? "X" : cut;
}

export function snapToneFallbackLabel(protocolIndex: number): string {
  return `SnapTone ${protocolIndex}`;
}

function frameSysex(total: number, index: number, payload: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + payload.length);
  body[1] = total & 0xff;
  body[2] = index & 0xff;
  body[3] = payload.length;
  body.set(payload, 4);
  body[0] = crc8Atm(body.subarray(1));
  const nibbles = nibbleExpand(body);
  const out = new Uint8Array(nibbles.length + 2);
  out[0] = 0xf0;
  out.set(nibbles, 1);
  out[out.length - 1] = 0xf7;
  return out;
}

export function encodeSnapPayload(payload: Uint8Array): Uint8Array[] {
  const total = Math.max(1, Math.ceil(payload.length / FRAME_PAYLOAD_MAX));
  const frames: Uint8Array[] = [];
  for (let index = 0; index < total; index += 1) {
    frames.push(
      frameSysex(total, index, payload.subarray(index * FRAME_PAYLOAD_MAX, (index + 1) * FRAME_PAYLOAD_MAX)),
    );
  }
  return frames;
}

export function encodeSnapTableRequest(): Uint8Array {
  return frameSysex(1, 0, Uint8Array.from([0x12, 0x24]));
}

/**
 * One USB parameter-write SET that deletes a user SnapTone.
 * Packed `01 00 06 11 27` plus fxId `0x0F000000 + slot` (little-endian),
 * CRC-8 ATM, nibble-expand, `F0`…`F7`. Not the Android `0x26` file command
 * and not the pedal's `12 1B` notify.
 */
const SNAP_RENAME_NAME_BYTES = 13;

/**
 * One USB parameter-write SET that renames a user SnapTone.
 * Packed `02 00 13 11 26` plus fxId `0x0F000000 + slot` and a 13-byte
 * zero-padded name. CRC-8 ATM, nibble-expand, `F0`…`F7`.
 * Not the Android `0x27` file command.
 */
export function encodeUserSnapRename(slot: number, name: string): Uint8Array {
  if (!Number.isInteger(slot) || slot < USER_SNAP_FIRST || slot > USER_SNAP_LAST) {
    throw new RangeError("SnapTone renames go to user slots 50–79.");
  }
  const label = sanitizeSnapToneName(name);
  const packed = new Uint8Array(3 + 2 + 4 + SNAP_RENAME_NAME_BYTES);
  packed[0] = 0x02;
  packed[1] = 0x00;
  packed[2] = 0x13;
  packed[3] = 0x11;
  packed[4] = 0x26;
  const fxId = 0x0f000000 + slot;
  packed[5] = fxId & 0xff;
  packed[6] = (fxId >>> 8) & 0xff;
  packed[7] = (fxId >>> 16) & 0xff;
  packed[8] = (fxId >>> 24) & 0xff;
  for (let index = 0; index < label.length; index += 1) {
    packed[9 + index] = label.charCodeAt(index);
  }
  const framed = Uint8Array.from([crc8Atm(packed), ...packed]);
  const body = nibbleExpand(framed);
  const midi = new Uint8Array(body.length + 2);
  midi[0] = 0xf0;
  midi.set(body, 1);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

/** Captured Suite follow-up after the rename ACK. No slot and no name. */
export function encodeUserSnapRenameCommit(): Uint8Array {
  const packed = Uint8Array.from([0x02, 0x01, 0x03, 0x00, 0x00, 0x00]);
  const framed = Uint8Array.from([crc8Atm(packed), ...packed]);
  const body = nibbleExpand(framed);
  const midi = new Uint8Array(body.length + 2);
  midi[0] = 0xf0;
  midi.set(body, 1);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

export function encodeUserSnapDelete(slot: number): Uint8Array {
  if (!Number.isInteger(slot) || slot < USER_SNAP_FIRST || slot > USER_SNAP_LAST) {
    throw new RangeError("SnapTone deletes go to user slots 50–79.");
  }
  const fxId = 0x0f000000 + slot;
  const packed = Uint8Array.from([
    0x01,
    0x00,
    0x06,
    0x11,
    0x27,
    fxId & 0xff,
    (fxId >>> 8) & 0xff,
    (fxId >>> 16) & 0xff,
    (fxId >>> 24) & 0xff,
  ]);
  const framed = Uint8Array.from([crc8Atm(packed), ...packed]);
  const body = nibbleExpand(framed);
  const midi = new Uint8Array(body.length + 2);
  midi[0] = 0xf0;
  midi.set(body, 1);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

export function encodeSnapImportFrames(slot: number, name: string, file: Uint8Array): Uint8Array[] {
  if (!Number.isInteger(slot) || slot < USER_SNAP_FIRST || slot > USER_SNAP_LAST) {
    throw new RangeError("SnapTone uploads go to user slots 50–79.");
  }
  if (file.length !== SNAP_FILE_BYTES) {
    throw new RangeError(`A SnapTone file is ${SNAP_FILE_BYTES} bytes.`);
  }
  const label = sanitizeSnapToneName(name);
  const payload = new Uint8Array(IMPORT_HEADER + file.length);
  payload[0] = 0x11;
  payload[1] = 0x25;
  const fxId = 0x0f000000 + slot;
  payload[6] = fxId & 0xff;
  payload[7] = (fxId >>> 8) & 0xff;
  payload[8] = (fxId >>> 16) & 0xff;
  payload[9] = (fxId >>> 24) & 0xff;
  for (let index = 0; index < label.length; index += 1) {
    payload[10 + index] = label.charCodeAt(index);
  }
  payload.set(file, IMPORT_HEADER);
  return encodeSnapPayload(payload);
}

export interface SnapFrame {
  crcOk: boolean;
  total: number;
  index: number;
  payload: Uint8Array;
}

export function parseSnapSysex(bytes: Uint8Array): SnapFrame | null {
  let start = 0;
  let end = bytes.length;
  if (bytes[0] === 0xf0) {
    start = 1;
  }
  if (bytes[end - 1] === 0xf7) {
    end -= 1;
  }
  const count = end - start;
  if (count < 8 || count % 2 !== 0) {
    return null;
  }
  const body = new Uint8Array(count / 2);
  for (let index = 0; index < body.length; index += 1) {
    const high = bytes[start + index * 2] ?? 0;
    const low = bytes[start + index * 2 + 1] ?? 0;
    if (high > 0x0f || low > 0x0f) {
      return null;
    }
    body[index] = (high << 4) | low;
  }
  const length = body[3] ?? 0;
  if (body.length < 4 + length) {
    return null;
  }
  return {
    crcOk: (body[0] ?? 0) === crc8Atm(body.subarray(1, 4 + length)),
    total: body[1] ?? 0,
    index: body[2] ?? 0,
    payload: body.subarray(4, 4 + length),
  };
}

export function isSnapAccept(frame: SnapFrame): boolean {
  const kind = frame.payload[0];
  return frame.crcOk && (kind === 0x14 || kind === 0x13) && frame.payload[2] === 0;
}

export class SnapPayloadReassembler {
  private parts: (Uint8Array | undefined)[] | null = null;
  private have = 0;

  reset(): void {
    this.parts = null;
    this.have = 0;
  }

  push(frame: SnapFrame): Uint8Array | null {
    if (!frame.crcOk || frame.total < 1) {
      return null;
    }
    if (frame.total === 1) {
      return frame.payload.slice();
    }
    if (!this.parts || this.parts.length !== frame.total || (frame.index === 0 && this.parts[0])) {
      this.parts = new Array(frame.total);
      this.have = 0;
    }
    if (frame.index >= frame.total || this.parts[frame.index]) {
      return null;
    }
    this.parts[frame.index] = frame.payload.slice();
    this.have += 1;
    if (this.have < frame.total) {
      return null;
    }
    const parts = this.parts;
    this.reset();
    const length = parts.reduce((sum, part) => sum + (part?.length ?? 0), 0);
    const out = new Uint8Array(length);
    let cursor = 0;
    for (const part of parts) {
      if (!part) {
        return null;
      }
      out.set(part, cursor);
      cursor += part.length;
    }
    return out;
  }
}

function latin1Name(bytes: Uint8Array): string | null {
  let name = "";
  for (const byte of bytes) {
    if (byte === 0) {
      break;
    }
    name += String.fromCharCode(byte);
  }
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Decode a reassembled `12 24` slot table into user indices 50–79. */
export function decodeUserSnapTable(payload: Uint8Array): SnapSlot[] | null {
  if (payload[0] !== 0x12 || payload[1] !== 0x24) {
    return null;
  }
  const count = 80;
  const namesAt = 2 + count;
  if (payload.length < namesAt + count * 16) {
    return null;
  }
  const slots = emptySnapSlots();
  for (let index = 0; index < USER_SNAP_COUNT; index += 1) {
    const protocol = USER_SNAP_FIRST + index;
    const nameAt = namesAt + protocol * 16;
    slots[index] = {
      flag: payload[2 + protocol] ?? 1,
      name: latin1Name(payload.subarray(nameAt, nameAt + 16)),
    };
  }
  return slots;
}

export function isPatchRecall(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xb0 && bytes[1] === 0x00;
}
