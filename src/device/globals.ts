import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/**
 * GP-50 device-global settings (not patch Save).
 *
 * Bluetooth: one SysEx (F0-aligned ~210), command `00 02`, path `01 02 01`.
 * Offsets are absolute in that packet (local BLE reference editor − 2).
 *
 * USB: fragmented SysEx, command `00 08` or `00 09`, data length 48 /
 * terminator 20 or 22 (`_reference/GP50-USB.html`). Payloads start at byte 9
 * and concatenate; table offsets are the Bluetooth absolute offsets minus 9.
 * Do not paste editor source.
 */

export type FootswitchMode = "patch" | "stomp";
/** Editor live UI: 0 → Dry, 1 → Wet. Polarity pending a Patone accept capture. */
export type RecMode = "dry" | "wet";

export type DeviceGlobals = {
  inputLevel: number | null;
  noCab: boolean | null;
  recLevel: number | null;
  btRec: number | null;
  monLevel: number | null;
  recModeLeft: RecMode | null;
  recModeRight: RecMode | null;
  footswitchMode: FootswitchMode | null;
  masterVolume: number | null;
};

export type GlobalSysexKey =
  | "inputLevel"
  | "noCab"
  | "recLevel"
  | "btRec"
  | "monLevel"
  | "recModeLeft"
  | "recModeRight";

export type LiveGlobalChange =
  | { key: "inputLevel" | "recLevel" | "btRec" | "monLevel"; value: number }
  | { key: "noCab"; value: boolean }
  | { key: "recModeLeft" | "recModeRight"; value: RecMode }
  | { key: "footswitchMode"; value: FootswitchMode }
  | { key: "masterVolume"; value: number };

/** Packed SET: size `0x0A`, family `1111`. Path appears after CRC + nibble-expand. */
const GLOBAL_SET_PREFIX = [0x01, 0x00, 0x0a, 0x11, 0x11] as const;

const SYSEX_ROWS: Record<GlobalSysexKey, { effect: number; flag: number }> = {
  inputLevel: { effect: 1, flag: 3 },
  noCab: { effect: 3, flag: 3 },
  recLevel: { effect: 1, flag: 4 },
  btRec: { effect: 2, flag: 4 },
  monLevel: { effect: 3, flag: 4 },
  recModeLeft: { effect: 4, flag: 4 },
  recModeRight: { effect: 5, flag: 4 },
};

const LEVEL_MIN = -20;
const LEVEL_MAX = 20;
const MASTER_VOLUME_MAX = 100;

/**
 * Identity-family globals request (F0…F7). Same envelope as name-list /
 * current-patch / current-preset / IR, with size `0x0B` and path `02 01 02 01`.
 * Bluetooth wrap is encodeLinkMidi. Do not paste a reference 8080f0 string.
 */
const GLOBALS_REQUEST = Uint8Array.from([
  0xf0, 0x0b, 0x09, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x01, 0x00, 0xf7,
]);

/**
 * Bluetooth F0-aligned absolute offsets (BLE reference editor index − 2).
 * USB concatenated payload uses the same table at offset − 9.
 */
const BT_DUMP_MASTER_AT = 63;
const BT_DUMP_INPUT_AT = 73;
const BT_DUMP_NO_CAB_AT = 84;
const BT_DUMP_REC_AT = 103;
const BT_DUMP_BT_AT = 113;
const BT_DUMP_MON_AT = 123;
const BT_DUMP_REC_MODE_L_AT = 134;
const BT_DUMP_REC_MODE_R_AT = 144;
const BT_DUMP_FOOT_AT = 194;
/** USB payloads omit the 9-byte SysEx header of each fragment. */
const USB_PAYLOAD_SHIFT = 9;
const USB_DUMP_MASTER_AT = BT_DUMP_MASTER_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_INPUT_AT = BT_DUMP_INPUT_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_NO_CAB_AT = BT_DUMP_NO_CAB_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_REC_AT = BT_DUMP_REC_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_BT_AT = BT_DUMP_BT_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_MON_AT = BT_DUMP_MON_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_REC_MODE_L_AT = BT_DUMP_REC_MODE_L_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_REC_MODE_R_AT = BT_DUMP_REC_MODE_R_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_FOOT_AT = BT_DUMP_FOOT_AT - USB_PAYLOAD_SHIFT;
const USB_DUMP_MIN_LENGTH = USB_DUMP_FOOT_AT + 1;

