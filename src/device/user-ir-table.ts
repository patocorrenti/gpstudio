import { encodeSnapPayload, type SnapSlot } from "@/device/snaptone-table";
import { USER_IR_COUNT } from "@/device/ir-names";

/**
 * User IR (CAB impulse response) file import and the `12 20` slot table.
 *
 * The import is one file command on the same framed transport as a SnapTone
 * import (`encodeSnapPayload`, per-frame ACK, no final reply):
 *
 *   [0x11, 0x21, nId u32 = 0, fxId u32 = 0x0A100000 + slotIndex, name[16],
 *    node[16] = 0, fPara f32[8] = 0, data[2048]]
 *
 * 2122 bytes, 112 frames. `fxId` is the CAB model word of `User IR nn`
 * (`src/device/catalog/cab.ts`: wire `slotIndex 00 10 0a`). Slots here are
 * 1–20, matching the catalog's `userIrSlot`.
 *
 * The `12 20` table read is byte-for-byte the USB IR-name ask in
 * `ir-names.ts` (`F0 02 09 … F7`): its reply carries 20 occupancy flags
 * before the names. Flag 0 is a user file; flag 1 is empty (`User IR n`).
 */

export const USER_IR_FIRST = 1;
export const USER_IR_LAST = USER_IR_COUNT;
/** 512 samples at 44.1 kHz, each a sign-extended 24-bit value as int32 LE. */
export const USER_IR_SAMPLES = 512;
export const USER_IR_DATA_BYTES = USER_IR_SAMPLES * 4;
export const USER_IR_RATE = 44_100;
export const USER_IR_NAME_MAX = 10;

const USER_IR_FXID_BASE = 0x0a100000;
const IMPORT_HEADER = 74;
const NAME_FIELD = 16;
/** Suite's per-character rule: printable ASCII except `$`. Space is kept. */
const NAME_CHAR = /^[a-zA-Z0-9~!@#%.&^*,?_+/\-'"();:<=>[\]\\`{}| ]$/;

export type UserIrSlot = SnapSlot;

export function emptyUserIrSlots(): UserIrSlot[] {
  return Array.from({ length: USER_IR_COUNT }, () => ({ name: null, flag: null }));
}

export function isUserIrSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= USER_IR_FIRST && slot <= USER_IR_LAST;
}

export function userIrFxId(slot: number): number {
  if (!isUserIrSlot(slot)) {
    throw new RangeError("User IR uploads go to slots 1–20.");
  }
  return USER_IR_FXID_BASE + (slot - 1);
}

export function isUserIrNameChar(char: string): boolean {
  return NAME_CHAR.test(char);
}

/** Drop `.wav`, keep Suite's printable set, cut to 10. Blank becomes `X`. */
export function sanitizeUserIrName(name: string): string {
  const base = name.replace(/\.wav$/i, "");
  const kept = [...base].filter((char) => NAME_CHAR.test(char)).join("");
  const cut = kept.slice(0, USER_IR_NAME_MAX);
  return cut.trim() === "" ? "X" : cut;
}

/** An empty slot reads `User IR n` (flag 1). Flag 0 holds a user file. */
export function userIrNameLooksVacant(name: string): boolean {
  return /^User IR \d+$/.test(name) || name === "Empty";
}

export function encodeUserIrImportFrames(slot: number, name: string, data: Uint8Array): Uint8Array[] {
  const fxId = userIrFxId(slot);
  if (data.length !== USER_IR_DATA_BYTES) {
    throw new RangeError(`A User IR data block is ${USER_IR_DATA_BYTES} bytes.`);
  }
  const label = sanitizeUserIrName(name);
  const payload = new Uint8Array(IMPORT_HEADER + data.length);
  payload[0] = 0x11;
  payload[1] = 0x21;
  payload[6] = fxId & 0xff;
  payload[7] = (fxId >>> 8) & 0xff;
  payload[8] = (fxId >>> 16) & 0xff;
  payload[9] = (fxId >>> 24) & 0xff;
  for (let index = 0; index < label.length; index += 1) {
    payload[10 + index] = label.charCodeAt(index);
  }
  payload.set(data, IMPORT_HEADER);
  return encodeSnapPayload(payload);
}

export function encodeUserIrTableRequest(): Uint8Array {
  const frame = encodeSnapPayload(Uint8Array.from([0x12, 0x20]))[0];
  if (!frame) {
    throw new Error("User IR table request did not frame");
  }
  return frame;
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

/** Decode a reassembled `12 20` table: 20 flag bytes, then 20 × 16-byte names. */
export function decodeUserIrTable(payload: Uint8Array): UserIrSlot[] | null {
  if (payload[0] !== 0x12 || payload[1] !== 0x20) {
    return null;
  }
  const namesAt = 2 + USER_IR_COUNT;
  if (payload.length < namesAt + USER_IR_COUNT * NAME_FIELD) {
    return null;
  }
  const slots = emptyUserIrSlots();
  for (let index = 0; index < USER_IR_COUNT; index += 1) {
    const nameAt = namesAt + index * NAME_FIELD;
    slots[index] = {
      flag: payload[2 + index] ?? 1,
      name: latin1Name(payload.subarray(nameAt, nameAt + NAME_FIELD)),
    };
  }
  return slots;
}

