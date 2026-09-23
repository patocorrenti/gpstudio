import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/**
 * GP-50 device-global settings (not patch Save).
 * Dump field offsets follow the local GP-50 reference editor's Bluetooth
 * "Received Global Parameters" packet (BLE indices − 2 → F0-aligned).
 * Confirm against a Patone Log when one lands; do not paste editor source.
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
 * F0-aligned offsets from the reference editor's BLE-wrapped dump
 * (editor index − 2). Nibble pairs use high*16+low; single-byte rows are raw.
 */
const DUMP_MASTER_AT = 63;
const DUMP_INPUT_AT = 73;
const DUMP_NO_CAB_AT = 84;
const DUMP_REC_AT = 103;
const DUMP_BT_AT = 113;
const DUMP_MON_AT = 123;
const DUMP_REC_MODE_L_AT = 134;
const DUMP_REC_MODE_R_AT = 144;
const DUMP_FOOT_AT = 194;
const DUMP_MIN_LENGTH = DUMP_FOOT_AT + 1;

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

/**
 * Globals dump: command `00 02`, path `01 02 01`.
 * Bluetooth reference packet is F0-aligned length 210 (BLE-wrapped 212).
 * Accept any length that still covers the footswitch byte so a USB whole-SysEx
 * of the same shape is not dropped solely for a length mismatch.
 */
export function isGlobalsDump(bytes: Uint8Array): boolean {
  const midi = midiPayload(bytes);
  if (midi.length < DUMP_MIN_LENGTH || midi[0] !== 0xf0 || midi[midi.length - 1] !== 0xf7) {
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

/**
 * Decode a globals dump using the reference-editor F0-aligned offsets.
 * Returns null when the header does not match.
 */
export function decodeGlobalsDump(bytes: Uint8Array): DeviceGlobals | null {
  const midi = midiPayload(bytes);
  if (!isGlobalsDump(midi)) {
    return null;
  }
  const inputLevel = clampLevel(fromSignedByte(nibble(midi, DUMP_INPUT_AT)));
  const recLevel = clampLevel(fromSignedByte(nibble(midi, DUMP_REC_AT)));
  const btRec = clampLevel(fromSignedByte(nibble(midi, DUMP_BT_AT)));
  const monLevel = clampLevel(fromSignedByte(nibble(midi, DUMP_MON_AT)));
  const masterVolume = clampMaster(fromSignedByte(nibble(midi, DUMP_MASTER_AT)));
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
    noCab: midi[DUMP_NO_CAB_AT] !== 0,
    recLevel,
    btRec,
    monLevel,
    recModeLeft: recModeFromWire(midi[DUMP_REC_MODE_L_AT]),
    recModeRight: recModeFromWire(midi[DUMP_REC_MODE_R_AT]),
    footswitchMode: midi[DUMP_FOOT_AT] === 0 ? "patch" : "stomp",
    masterVolume,
  };
}

function signedByte(value: number): number | null {
  if (!Number.isInteger(value) || value < LEVEL_MIN || value > LEVEL_MAX) {
    return null;
  }
  return value < 0 ? 0x100 + value : value;
}

function fromSignedByte(packed: number): number {
  return packed & 0x80 ? packed - 0x100 : packed;
}

function recModeWire(mode: RecMode): number {
  return mode === "dry" ? 0 : 1;
}

function recModeFromWire(wire: number): RecMode {
  return wire === 0 ? "dry" : "wet";
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

  const fixture = new Uint8Array(210);
  fixture[0] = 0xf0;
  fixture[3] = 0;
  fixture[4] = 2;
  fixture[9] = 1;
  fixture[10] = 2;
  fixture[11] = 1;
  fixture[209] = 0xf7;
  const writeSigned = (at: number, value: number) => {
    const wire = value < 0 ? 0x100 + value : value;
    fixture[at] = (wire >> 4) & 0x0f;
    fixture[at + 1] = wire & 0x0f;
  };
  writeSigned(DUMP_MASTER_AT, 63);
  writeSigned(DUMP_INPUT_AT, 0);
  writeSigned(DUMP_REC_AT, -6);
  writeSigned(DUMP_BT_AT, 3);
  writeSigned(DUMP_MON_AT, 0);
  fixture[DUMP_NO_CAB_AT] = 0;
  fixture[DUMP_REC_MODE_L_AT] = 0;
  fixture[DUMP_REC_MODE_R_AT] = 1;
  fixture[DUMP_FOOT_AT] = 1;
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
    throw new Error("Globals dump fixture must decode the reference-editor offsets");
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
  // Live-notify path 01 02 04 is not a SET: a size-0x07 notify must not equal this frame.
  if (inputSet.length === 24) {
    throw new Error("Global SET must not be a 24-byte live notify");
  }
  if (encodeGlobalSysex("inputLevel", 21) !== null || encodeGlobalSysex("noCab", 1) !== null) {
    throw new Error("Global SET must reject out-of-range values");
  }
}

assertGlobalsCodec();