const USB_DATA_LENGTH = 48;
const USB_TERMINATOR_LENGTHS = new Set([20, 22]);
const USB_PAYLOAD_AT = 9;
/** USB globals fragment commands observed in `_reference/GP50-USB.html`. */
const USB_GLOBALS_COMMANDS = new Set([8, 9]);

export function emptyGp50Globals(): DeviceGlobals {
  return {
    inputLevel: null,
    noCab: null,
    recLevel: null,
    btRec: null,
    monLevel: null,
    recModeLeft: null,
    recModeRight: null,
    footswitchMode: null,
    masterVolume: null,
  };
}

export function encodeGlobalsRequest(): Uint8Array {
  return GLOBALS_REQUEST;
}

function midiPayload(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 3 && bytes[0] === 0x80 && bytes[1] === 0x80 && bytes[2] === 0xf0) {
    return bytes.subarray(2);
  }
  return bytes;
}

function nibble(bytes: Uint8Array, index: number): number {
  return bytes[index] * 16 + bytes[index + 1];
}

function fromSignedByte(packed: number): number {
  return packed & 0x80 ? packed - 0x100 : packed;
}

function signedByte(value: number): number | null {
  if (!Number.isInteger(value) || value < LEVEL_MIN || value > LEVEL_MAX) {
    return null;
  }
  return value < 0 ? 0x100 + value : value;
}

function recModeWire(mode: RecMode): number {
  return mode === "dry" ? 0 : 1;
}

function recModeFromWire(wire: number): RecMode {
  return wire === 0 ? "dry" : "wet";
}

function clampLevel(value: number): number | null {
  if (!Number.isFinite(value) || value < LEVEL_MIN || value > LEVEL_MAX) {
    return null;
  }
  return value;
}

function clampMaster(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > MASTER_VOLUME_MAX) {
    return null;
  }
  return value;
}

function parseGlobalsTable(
  data: Uint8Array,
  offsets: {
    master: number;
    input: number;
    noCab: number;
    rec: number;
    bt: number;
    mon: number;
    recModeL: number;
    recModeR: number;
    foot: number;
  },
): DeviceGlobals | null {
  if (data.length <= offsets.foot) {
    return null;
  }
  const inputLevel = clampLevel(fromSignedByte(nibble(data, offsets.input)));
  const recLevel = clampLevel(fromSignedByte(nibble(data, offsets.rec)));
  const btRec = clampLevel(fromSignedByte(nibble(data, offsets.bt)));
  const monLevel = clampLevel(fromSignedByte(nibble(data, offsets.mon)));
  const masterVolume = clampMaster(fromSignedByte(nibble(data, offsets.master)));
  if (
    inputLevel === null ||
    recLevel === null ||
    btRec === null ||
    monLevel === null ||
    masterVolume === null
  ) {
    return null;
  }
  return {
    inputLevel,
    noCab: data[offsets.noCab] !== 0,
    recLevel,
    btRec,
    monLevel,
    recModeLeft: recModeFromWire(data[offsets.recModeL]),
    recModeRight: recModeFromWire(data[offsets.recModeR]),
    footswitchMode: data[offsets.foot] === 0 ? "patch" : "stomp",
    masterVolume,
  };
}

/** Bluetooth single-packet globals dump (command `00 02`, path `01 02 01`). */
export function isBluetoothGlobalsDump(bytes: Uint8Array): boolean {
  const midi = midiPayload(bytes);
  if (midi.length < BT_DUMP_FOOT_AT + 1 || midi[0] !== 0xf0 || midi[midi.length - 1] !== 0xf7) {
    return false;
  }
  return (
    midi[3] === 0 &&
    midi[4] === 2 &&
    midi[9] === 1 &&
    midi[10] === 2 &&
    midi[11] === 1
  );
}

