import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/**
 * Device-global settings (not patch Save).
 *
 * GP-50 Bluetooth: one SysEx (F0-aligned ~210), command `00 02`, path `01 02 01`.
 * Offsets are absolute in that packet (local BLE reference editor − 2).
 * GP-50 USB: fragmented SysEx, command `00 08` or `00 09`, data length 48 /
 * terminator 20 or 22. Payloads start at byte 9; table offsets are the
 * Bluetooth absolute offsets minus 9.
 *
 * GP-5 Bluetooth: F0 length 164, command `00 01`, path `01 02 01`
 * (`_reference/GP5bluetooth.html` index − 2). GP-5 USB: command `00 05`,
 * data length 48 / terminator 12; payload offsets are those F0 offsets minus 9.
 * Do not paste editor source.
 */

export type FootswitchMode = "patch" | "stomp";
/** GP-5 footswitch list in the reference editors. Wire byte 0–4. */
export type Gp5FootswitchMode = "0-99" | "0-9" | "A-Z" | "CTL" | "Tuner";
/** Editor live UI: 0 → Dry, 1 → Wet. Polarity pending a Patone accept capture. */
export type RecMode = "dry" | "wet";

export type Gp50Globals = {
  model: "gp50";
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

export type Gp5Globals = {
  model: "gp5";
  globalVolume: number | null;
  inputLevel: number | null;
  noCab: boolean | null;
  recLevel: number | null;
  btRec: number | null;
  monLevel: number | null;
  screenBrightness: number | null;
  footswitchMode: Gp5FootswitchMode | null;
};

export type DeviceGlobals = Gp50Globals | Gp5Globals;

export type GlobalSysexKey =
  | "inputLevel"
  | "noCab"
  | "recLevel"
  | "btRec"
  | "monLevel"
  | "recModeLeft"
  | "recModeRight";

/** Reachable GP-5 Global settings rows. Dump volume is not a write. */
export type Gp5GlobalSysexKey =
  | "inputLevel"
  | "noCab"
  | "recLevel"
  | "btRec"
  | "monLevel"
  | "screenBrightness";

export type LiveGlobalChange =
  | { model: "gp50"; key: "inputLevel" | "recLevel" | "btRec" | "monLevel"; value: number }
  | { model: "gp50"; key: "noCab"; value: boolean }
  | { model: "gp50"; key: "recModeLeft" | "recModeRight"; value: RecMode }
  | { model: "gp50"; key: "footswitchMode"; value: FootswitchMode }
  | { model: "gp50"; key: "masterVolume"; value: number }
  | { model: "gp5"; key: "inputLevel" | "recLevel" | "btRec" | "monLevel"; value: number }
  | { model: "gp5"; key: "noCab"; value: boolean }
  | { model: "gp5"; key: "footswitchMode"; value: Gp5FootswitchMode };

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

export function emptyGp50Globals(): Gp50Globals {
  return {
    model: "gp50",
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

export function emptyGp5Globals(): Gp5Globals {
  return {
    model: "gp5",
    globalVolume: null,
    inputLevel: null,
    noCab: null,
    recLevel: null,
    btRec: null,
    monLevel: null,
    screenBrightness: null,
    footswitchMode: null,
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
    model: "gp50",
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

const GP5_BT_DUMP_LENGTH = 164;
const GP5_BT_VOL_AT = 53;
const GP5_BT_SCREEN_AT = 79;
const GP5_BT_INPUT_AT = 89;
const GP5_BT_REC_AT = 99;
const GP5_BT_MON_AT = 109;
const GP5_BT_BT_AT = 139;
const GP5_BT_NO_CAB_AT = 150;
const GP5_BT_FOOT_AT = 160;
const GP5_USB_COMMAND = 5;
const GP5_USB_TERMINATOR_LENGTH = 12;
const GP5_USB_VOL_AT = GP5_BT_VOL_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_SCREEN_AT = GP5_BT_SCREEN_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_INPUT_AT = GP5_BT_INPUT_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_REC_AT = GP5_BT_REC_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_MON_AT = GP5_BT_MON_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_BT_AT = GP5_BT_BT_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_NO_CAB_AT = GP5_BT_NO_CAB_AT - USB_PAYLOAD_SHIFT;
const GP5_USB_FOOT_AT = GP5_BT_FOOT_AT - USB_PAYLOAD_SHIFT;
const SCREEN_MIN = 1;
const SCREEN_MAX = 100;
const GP5_FOOT_MODES = ["0-99", "0-9", "A-Z", "CTL", "Tuner"] as const;

function clampScreen(value: number): number | null {
  if (!Number.isInteger(value) || value < SCREEN_MIN || value > SCREEN_MAX) {
    return null;
  }
  return value;
}

function gp5FootFromWire(wire: number): Gp5FootswitchMode | null {
  return GP5_FOOT_MODES[wire] ?? null;
}

function gp5FootWire(mode: Gp5FootswitchMode): number {
  return GP5_FOOT_MODES.indexOf(mode);
}

function parseGp5Table(
  data: Uint8Array,
  offsets: {
    volume: number;
    screen: number;
    input: number;
    noCab: number;
    rec: number;
    bt: number;
    mon: number;
    foot: number;
  },
): Gp5Globals | null {
  if (data.length <= offsets.foot) {
    return null;
  }
  // Volume stays in the dump for codec fidelity. An unused or out-of-range
  // byte must not block the Settings rows (reference Settings omits Global Vol).
  const globalVolume =
    data.length > offsets.volume + 1
      ? clampMaster(fromSignedByte(nibble(data, offsets.volume)))
      : null;
  const inputLevel = clampLevel(fromSignedByte(nibble(data, offsets.input)));
  const recLevel = clampLevel(fromSignedByte(nibble(data, offsets.rec)));
  const btRec = clampLevel(fromSignedByte(nibble(data, offsets.bt)));
  const monLevel = clampLevel(fromSignedByte(nibble(data, offsets.mon)));
  const footswitchMode = gp5FootFromWire(data[offsets.foot] ?? -1);
  if (
    inputLevel === null ||
    recLevel === null ||
    btRec === null ||
    monLevel === null ||
    footswitchMode === null
  ) {
    return null;
  }
  const screenBrightness =
    data.length > offsets.screen + 1
      ? clampScreen(fromSignedByte(nibble(data, offsets.screen)))
      : null;
  return {
    model: "gp5",
    globalVolume,
    inputLevel,
    noCab: data[offsets.noCab] !== 0,
    recLevel,
    btRec,
    monLevel,
    screenBrightness,
    footswitchMode,
  };
}

/** Bluetooth GP-5 globals dump (command `00 01`, path `01 02 01`, length 164). */
export function isGp5BluetoothGlobalsDump(bytes: Uint8Array): boolean {
  const midi = midiPayload(bytes);
  if (midi.length !== GP5_BT_DUMP_LENGTH || midi[0] !== 0xf0 || midi[midi.length - 1] !== 0xf7) {
    return false;
  }
  return midi[3] === 0 && midi[4] === 1 && midi[9] === 1 && midi[10] === 2 && midi[11] === 1;
}

function usbGp5GlobalsHeader(bytes: Uint8Array): UsbGlobalsHeader | null {
  const midi = midiPayload(bytes);
  if (midi.length < GP5_USB_TERMINATOR_LENGTH || midi[0] !== 0xf0 || midi[midi.length - 1] !== 0xf7) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== GP5_USB_COMMAND) {
    return null;
  }
  const terminator = midi.length === GP5_USB_TERMINATOR_LENGTH;
  const data = midi.length === USB_DATA_LENGTH;
  if (!terminator && !data) {
    return null;
  }
  return { index: nibble(midi, 5), terminator };
}

/** USB GP-5 globals fragment (command `00 05`, length 48 or 12). */
export function isGp5UsbGlobalsDumpFragment(bytes: Uint8Array): boolean {
  return usbGp5GlobalsHeader(bytes) !== null;
}

function decodeGp5BluetoothGlobalsDump(bytes: Uint8Array): Gp5Globals | null {
  const midi = midiPayload(bytes);
  if (!isGp5BluetoothGlobalsDump(midi)) {
    return null;
  }
  return parseGp5Table(midi, {
    volume: GP5_BT_VOL_AT,
    screen: GP5_BT_SCREEN_AT,
    input: GP5_BT_INPUT_AT,
    noCab: GP5_BT_NO_CAB_AT,
    rec: GP5_BT_REC_AT,
    bt: GP5_BT_BT_AT,
    mon: GP5_BT_MON_AT,
    foot: GP5_BT_FOOT_AT,
  });
}

function decodeGp5UsbPayload(payload: Uint8Array): Gp5Globals | null {
  return parseGp5Table(payload, {
    volume: GP5_USB_VOL_AT,
    screen: GP5_USB_SCREEN_AT,
    input: GP5_USB_INPUT_AT,
    noCab: GP5_USB_NO_CAB_AT,
    rec: GP5_USB_REC_AT,
    bt: GP5_USB_BT_AT,
    mon: GP5_USB_MON_AT,
    foot: GP5_USB_FOOT_AT,
  });
}

/** True for a GP-50 or GP-5 globals dump or USB fragment. */
export function isGlobalsDump(bytes: Uint8Array): boolean {
  return (
    isBluetoothGlobalsDump(bytes) ||
    isUsbGlobalsDumpFragment(bytes) ||
    isGp5BluetoothGlobalsDump(bytes) ||
    isGp5UsbGlobalsDumpFragment(bytes)
  );
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
function assembleFragments(fragments: Map<number, Uint8Array>): Uint8Array {
  const entries = [...fragments.entries()].sort((left, right) => left[0] - right[0]);
  const merged = new Uint8Array(entries.reduce((sum, entry) => sum + entry[1].length, 0));
  let cursor = 0;
  for (const [, part] of entries) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return merged;
}

export class GlobalsDumpDecoder {
  private fragments = new Map<number, Uint8Array>();
  private gp5Fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
    this.gp5Fragments.clear();
  }

  push(bytes: Uint8Array): DeviceGlobals | null {
    const bluetooth = decodeBluetoothGlobalsDump(bytes);
    if (bluetooth) {
      this.fragments.clear();
      return bluetooth;
    }
    const gp5Bluetooth = decodeGp5BluetoothGlobalsDump(bytes);
    if (gp5Bluetooth) {
      this.gp5Fragments.clear();
      return gp5Bluetooth;
    }
    const midi = midiPayload(bytes);
    const header = usbGlobalsHeader(midi);
    if (header) {
      this.fragments.set(header.index, sysexPayload(midi, USB_PAYLOAD_AT));
      if (!header.terminator) {
        return null;
      }
      const merged = assembleFragments(this.fragments);
      this.fragments.clear();
      return decodeUsbGlobalsPayload(merged);
    }
    const gp5Header = usbGp5GlobalsHeader(midi);
    if (!gp5Header) {
      return null;
    }
    this.gp5Fragments.set(gp5Header.index, sysexPayload(midi, USB_PAYLOAD_AT));
    if (!gp5Header.terminator) {
      return null;
    }
    const merged = assembleFragments(this.gp5Fragments);
    this.gp5Fragments.clear();
    return decodeGp5UsbPayload(merged);
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

export function isGp50SysexKey(key: string): key is GlobalSysexKey {
  return Object.prototype.hasOwnProperty.call(SYSEX_ROWS, key);
}

const GP5_SYSEX_ROWS: Record<Gp5GlobalSysexKey, { effect: number; flag: number }> = {
  inputLevel: { effect: 1, flag: 3 },
  noCab: { effect: 3, flag: 3 },
  recLevel: { effect: 1, flag: 4 },
  btRec: { effect: 5, flag: 4 },
  monLevel: { effect: 2, flag: 4 },
  screenBrightness: { effect: 3, flag: 2 },
};

export function isGp5SysexKey(key: string): key is Gp5GlobalSysexKey {
  return Object.prototype.hasOwnProperty.call(GP5_SYSEX_ROWS, key);
}

/**
 * Parameter-write SET for a GP-5 global row (family `1111`).
 * BT REC is effect 5 / flag 4 and monitor is effect 2 / flag 4 — not the GP-50 pairs.
 * Path `01 01 04` after CRC + nibble-expand. Not CC 1 and not global volume.
 */
export function encodeGp5GlobalSysex(
  key: Gp5GlobalSysexKey,
  value: number | boolean,
): Uint8Array | null {
  const row = GP5_SYSEX_ROWS[key];
  let wire: number | null = null;
  if (key === "noCab") {
    if (typeof value !== "boolean") {
      return null;
    }
    wire = value ? 1 : 0;
  } else if (key === "screenBrightness") {
    if (typeof value !== "number") {
      return null;
    }
    wire = clampScreen(value);
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
 * GP-5 footswitch SET. Packed family `1115`, size `0x04`: `01 00 04 11 15 00` + mode.
 * Same CRC + nibble-expand as other SETs. Not CC 28 and not a `1111` body.
 */
export function encodeGp5Footswitch(mode: Gp5FootswitchMode): Uint8Array | null {
  const wire = gp5FootWire(mode);
  if (wire < 0) {
    return null;
  }
  return framePackedSet(Uint8Array.from([0x01, 0x00, 0x04, 0x11, 0x15, 0x00, wire]));
}

function liveLevel(valueByte: number): number | null {
  const level = fromSignedByte(valueByte);
  if (level < LEVEL_MIN || level > LEVEL_MAX) {
    return null;
  }
  return level;
}

function liveVolume(valueByte: number): number | null {
  const volume = fromSignedByte(valueByte);
  if (volume < 0 || volume > MASTER_VOLUME_MAX) {
    return null;
  }
  return volume;
}

/**
 * Shared 24-byte notify header (command `00 01`, size `0x07`, path `01 02`).
 * Effect at byte 14, flag at byte 16, value nibbles at 21–22.
 */
function liveNotify24(bytes: Uint8Array): { effect: number; flag: number; valueByte: number; low: number } | null {
  const midi = midiPayload(bytes);
  if (midi.length !== 24 || midi[0] !== 0xf0 || midi[23] !== 0xf7) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1 || midi[8] !== 0x07 || midi[9] !== 1 || midi[10] !== 2) {
    return null;
  }
  return {
    effect: midi[14] ?? 0,
    flag: midi[16] ?? 0,
    valueByte: (midi[21] ?? 0) * 16 + (midi[22] ?? 0),
    low: midi[22] ?? 0,
  };
}

function decodeGp50LiveGlobal(bytes: Uint8Array): LiveGlobalChange | null {
  const notify = liveNotify24(bytes);
  if (!notify) {
    return null;
  }
  const { effect, flag, valueByte, low } = notify;
  if (effect === 2 && flag === 2) {
    const volume = liveVolume(valueByte);
    if (volume === null) {
      return null;
    }
    return { model: "gp50", key: "masterVolume", value: volume };
  }
  if (effect === 1 && flag === 6) {
    return { model: "gp50", key: "footswitchMode", value: low === 0 ? "patch" : "stomp" };
  }
  if (effect === 1 && flag === 3) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp50", key: "inputLevel", value: level };
  }
  if (effect === 3 && flag === 3) {
    return { model: "gp50", key: "noCab", value: low !== 0 };
  }
  if (effect === 1 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp50", key: "recLevel", value: level };
  }
  if (effect === 2 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp50", key: "btRec", value: level };
  }
  if (effect === 3 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp50", key: "monLevel", value: level };
  }
  if (effect === 4 && flag === 4) {
    return { model: "gp50", key: "recModeLeft", value: recModeFromWire(low) };
  }
  if (effect === 5 && flag === 4) {
    return { model: "gp50", key: "recModeRight", value: recModeFromWire(low) };
  }
  return null;
}

function decodeGp5LiveGlobal(bytes: Uint8Array): LiveGlobalChange | null {
  const midi = midiPayload(bytes);
  if (
    midi.length === 18 &&
    midi[0] === 0xf0 &&
    midi[17] === 0xf7 &&
    midi[3] === 0 &&
    midi[4] === 1 &&
    midi[8] === 0x04 &&
    midi[9] === 1 &&
    midi[10] === 2 &&
    midi[11] === 1 &&
    midi[12] === 5
  ) {
    const mode = gp5FootFromWire((midi[15] ?? 0) * 16 + (midi[16] ?? 0));
    if (!mode) {
      return null;
    }
    return { model: "gp5", key: "footswitchMode", value: mode };
  }
  const notify = liveNotify24(bytes);
  if (!notify) {
    return null;
  }
  const { effect, flag, valueByte, low } = notify;
  if (effect === 1 && flag === 3) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp5", key: "inputLevel", value: level };
  }
  if (effect === 3 && flag === 3) {
    return { model: "gp5", key: "noCab", value: low !== 0 };
  }
  if (effect === 1 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp5", key: "recLevel", value: level };
  }
  if (effect === 5 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp5", key: "btRec", value: level };
  }
  if (effect === 2 && flag === 4) {
    const level = liveLevel(valueByte);
    if (level === null) {
      return null;
    }
    return { model: "gp5", key: "monLevel", value: level };
  }
  return null;
}

/**
 * Pedal→app live global notify (Bluetooth). The 24-byte layout is shared;
 * effect/flag meaning depends on the connected model. GP-5 also accepts the
 * length-18 footswitch notify. Global volume (length-30 or effect 2 / flag 2)
 * is not a Settings row. Screen brightness has no live packet.
 */
export function decodeLiveGlobal(bytes: Uint8Array, model: "gp50" | "gp5" = "gp50"): LiveGlobalChange | null {
  return model === "gp5" ? decodeGp5LiveGlobal(bytes) : decodeGp50LiveGlobal(bytes);
}

/** Official CC 1 (master) or CC 28 (Patch | Stomp) as a GP-50 live global report. */
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
    return { model: "gp50", key: "masterVolume", value };
  }
  if (controller === 28) {
    return { model: "gp50", key: "footswitchMode", value: value < 64 ? "patch" : "stomp" };
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
    decoded.model !== "gp50" ||
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
  if (isGp5BluetoothGlobalsDump(fixture) || decodeGp5BluetoothGlobalsDump(fixture) !== null) {
    throw new Error("A GP-50 globals dump must not decode as GP-5");
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
    usbDecoded.model !== "gp50" ||
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

  const gp5 = new Uint8Array(GP5_BT_DUMP_LENGTH);
  gp5[0] = 0xf0;
  gp5[3] = 0;
  gp5[4] = 1;
  gp5[9] = 1;
  gp5[10] = 2;
  gp5[11] = 1;
  gp5[GP5_BT_DUMP_LENGTH - 1] = 0xf7;
  writeSignedAt(gp5, GP5_BT_VOL_AT, 40);
  writeSignedAt(gp5, GP5_BT_SCREEN_AT, 80);
  writeSignedAt(gp5, GP5_BT_INPUT_AT, 0);
  writeSignedAt(gp5, GP5_BT_REC_AT, -6);
  writeSignedAt(gp5, GP5_BT_MON_AT, 2);
  writeSignedAt(gp5, GP5_BT_BT_AT, 3);
  gp5[GP5_BT_NO_CAB_AT] = 1;
  gp5[GP5_BT_FOOT_AT] = 3;
  if (isBluetoothGlobalsDump(gp5) || decodeGlobalsDump(gp5) !== null) {
    throw new Error("A GP-5 globals dump must not decode as GP-50");
  }
  const gp5Decoded = decodeGp5BluetoothGlobalsDump(gp5);
  if (
    !gp5Decoded ||
    gp5Decoded.globalVolume !== 40 ||
    gp5Decoded.screenBrightness !== 80 ||
    gp5Decoded.inputLevel !== 0 ||
    gp5Decoded.recLevel !== -6 ||
    gp5Decoded.monLevel !== 2 ||
    gp5Decoded.btRec !== 3 ||
    gp5Decoded.noCab !== true ||
    gp5Decoded.footswitchMode !== "CTL"
  ) {
    throw new Error("GP-5 Bluetooth globals dump must decode the reference-editor offsets");
  }
  const presetLookalike = new Uint8Array(GP5_BT_DUMP_LENGTH);
  presetLookalike[0] = 0xf0;
  presetLookalike[3] = 0;
  presetLookalike[4] = 1;
  presetLookalike[GP5_BT_DUMP_LENGTH - 1] = 0xf7;
  if (isGlobalsDump(presetLookalike) || decodeGp5BluetoothGlobalsDump(presetLookalike) !== null) {
    throw new Error("A command 00 01 packet without path 01 02 01 must not classify as a GP-5 globals dump");
  }
  const badInput = gp5.slice();
  writeSignedAt(badInput, GP5_BT_INPUT_AT, 21);
  if (decodeGp5BluetoothGlobalsDump(badInput) !== null) {
    throw new Error("An out-of-range GP-5 input level must not apply the dump");
  }
  const unusedVolume = gp5.slice();
  writeSignedAt(unusedVolume, GP5_BT_VOL_AT, 101);
  const relaxed = decodeGp5BluetoothGlobalsDump(unusedVolume);
  if (
    !relaxed ||
    relaxed.globalVolume !== null ||
    relaxed.inputLevel !== 0 ||
    relaxed.noCab !== true ||
    relaxed.recLevel !== -6 ||
    relaxed.btRec !== 3 ||
    relaxed.monLevel !== 2 ||
    relaxed.screenBrightness !== 80 ||
    relaxed.footswitchMode !== "CTL"
  ) {
    throw new Error("An out-of-range GP-5 volume byte must not block Settings rows");
  }
  const longPreset = new Uint8Array(200);
  longPreset[0] = 0xf0;
  longPreset[3] = 0;
  longPreset[4] = 5;
  longPreset[199] = 0xf7;
  if (isGlobalsDump(longPreset) || isGp5UsbGlobalsDumpFragment(longPreset)) {
    throw new Error("A long GP-5 Bluetooth preset fragment must not classify as USB globals");
  }

  const gp5UsbPayload = new Uint8Array(38 * 4 + 2);
  writeSignedAt(gp5UsbPayload, GP5_USB_VOL_AT, 40);
  writeSignedAt(gp5UsbPayload, GP5_USB_SCREEN_AT, 0);
  writeSignedAt(gp5UsbPayload, GP5_USB_INPUT_AT, 1);
  writeSignedAt(gp5UsbPayload, GP5_USB_REC_AT, -4);
  writeSignedAt(gp5UsbPayload, GP5_USB_MON_AT, 5);
  writeSignedAt(gp5UsbPayload, GP5_USB_BT_AT, -2);
  gp5UsbPayload[GP5_USB_NO_CAB_AT] = 0;
  gp5UsbPayload[GP5_USB_FOOT_AT] = 4;
  const gp5Chunks: Uint8Array[] = [];
  let gp5Offset = 0;
  let gp5Index = 0;
  while (gp5Offset + 38 < gp5UsbPayload.length) {
    const midi = new Uint8Array(USB_DATA_LENGTH);
    midi[0] = 0xf0;
    midi[3] = 0;
    midi[4] = GP5_USB_COMMAND;
    midi[5] = (gp5Index >> 4) & 0x0f;
    midi[6] = gp5Index & 0x0f;
    midi.set(gp5UsbPayload.subarray(gp5Offset, gp5Offset + 38), USB_PAYLOAD_AT);
    midi[USB_DATA_LENGTH - 1] = 0xf7;
    gp5Chunks.push(midi);
    gp5Offset += 38;
    gp5Index += 1;
  }
  const gp5Term = new Uint8Array(GP5_USB_TERMINATOR_LENGTH);
  gp5Term[0] = 0xf0;
  gp5Term[3] = 0;
  gp5Term[4] = GP5_USB_COMMAND;
  gp5Term[5] = (gp5Index >> 4) & 0x0f;
  gp5Term[6] = gp5Index & 0x0f;
  gp5Term.set(gp5UsbPayload.subarray(gp5Offset), USB_PAYLOAD_AT);
  gp5Term[GP5_USB_TERMINATOR_LENGTH - 1] = 0xf7;
  gp5Chunks.push(gp5Term);
  const gp5UsbDecoder = new GlobalsDumpDecoder();
  let gp5UsbDecoded: DeviceGlobals | null = null;
  for (const chunk of gp5Chunks) {
    if (isUsbGlobalsDumpFragment(chunk)) {
      throw new Error("A GP-5 USB globals fragment must not classify as GP-50");
    }
    if (!isGp5UsbGlobalsDumpFragment(chunk)) {
      throw new Error("GP-5 USB globals fragment must classify");
    }
    gp5UsbDecoded = gp5UsbDecoder.push(chunk);
  }
  if (
    !gp5UsbDecoded ||
    gp5UsbDecoded.model !== "gp5" ||
    gp5UsbDecoded.globalVolume !== 40 ||
    gp5UsbDecoded.screenBrightness !== null ||
    gp5UsbDecoded.inputLevel !== 1 ||
    gp5UsbDecoded.recLevel !== -4 ||
    gp5UsbDecoded.monLevel !== 5 ||
    gp5UsbDecoded.btRec !== -2 ||
    gp5UsbDecoded.noCab !== false ||
    gp5UsbDecoded.footswitchMode !== "Tuner"
  ) {
    throw new Error("GP-5 USB globals must keep other fields when screen brightness is out of range");
  }

  const gp5BtSet = encodeGp5GlobalSysex("btRec", 0);
  const gp50BtSet = encodeGlobalSysex("btRec", 0);
  const gp5BtPacked = Uint8Array.from([0x01, 0x00, 0x0a, 0x11, 0x11, 0x05, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const gp5Screen = encodeGp5GlobalSysex("screenBrightness", 40);
  const gp5ScreenPacked = Uint8Array.from([0x01, 0x00, 0x0a, 0x11, 0x11, 0x03, 0x02, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00]);
  const gp5Input = encodeGp5GlobalSysex("inputLevel", 6);
  const gp5InputPacked = Uint8Array.from([0x01, 0x00, 0x0a, 0x11, 0x11, 0x01, 0x03, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00]);
  const gp5Foot = encodeGp5Footswitch("CTL");
  const gp5FootPacked = framePackedSet(Uint8Array.from([0x01, 0x00, 0x04, 0x11, 0x15, 0x00, 0x03]));
  if (
    isGp5SysexKey("globalVolume") ||
    !gp5BtSet ||
    !gp50BtSet ||
    !gp5Screen ||
    !gp5Input ||
    !gp5Foot ||
    sameBytes(gp5BtSet, gp50BtSet) ||
    !sameBytes(gp5BtSet, framePackedSet(gp5BtPacked)) ||
    !sameBytes(gp5Screen, framePackedSet(gp5ScreenPacked)) ||
    !sameBytes(gp5Input, framePackedSet(gp5InputPacked)) ||
    !sameBytes(gp5Foot, gp5FootPacked) ||
    gp5Screen[0] === 0xb0 ||
    gp5Input[0] === 0xb0 ||
    gp5Input.length === 3 ||
    gp5Foot.length === 24 ||
    gp5Foot[0] === 0xb0 ||
    encodeGp5GlobalSysex("screenBrightness", 0) !== null
  ) {
    throw new Error("GP-5 SETs must use GP-5 pairs, omit global volume, and must not be CC 1, CC 28, or a live notify");
  }

  const crossed = liveNotify(2, 4, -6);
  const gp5Monitor = decodeLiveGlobal(crossed, "gp5");
  const gp50Bt = decodeLiveGlobal(crossed, "gp50");
  const btOnGp5 = decodeLiveGlobal(liveNotify(5, 4, 3), "gp5");
  const recOnGp50 = decodeLiveGlobal(liveNotify(5, 4, 3), "gp50");
  if (
    !gp5Monitor ||
    gp5Monitor.model !== "gp5" ||
    gp5Monitor.key !== "monLevel" ||
    gp5Monitor.value !== -6 ||
    !gp50Bt ||
    gp50Bt.model !== "gp50" ||
    gp50Bt.key !== "btRec" ||
    gp50Bt.value !== -6 ||
    !btOnGp5 ||
    btOnGp5.key !== "btRec" ||
    btOnGp5.value !== 3 ||
    !recOnGp50 ||
    recOnGp50.key !== "recModeRight"
  ) {
    throw new Error("Effect 2/4 is monitor on GP-5 and BT REC on GP-50; effect 5/4 is BT REC on GP-5");
  }
  if (decodeLiveGlobal(liveNotify(3, 2, 40), "gp5") !== null) {
    throw new Error("GP-5 must not invent a live screen-brightness packet");
  }
  const volNotify = new Uint8Array(30);
  volNotify[0] = 0xf0;
  volNotify[3] = 0;
  volNotify[4] = 1;
  volNotify[8] = 0x0a;
  volNotify[9] = 1;
  volNotify[10] = 2;
  volNotify[14] = 2;
  volNotify[16] = 2;
  volNotify[21] = 0x02;
  volNotify[22] = 0x08;
  volNotify[29] = 0xf7;
  const footNotify = new Uint8Array(18);
  footNotify[0] = 0xf0;
  footNotify[3] = 0;
  footNotify[4] = 1;
  footNotify[8] = 0x04;
  footNotify[9] = 1;
  footNotify[10] = 2;
  footNotify[11] = 1;
  footNotify[12] = 5;
  footNotify[16] = 1;
  footNotify[17] = 0xf7;
  const footChange = decodeLiveGlobal(footNotify, "gp5");
  if (
    decodeLiveGlobal(volNotify, "gp5") !== null ||
    decodeLiveGlobal(liveNotify(2, 2, 40), "gp5") !== null ||
    !footChange ||
    footChange.key !== "footswitchMode" ||
    footChange.value !== "0-9" ||
    decodeLiveGlobal(volNotify, "gp50") !== null
  ) {
    throw new Error("GP-5 volume notifies are not Settings rows; the length-18 footswitch notify stays GP-5 only");
  }
}

function liveNotify(effect: number, flag: number, value: number): Uint8Array {
  const midi = new Uint8Array(24);
  midi[0] = 0xf0;
  midi[3] = 0;
  midi[4] = 1;
  midi[8] = 0x07;
  midi[9] = 1;
  midi[10] = 2;
  midi[14] = effect;
  midi[16] = flag;
  const wire = value < 0 ? 0x100 + value : value;
  midi[21] = (wire >> 4) & 0x0f;
  midi[22] = wire & 0x0f;
  midi[23] = 0xf7;
  return midi;
}

assertGlobalsCodec();