type UsbGlobalsHeader = {
  index: number;
  terminator: boolean;
};

function usbGlobalsHeader(bytes: Uint8Array): UsbGlobalsHeader | null {
  const midi = midiPayload(bytes);
  if (midi.length < 12 || midi[0] !== 0xf0 || midi[midi.length - 1] !== 0xf7) {
    return null;
  }
  if (midi[3] !== 0 || !USB_GLOBALS_COMMANDS.has(midi[4] ?? -1)) {
    return null;
  }
  const terminator = USB_TERMINATOR_LENGTHS.has(midi.length);
  const data = midi.length === USB_DATA_LENGTH;
  if (!terminator && !data) {
    return null;
  }
  return { index: nibble(midi, 5), terminator };
}

/** USB globals fragment (command `00 08` / `00 09`, length 48 or 20/22). */
export function isUsbGlobalsDumpFragment(bytes: Uint8Array): boolean {
  return usbGlobalsHeader(bytes) !== null;
}

/** True for a Bluetooth globals dump or a USB globals fragment. */
export function isGlobalsDump(bytes: Uint8Array): boolean {
  return isBluetoothGlobalsDump(bytes) || isUsbGlobalsDumpFragment(bytes);
}

function decodeBluetoothGlobalsDump(bytes: Uint8Array): DeviceGlobals | null {
  const midi = midiPayload(bytes);
  if (!isBluetoothGlobalsDump(midi)) {
    return null;
  }
  return parseGlobalsTable(midi, {
    master: BT_DUMP_MASTER_AT,
    input: BT_DUMP_INPUT_AT,
    noCab: BT_DUMP_NO_CAB_AT,
    rec: BT_DUMP_REC_AT,
    bt: BT_DUMP_BT_AT,
    mon: BT_DUMP_MON_AT,
    recModeL: BT_DUMP_REC_MODE_L_AT,
    recModeR: BT_DUMP_REC_MODE_R_AT,
    foot: BT_DUMP_FOOT_AT,
  });
}

function decodeUsbGlobalsPayload(payload: Uint8Array): DeviceGlobals | null {
  if (payload.length < USB_DUMP_MIN_LENGTH) {
    return null;
  }
  return parseGlobalsTable(payload, {
    master: USB_DUMP_MASTER_AT,
    input: USB_DUMP_INPUT_AT,
    noCab: USB_DUMP_NO_CAB_AT,
    rec: USB_DUMP_REC_AT,
    bt: USB_DUMP_BT_AT,
    mon: USB_DUMP_MON_AT,
    recModeL: USB_DUMP_REC_MODE_L_AT,
    recModeR: USB_DUMP_REC_MODE_R_AT,
    foot: USB_DUMP_FOOT_AT,
  });
}

/**
 * Decode a Bluetooth single-packet globals dump.
 * USB dumps must go through GlobalsDumpDecoder.
 */
export function decodeGlobalsDump(bytes: Uint8Array): DeviceGlobals | null {
  return decodeBluetoothGlobalsDump(bytes);
}

function sysexPayload(midi: Uint8Array, start: number): Uint8Array {
  const end = midi[midi.length - 1] === 0xf7 ? midi.length - 1 : midi.length;
  return midi.subarray(start, end);
}

/**
 * Assembles USB globals fragments; returns immediately for a Bluetooth dump.
 */
export class GlobalsDumpDecoder {
  private fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
  }

  push(bytes: Uint8Array): DeviceGlobals | null {
    const bluetooth = decodeBluetoothGlobalsDump(bytes);
    if (bluetooth) {
      this.fragments.clear();
      return bluetooth;
    }
    const midi = midiPayload(bytes);
    const header = usbGlobalsHeader(midi);
    if (!header) {
      return null;
    }
    this.fragments.set(header.index, sysexPayload(midi, USB_PAYLOAD_AT));
    if (!header.terminator) {
      return null;
    }
    const entries = [...this.fragments.entries()].sort((left, right) => left[0] - right[0]);
    this.fragments.clear();
    const merged = new Uint8Array(entries.reduce((sum, entry) => sum + entry[1].length, 0));
    let cursor = 0;
    for (const [, part] of entries) {
      merged.set(part, cursor);
      cursor += part.length;
    }
    return decodeUsbGlobalsPayload(merged);
  }
}

function framePackedSet(packed: Uint8Array): Uint8Array {
  const framed = Uint8Array.from([crc8Atm(packed), ...packed]);
  const body = nibbleExpand(framed);
  const midi = new Uint8Array(2 + body.length);
  midi[0] = 0xf0;
  midi.set(body, 1);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

/**
 * Parameter-write SET for a GP-50 global SysEx row (family `1111`).
 * Path `01 01 04` after CRC + nibble-expand. Not live-notify `01 02 04`.
 */
export function encodeGlobalSysex(
  key: GlobalSysexKey,
  value: number | boolean | RecMode,
): Uint8Array | null {
  const row = SYSEX_ROWS[key];
  let wire: number | null = null;
  if (key === "noCab") {
    if (typeof value !== "boolean") {
      return null;
    }
    wire = value ? 1 : 0;
  } else if (key === "recModeLeft" || key === "recModeRight") {
    if (value !== "dry" && value !== "wet") {
      return null;
    }
    wire = recModeWire(value);
  } else if (typeof value === "number") {
    wire = signedByte(value);
  }
  if (wire === null) {
    return null;
  }
  const packed = Uint8Array.from([
    ...GLOBAL_SET_PREFIX,
    row.effect,
    row.flag,
    0x00,
    0x00,
    wire,
    0x00,
    0x00,
    0x00,
  ]);
  return framePackedSet(packed);
}

/**
 * Pedal→app live global notify (Bluetooth). Identity-family size `0x07`,
 * command `00 01`, path starts `01 02`. Effect / flag match the SET table;
 * footswitch uses effect 1 / flag 6; master volume uses effect 2 / flag 2.
 * Not locked against a Patone Log — shape follows the reference editor's
 * "Change global" / "vol global" handlers (F0-aligned).
 */
export function decodeLiveGlobal(bytes: Uint8Array): LiveGlobalChange | null {
  const midi = midiPayload(bytes);
  if (midi.length !== 24 || midi[0] !== 0xf0 || midi[23] !== 0xf7) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  if (midi[8] !== 0x07 || midi[9] !== 1 || midi[10] !== 2) {
    return null;
  }
  const effect = midi[14];
  const flag = midi[16];
  const valueByte = midi[21] * 16 + midi[22];
  const low = midi[22];

  if (effect === 2 && flag === 2) {
    const volume = fromSignedByte(valueByte);
    if (volume < 0 || volume > MASTER_VOLUME_MAX) {
      return null;
    }
    return { key: "masterVolume", value: volume };
  }
  if (effect === 1 && flag === 6) {
    return { key: "footswitchMode", value: low === 0 ? "patch" : "stomp" };
  }
  if (effect === 1 && flag === 3) {
    const level = fromSignedByte(valueByte);
    if (level < LEVEL_MIN || level > LEVEL_MAX) {
      return null;
    }
    return { key: "inputLevel", value: level };
  }
  if (effect === 3 && flag === 3) {
    return { key: "noCab", value: low !== 0 };
  }
  if (effect === 1 && flag === 4) {
    const level = fromSignedByte(valueByte);
    if (level < LEVEL_MIN || level > LEVEL_MAX) {
      return null;
    }
    return { key: "recLevel", value: level };
  }
  if (effect === 2 && flag === 4) {
    const level = fromSignedByte(valueByte);
    if (level < LEVEL_MIN || level > LEVEL_MAX) {
      return null;
    }
    return { key: "btRec", value: level };
  }
  if (effect === 3 && flag === 4) {
    const level = fromSignedByte(valueByte);
    if (level < LEVEL_MIN || level > LEVEL_MAX) {
      return null;
    }
    return { key: "monLevel", value: level };
  }
  if (effect === 4 && flag === 4) {
    return { key: "recModeLeft", value: recModeFromWire(low) };
  }
  if (effect === 5 && flag === 4) {
    return { key: "recModeRight", value: recModeFromWire(low) };
  }
  return null;
}

/** Official CC 1 (master) or CC 28 (Patch | Stomp) as a live global report. */
export function decodeLiveGlobalCc(bytes: Uint8Array): LiveGlobalChange | null {
  if (bytes.length < 3) {
    return null;
  }
  const status = bytes[0] & 0xf0;
  if (status !== 0xb0) {
    return null;
  }
  const controller = bytes[1];
  const value = bytes[2];
  if (controller === 1) {
    if (value < 0 || value > MASTER_VOLUME_MAX) {
      return null;
    }
    return { key: "masterVolume", value };
  }
  if (controller === 28) {
    return { key: "footswitchMode", value: value < 64 ? "patch" : "stomp" };
  }
  return null;
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

function assertGlobalsCodec(): void {
  const ask = encodeGlobalsRequest();
  if (
    ask.length !== 14 ||
    ask[0] !== 0xf0 ||
    ask[1] !== 0x0b ||
    ask[2] !== 0x09 ||
    ask[8] !== 0x02 ||
    ask[9] !== 0x01 ||
    ask[10] !== 0x02 ||
    ask[11] !== 0x01 ||
    ask[13] !== 0xf7
  ) {
    throw new Error("Globals request must be the GP-50 identity-family ask");
  }
  if (
    sameBytes(ask, Uint8Array.from([0xf0, 0x00, 0x0e, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x04, 0x00, 0xf7])) ||
    sameBytes(ask, Uint8Array.from([0xf0, 0x02, 0x09, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x02, 0x00, 0xf7]))
  ) {
    throw new Error("Globals request must differ from name-list and IR asks");
  }

  const lookalike = new Uint8Array(210);
  lookalike[0] = 0xf0;
  lookalike[3] = 0;
  lookalike[4] = 6;
  lookalike[209] = 0xf7;
  if (isGlobalsDump(lookalike)) {
    throw new Error("A current-preset header must not classify as a globals dump");
  }
  if (decodeGlobalsDump(lookalike) !== null) {
    throw new Error("A non-globals header must not decode as globals");
  }

  const writeSignedAt = (target: Uint8Array, at: number, value: number) => {
    const wire = value < 0 ? 0x100 + value : value;
    target[at] = (wire >> 4) & 0x0f;
    target[at + 1] = wire & 0x0f;
  };

  const fixture = new Uint8Array(210);
  fixture[0] = 0xf0;
  fixture[3] = 0;
  fixture[4] = 2;
  fixture[9] = 1;
  fixture[10] = 2;
  fixture[11] = 1;
  fixture[209] = 0xf7;
  writeSignedAt(fixture, BT_DUMP_MASTER_AT, 63);
  writeSignedAt(fixture, BT_DUMP_INPUT_AT, 0);
  writeSignedAt(fixture, BT_DUMP_REC_AT, -6);
  writeSignedAt(fixture, BT_DUMP_BT_AT, 3);
  writeSignedAt(fixture, BT_DUMP_MON_AT, 0);
  fixture[BT_DUMP_NO_CAB_AT] = 0;
  fixture[BT_DUMP_REC_MODE_L_AT] = 0;
  fixture[BT_DUMP_REC_MODE_R_AT] = 1;
  fixture[BT_DUMP_FOOT_AT] = 1;
  const decoded = decodeGlobalsDump(fixture);
  if (
    !decoded ||
    decoded.masterVolume !== 63 ||
    decoded.inputLevel !== 0 ||
    decoded.recLevel !== -6 ||
    decoded.btRec !== 3 ||
    decoded.monLevel !== 0 ||
    decoded.noCab !== false ||
    decoded.recModeLeft !== "dry" ||
    decoded.recModeRight !== "wet" ||
    decoded.footswitchMode !== "stomp"
  ) {
    throw new Error("Bluetooth globals dump fixture must decode the reference-editor offsets");
  }

  const usbPayload = new Uint8Array(USB_DUMP_MIN_LENGTH + 10);
  writeSignedAt(usbPayload, USB_DUMP_MASTER_AT, 63);
  writeSignedAt(usbPayload, USB_DUMP_INPUT_AT, 0);
  writeSignedAt(usbPayload, USB_DUMP_REC_AT, -6);
  writeSignedAt(usbPayload, USB_DUMP_BT_AT, 3);
  writeSignedAt(usbPayload, USB_DUMP_MON_AT, 0);
  usbPayload[USB_DUMP_NO_CAB_AT] = 1;
  usbPayload[USB_DUMP_REC_MODE_L_AT] = 1;
  usbPayload[USB_DUMP_REC_MODE_R_AT] = 0;
  usbPayload[USB_DUMP_FOOT_AT] = 0;
  const usbDataPayload = 38;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let index = 0;
  while (offset + usbDataPayload < usbPayload.length) {
    const midi = new Uint8Array(USB_DATA_LENGTH);
    midi[0] = 0xf0;
    midi[3] = 0;
    midi[4] = 8;
    midi[5] = (index >> 4) & 0x0f;
    midi[6] = index & 0x0f;
    midi.set(usbPayload.subarray(offset, offset + usbDataPayload), USB_PAYLOAD_AT);
    midi[USB_DATA_LENGTH - 1] = 0xf7;
    chunks.push(midi);
    offset += usbDataPayload;
    index += 1;
  }
  const term = new Uint8Array(20);
  term[0] = 0xf0;
  term[3] = 0;
  term[4] = 8;
  term[5] = (index >> 4) & 0x0f;
  term[6] = index & 0x0f;
  term.set(usbPayload.subarray(offset), USB_PAYLOAD_AT);
  term[19] = 0xf7;
  chunks.push(term);
  const usbDecoder = new GlobalsDumpDecoder();
  let usbDecoded: DeviceGlobals | null = null;
  for (const chunk of chunks) {
    if (!isUsbGlobalsDumpFragment(chunk) && chunk !== chunks[chunks.length - 1]) {
      throw new Error("USB globals data fragment must classify");
    }
    usbDecoded = usbDecoder.push(chunk);
  }
  if (
    !usbDecoded ||
    usbDecoded.masterVolume !== 63 ||
    usbDecoded.inputLevel !== 0 ||
    usbDecoded.recLevel !== -6 ||
    usbDecoded.noCab !== true ||
    usbDecoded.recModeLeft !== "wet" ||
    usbDecoded.recModeRight !== "dry" ||
    usbDecoded.footswitchMode !== "patch"
  ) {
    throw new Error("USB globals fragments must assemble to the payload table");
  }

  const inputSet = encodeGlobalSysex("inputLevel", 0);
  if (!inputSet || inputSet[0] !== 0xf0 || inputSet[inputSet.length - 1] !== 0xf7) {
    throw new Error("Global SET must be a framed SysEx");
  }
  const packed = Uint8Array.from([0x01, 0x00, 0x0a, 0x11, 0x11, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const expected = framePackedSet(packed);
  if (!sameBytes(inputSet, expected)) {
    throw new Error("Input-level SET must match packed 1111 effect 1 flag 3");
  }
  if (inputSet.length === 24) {
    throw new Error("Global SET must not be a 24-byte live notify");
  }
  if (encodeGlobalSysex("inputLevel", 21) !== null || encodeGlobalSysex("noCab", 1) !== null) {
    throw new Error("Global SET must reject out-of-range values");
  }
}

assertGlobalsCodec();
