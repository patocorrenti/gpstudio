import { formatPatch } from "@/device/identity";
import type { DeviceModel } from "@/device/models";
import { GP5_TOB_PRST_HEX, GP50_TOB_PRST_HEX } from "@/device/prst-tob-fixtures";
import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/** Packed SET header: size `0x10`, path `01 01 04`, family `114a` (store). */
const STORE_SET_PREFIX = [0x01, 0x00, 0x10, 0x11, 0x4a] as const;
/** Packed SET header: size `0x0A`, family `1142` (patch volume / BPM). */
const PATCH_GLOBAL_SET_PREFIX = [0x01, 0x00, 0x0a, 0x11, 0x42] as const;
const PATCH_VOL_KIND = [0x01, 0x20, 0x00, 0x00] as const;
const PATCH_BPM_KIND = [0x02, 0x20, 0x04, 0x00] as const;
const PATCH_NAME_LENGTH = 10;
const PRST_HEADER_LENGTH = 20;
const PRST_SPACER = Uint8Array.from([0xff, 0xff, 0xff, 0xff]);
/**
 * Packed `.prst` body starts at the GP-50 enable-bits offset in Patone's
 * concatenated current-preset dump. Locked against `_reference/gp50_60-TOB.prst`
 * (order + identities + float32 values decode). The HTML editor pairs from
 * dump index 120; that slice does not overlap the capture body.
 */
const GP50_PRST_BODY_AT = 226;
/** GP-5 dump is 86 nibble bytes shorter at the front (`GP5_DUMP_SHIFT`). */
const GP5_PRST_BODY_AT = 140;
const GP50_PRST_BODY_LENGTH = 400;
const GP5_PRST_BODY_LENGTH = 398;
const GP50_DUMP_VOL_AT = 100;
const GP50_DUMP_BPM_AT = 110;
const GP5_DUMP_SHIFT = GP50_PRST_BODY_AT - GP5_PRST_BODY_AT;
const GP50_DESC_VOL_AT = 54;
const GP50_DESC_BPM_AT = 59;
const GP5_DESC_VOL_AT = 54;
const GP5_DESC_BPM_AT = 62;
const PATCH_VOL_MAX = 100;
const PATCH_BPM_MIN = 40;
const PATCH_BPM_MAX = 260;

/**
 * GP-50 descriptor from `_reference/gp50_60-TOB.prst` (117 bytes). Not the
 * truncated HTML constant (that file uses `28` where HTML has `78`, then extra TLVs).
 * Unmapped TLVs stay at these capture defaults.
 */
const GP50_DESCRIPTOR = bytesFromHex(
  "000000000000ff0010000100040001000000020004004750353000001000011004000a000000021004000800000001003b000120010032022004002800000003200100000420040000000000052004006400000006200100000720010000082001006409200100000a200100000200860101300400",
);

/** GP-5 descriptor from `_reference/gp5_60-TOB.prst` (74 bytes). */
const GP5_DESCRIPTOR = bytesFromHex(
  "000000000000ff0010000100040001000000020004000a454d5100001000011004000a000000021004000800000001001000012004003200000002200400780000000200860101300400",
);

function bytesFromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex fixture length must be even");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
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
 * Pedal patch names: ASCII letters, digits, space, hyphen; at most 10 chars.
 * Accents are stripped (NFD); anything else is dropped. Blank after that is empty.
 */
export function sanitizePatchName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .slice(0, PATCH_NAME_LENGTH)
    .trim();
}

function paddedNameBytes(name: string): Uint8Array | null {
  const sanitized = sanitizePatchName(name);
  if (!sanitized) {
    return null;
  }
  const padded = sanitized.padEnd(PATCH_NAME_LENGTH, " ");
  const bytes = new Uint8Array(PATCH_NAME_LENGTH);
  for (let index = 0; index < PATCH_NAME_LENGTH; index += 1) {
    bytes[index] = padded.charCodeAt(index);
  }
  return bytes;
}

/** `.prst` names: 10 bytes, spaces stored as NUL, unused tail NUL. */
function nulNameBytes(name: string): Uint8Array {
  const sanitized = sanitizePatchName(name);
  const bytes = new Uint8Array(PATCH_NAME_LENGTH);
  for (let index = 0; index < sanitized.length; index += 1) {
    const code = sanitized.charCodeAt(index);
    bytes[index] = code === 0x20 ? 0x00 : code;
  }
  return bytes;
}

/**
 * App→pedal current-patch store SET (family `114a`). Packed destination slot
 * 0–99 + 10-character space-padded name. Path `01 01 04`, CRC-8 ATM,
 * nibble-expand, `F0`…`F7`. Not a live notify and not a full preset dump.
 * Bluetooth wrap is one GATT write (`encodeLinkMidi`).
 */
export function encodePatchStoreSysex(slot: number, name: string): Uint8Array | null {
  if (!Number.isInteger(slot) || slot < 0 || slot > 99) {
    return null;
  }
  const nameBytes = paddedNameBytes(name);
  if (!nameBytes) {
    return null;
  }
  const packed = Uint8Array.from([
    ...STORE_SET_PREFIX,
    slot,
    0x00,
    0x00,
    0x00,
    ...nameBytes,
  ]);
  return framePackedSet(packed);
}

export function currentPatchFilename(
  model: DeviceModel,
  slot: number,
  name: string,
): string {
  const slug = sanitizePatchName(name).replace(/ +/g, "-") || "patch";
  return `${model}_${formatPatch(slot)}-${slug}.prst`;
}

function prstModelHeader(model: DeviceModel): Uint8Array {
  const header = new Uint8Array(PRST_HEADER_LENGTH);
  const label = model === "gp50" ? "GP-50" : "GP-5";
  for (let index = 0; index < label.length; index += 1) {
    header[index] = label.charCodeAt(index);
  }
  header[18] = 0x01;
  header[19] = 0x00;
  return header;
}

function prstLayout(model: DeviceModel): {
  bodyAt: number;
  bodyLength: number;
  volAt: number;
  bpmAt: number;
} {
  if (model === "gp50") {
    return {
      bodyAt: GP50_PRST_BODY_AT,
      bodyLength: GP50_PRST_BODY_LENGTH,
      volAt: GP50_DUMP_VOL_AT,
      bpmAt: GP50_DUMP_BPM_AT,
    };
  }
  // Chain body is shifted −86 vs GP-50; patch volume stays at dump word 100
  // (same as the GP-5 reference editor). BPM is unused on GP-5 UI.
  return {
    bodyAt: GP5_PRST_BODY_AT,
    bodyLength: GP5_PRST_BODY_LENGTH,
    volAt: GP50_DUMP_VOL_AT,
    bpmAt: GP50_DUMP_BPM_AT - GP5_DUMP_SHIFT,
  };
}

function packNibblePairs(
  dump: Uint8Array,
  start: number,
  packedLength: number,
): Uint8Array | null {
  const end = start + packedLength * 2;
  if (dump.length < end) {
    return null;
  }
  const packed = new Uint8Array(packedLength);
  for (let index = 0; index < packedLength; index += 1) {
    const high = dump[start + index * 2] & 0x0f;
    const low = dump[start + index * 2 + 1] & 0x0f;
    packed[index] = (high << 4) | low;
  }
  return packed;
}

function packedWord(dump: Uint8Array, at: number): number | null {
  if (dump.length < at + 2) {
    return null;
  }
  return dump[at] * 16 + dump[at + 1];
}

function writeU32Le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

function readU32Le(bytes: Uint8Array, offset: number): number | null {
  if (offset + 3 >= bytes.length) {
    return null;
  }
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

function decodeNulName(bytes: Uint8Array): string {
  let name = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const code = bytes[index];
    name += String.fromCharCode(code === 0 ? 0x20 : code);
  }
  return name.trim();
}

function parsePrstHeader(bytes: Uint8Array): DeviceModel | null {
  if (bytes.length < PRST_HEADER_LENGTH) {
    return null;
  }
  if (bytes[18] !== 0x01 || bytes[19] !== 0x00) {
    return null;
  }
  if (asciiPrefix(bytes, 5) === "GP-50") {
    return "gp50";
  }
  if (asciiPrefix(bytes, 4) === "GP-5") {
    return "gp5";
  }
  return null;
}

function expectedPrstLength(model: DeviceModel): number {
  const descriptor = model === "gp50" ? GP50_DESCRIPTOR : GP5_DESCRIPTOR;
  const layout = prstLayout(model);
  return (
    PRST_HEADER_LENGTH +
    1 +
    PRST_SPACER.length +
    PATCH_NAME_LENGTH +
    descriptor.length +
    layout.bodyLength
  );
}

function encodePatchGlobalSysex(kind: readonly number[], value: number): Uint8Array | null {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    return null;
  }
  const packed = Uint8Array.from([...PATCH_GLOBAL_SET_PREFIX, ...kind, value, 0x00, 0x00, 0x00]);
  return framePackedSet(packed);
}

/**
 * App→pedal patch volume SET (family `1142`). Packed body locked from the
 * reference black-box `sendPatchVol`, not a Patone accept capture.
 */
export function encodePatchVolumeSysex(volume: number): Uint8Array | null {
  if (!Number.isInteger(volume) || volume < 0 || volume > PATCH_VOL_MAX) {
    return null;
  }
  return encodePatchGlobalSysex(PATCH_VOL_KIND, volume);
}

/**
 * App→pedal patch BPM SET (family `1142`). Packed body locked from the
 * reference black-box `sendBPM`. One-byte values only (40–255).
 */
export function encodePatchBpmSysex(bpm: number): Uint8Array | null {
  if (!Number.isInteger(bpm) || bpm < PATCH_BPM_MIN || bpm > 255) {
    return null;
  }
  return encodePatchGlobalSysex(PATCH_BPM_KIND, bpm);
}

function prstDescriptor(model: DeviceModel, dump: Uint8Array): Uint8Array {
  const descriptor = Uint8Array.from(model === "gp50" ? GP50_DESCRIPTOR : GP5_DESCRIPTOR);
  const volume = readDumpPatchVolume(model, dump);
  const bpm = readDumpPatchBpm(model, dump);
  if (volume !== null) {
    if (model === "gp50") {
      descriptor[GP50_DESC_VOL_AT] = volume;
    } else {
      writeU32Le(descriptor, GP5_DESC_VOL_AT, volume);
    }
  }
  if (bpm !== null) {
    writeU32Le(
      descriptor,
      model === "gp50" ? GP50_DESC_BPM_AT : GP5_DESC_BPM_AT,
      bpm,
    );
  }
  return descriptor;
}

/**
 * Valeton `.prst` for the connected model from a Patone-assembled current-preset
 * dump. GP-50 session → GP-50 file; GP-5 session → GP-5 file. No conversion.
 * Returns null when the dump is too short to slice the capture-sized body.
 */
export function encodePrstFile(options: {
  model: DeviceModel;
  name: string;
  dump: Uint8Array;
}): Uint8Array | null {
  const layout = prstLayout(options.model);
  const body = packNibblePairs(options.dump, layout.bodyAt, layout.bodyLength);
  if (!body) {
    return null;
  }
  const header = prstModelHeader(options.model);
  const nameBytes = nulNameBytes(options.name);
  const descriptor = prstDescriptor(options.model, options.dump);
  const rest = new Uint8Array(
    PRST_SPACER.length + nameBytes.length + descriptor.length + body.length,
  );
  rest.set(PRST_SPACER, 0);
  rest.set(nameBytes, PRST_SPACER.length);
  rest.set(descriptor, PRST_SPACER.length + nameBytes.length);
  rest.set(body, PRST_SPACER.length + nameBytes.length + descriptor.length);
  const file = new Uint8Array(header.length + 1 + rest.length);
  file.set(header, 0);
  file[header.length] = crc8Atm(rest);
  file.set(rest, header.length + 1);
  return file;
}

export type DecodedPrstFile = {
  model: DeviceModel;
  name: string;
  dump: Uint8Array;
  volume: number | null;
  bpm: number | null;
};

function descriptorVolume(model: DeviceModel, descriptor: Uint8Array): number | null {
  if (model === "gp50") {
    if (GP50_DESC_VOL_AT >= descriptor.length) {
      return null;
    }
    return descriptor[GP50_DESC_VOL_AT];
  }
  return readU32Le(descriptor, GP5_DESC_VOL_AT);
}

function descriptorBpm(model: DeviceModel, descriptor: Uint8Array): number | null {
  return readU32Le(
    descriptor,
    model === "gp50" ? GP50_DESC_BPM_AT : GP5_DESC_BPM_AT,
  );
}

/**
 * Inverse of `encodePrstFile`. Accepts only the connected-model layout locked
 * from the TOB captures. Short files, bad CRC, unknown headers, and the other
 * model's length return null. Does not convert across models.
 */
export function decodePrstFile(bytes: Uint8Array): DecodedPrstFile | null {
  const model = parsePrstHeader(bytes);
  if (!model || bytes.length !== expectedPrstLength(model)) {
    return null;
  }
  const descriptorLength = (model === "gp50" ? GP50_DESCRIPTOR : GP5_DESCRIPTOR).length;
  const rest = bytes.subarray(PRST_HEADER_LENGTH + 1);
  if (crc8Atm(rest) !== bytes[PRST_HEADER_LENGTH]) {
    return null;
  }
  if (!sameBytes(rest.subarray(0, PRST_SPACER.length), PRST_SPACER)) {
    return null;
  }
  const nameAt = PRST_SPACER.length;
  const descriptorAt = nameAt + PATCH_NAME_LENGTH;
  const bodyAt = descriptorAt + descriptorLength;
  const layout = prstLayout(model);
  const body = rest.subarray(bodyAt);
  if (body.length !== layout.bodyLength) {
    return null;
  }
  const descriptor = rest.subarray(descriptorAt, bodyAt);
  const dumpLength = layout.bodyAt + layout.bodyLength * 2;
  const dump = expandPackedBody(body, layout.bodyAt, dumpLength);
  const volume = descriptorVolume(model, descriptor);
  const bpm = descriptorBpm(model, descriptor);
  const volumeOk =
    volume !== null && volume >= 0 && volume <= PATCH_VOL_MAX ? volume : null;
  const bpmOk =
    bpm !== null && bpm >= PATCH_BPM_MIN && bpm <= PATCH_BPM_MAX ? bpm : null;
  if (volumeOk !== null) {
    writeDumpPatchVolume(model, dump, volumeOk);
  }
  if (bpmOk !== null) {
    writeDumpPatchBpm(model, dump, bpmOk);
  }
  return {
    model,
    name: decodeNulName(rest.subarray(nameAt, descriptorAt)),
    dump,
    volume: volumeOk,
    bpm: bpmOk,
  };
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

function asciiPrefix(bytes: Uint8Array, length: number): string {
  return String.fromCharCode(...bytes.subarray(0, length));
}

function expandPackedBody(body: Uint8Array, start: number, dumpLength: number): Uint8Array {
  const dump = new Uint8Array(dumpLength);
  for (let index = 0; index < body.length; index += 1) {
    dump[start + index * 2] = (body[index] >> 4) & 0x0f;
    dump[start + index * 2 + 1] = body[index] & 0x0f;
  }
  return dump;
}

function writePackedWord(dump: Uint8Array, at: number, value: number): void {
  dump[at] = (value >> 4) & 0x0f;
  dump[at + 1] = value & 0x0f;
}

/** Patch volume from the current-preset dump word `.prst` already uses. Out of 0–100 is null. */
export function readDumpPatchVolume(model: DeviceModel, dump: Uint8Array): number | null {
  const word = packedWord(dump, prstLayout(model).volAt);
  if (word === null || word < 0 || word > PATCH_VOL_MAX) {
    return null;
  }
  return word;
}

/**
 * Patch BPM from the current-preset dump word `.prst` already uses.
 * Words 40–255 are BPM directly. Words 0–4 are the high tempo range
 * (256–260), matching CC 73/74 LSB when MSB is 2. Other values are null.
 */
export function readDumpPatchBpm(model: DeviceModel, dump: Uint8Array): number | null {
  const word = packedWord(dump, prstLayout(model).bpmAt);
  if (word === null) {
    return null;
  }
  if (word >= PATCH_BPM_MIN && word <= 255) {
    return word;
  }
  if (word >= 0 && word <= 4) {
    return 256 + word;
  }
  return null;
}

/** Write patch volume into the dump word slot. No-op outside 0–100 or if the dump is short. */
export function writeDumpPatchVolume(
  model: DeviceModel,
  dump: Uint8Array,
  volume: number,
): void {
  if (!Number.isInteger(volume) || volume < 0 || volume > PATCH_VOL_MAX) {
    return;
  }
  const at = prstLayout(model).volAt;
  if (dump.length < at + 2) {
    return;
  }
  writePackedWord(dump, at, volume);
}

/**
 * Write patch BPM into the dump word slot. 40–255 store as-is; 256–260 store
 * as BPM − 256 (the CC 74 LSB). No-op outside 40–260 or if the dump is short.
 */
export function writeDumpPatchBpm(model: DeviceModel, dump: Uint8Array, bpm: number): void {
  if (!Number.isInteger(bpm) || bpm < PATCH_BPM_MIN || bpm > PATCH_BPM_MAX) {
    return;
  }
  const at = prstLayout(model).bpmAt;
  if (dump.length < at + 2) {
    return;
  }
  writePackedWord(dump, at, bpm > 255 ? bpm - 256 : bpm);
}

function tobDumpFromCapture(model: DeviceModel, capture: Uint8Array): Uint8Array {
  const layout = prstLayout(model);
  const descriptor = model === "gp50" ? GP50_DESCRIPTOR : GP5_DESCRIPTOR;
  const bodyAt = 35 + descriptor.length;
  const body = capture.subarray(bodyAt, bodyAt + layout.bodyLength);
  const dumpLength = layout.bodyAt + layout.bodyLength * 2;
  const dump = expandPackedBody(body, layout.bodyAt, dumpLength);
  const volume =
    model === "gp50"
      ? capture[35 + GP50_DESC_VOL_AT]
      : capture[35 + GP5_DESC_VOL_AT];
  const bpm =
    model === "gp50"
      ? readU32Le(capture, 35 + GP50_DESC_BPM_AT)
      : readU32Le(capture, 35 + GP5_DESC_BPM_AT);
  writeDumpPatchVolume(model, dump, volume);
  if (bpm !== null) {
    writeDumpPatchBpm(model, dump, bpm);
  }
  return dump;
}

function assertPatchStoreFixtures(): void {
  if (sanitizePatchName("CaféExtraLong!") !== "CafeExtraL") {
    throw new Error("Accented or too-long patch names must be stripped then sliced to 10");
  }
  if (sanitizePatchName("   ") !== "" || encodePatchStoreSysex(0, "   ")) {
    throw new Error("Blank patch names must be rejected before encode");
  }
  if (encodePatchStoreSysex(100, "Flow") || encodePatchStoreSysex(-1, "Flow")) {
    throw new Error("Store SET slot must be 0–99");
  }

  const save = encodePatchStoreSysex(5, "Flow");
  const duplicate = encodePatchStoreSysex(80, "Flow");
  if (!save || save[0] !== 0xf0 || save[save.length - 1] !== 0xf7) {
    throw new Error("Store SET must be a framed SysEx");
  }
  // Packed family `114a` nibble-expands after the CRC byte.
  if (
    save[9] !== 0x01 ||
    save[10] !== 0x01 ||
    save[11] !== 0x04 ||
    save[12] !== 0x0a
  ) {
    throw new Error("Store SET must nibble-expand packed family 114a");
  }
  if (!duplicate || save[13] !== 0x00 || save[14] !== 0x05) {
    throw new Error("Store SET destination slot must be packed index 5 for Save");
  }
  if (duplicate[13] !== 0x05 || duplicate[14] !== 0x00) {
    throw new Error("Store SET destination slot must be packed index 80 for duplicate");
  }
  if (currentPatchFilename("gp50", 60, "TOB") !== "gp50_60-TOB.prst") {
    throw new Error("GP-50 download filename must be gp50_60-TOB.prst");
  }
  if (currentPatchFilename("gp5", 5, "Flow") !== "gp5_05-Flow.prst") {
    throw new Error("GP-5 download filename must follow the connected model");
  }
  if (!sameBytes(save.subarray(3, 13), duplicate.subarray(3, 13))) {
    throw new Error("Save and duplicate must share the 114a header");
  }

  const gp50Capture = bytesFromHex(GP50_TOB_PRST_HEX);
  const gp5Capture = bytesFromHex(GP5_TOB_PRST_HEX);
  const gp50Dump = tobDumpFromCapture("gp50", gp50Capture);
  const gp5Dump = tobDumpFromCapture("gp5", gp5Capture);
  const rebuiltGp50 = encodePrstFile({ model: "gp50", name: "TOB", dump: gp50Dump });
  const rebuiltGp5 = encodePrstFile({ model: "gp5", name: "TOB", dump: gp5Dump });
  if (!rebuiltGp50 || !rebuiltGp5) {
    throw new Error("TOB dump fixtures must be long enough to encode");
  }
  if (asciiPrefix(rebuiltGp50, 5) !== "GP-50" || rebuiltGp50[20] !== gp50Capture[20]) {
    throw new Error("GP-50 .prst rebuild must match capture header and checksum");
  }
  if (asciiPrefix(rebuiltGp5, 4) !== "GP-5" || rebuiltGp5[20] !== gp5Capture[20]) {
    throw new Error("GP-5 .prst rebuild must match capture header and checksum");
  }
  if (
    !sameBytes(rebuiltGp50.subarray(25, 35), gp50Capture.subarray(25, 35)) ||
    !sameBytes(rebuiltGp5.subarray(25, 35), gp5Capture.subarray(25, 35))
  ) {
    throw new Error("TOB .prst rebuild must match capture NUL names");
  }
  if (!sameBytes(rebuiltGp50, gp50Capture) || !sameBytes(rebuiltGp5, gp5Capture)) {
    throw new Error("TOB .prst rebuild must match the operator captures");
  }

  const packedAt226 = packNibblePairs(gp50Dump, GP50_PRST_BODY_AT, GP50_PRST_BODY_LENGTH);
  const captureBody = gp50Capture.subarray(35 + GP50_DESCRIPTOR.length);
  if (!packedAt226 || !sameBytes(packedAt226, captureBody)) {
    throw new Error("GP-50 dump body must pack from offset 226 onto the TOB capture");
  }
  const packedAt120 = packNibblePairs(gp50Dump, 120, GP50_PRST_BODY_LENGTH);
  if (packedAt120 && sameBytes(packedAt120, captureBody)) {
    throw new Error("HTML dump index 120 must not be treated as the capture body");
  }

  if (rebuiltGp50[4] !== 0x30) {
    throw new Error("GP-50 model must not emit a GP-5 .prst");
  }
  if (rebuiltGp5[4] === 0x30) {
    throw new Error("GP-5 model must not emit a GP-50 .prst");
  }
  if (encodePrstFile({ model: "gp50", name: "TOB", dump: new Uint8Array(225) })) {
    throw new Error("Short dumps must not invent a .prst");
  }
  const htmlDescriptor = bytesFromHex(
    "000000000000ff0010000100040001000000020004004750353000001000011004000a000000021004000800000001003b000120010032022004007800000003",
  );
  if (sameBytes(GP50_DESCRIPTOR.subarray(0, htmlDescriptor.length), htmlDescriptor)) {
    throw new Error("GP-50 descriptor must follow the capture, not the truncated HTML constant");
  }

  const decodedGp50 = decodePrstFile(gp50Capture);
  const decodedGp5 = decodePrstFile(gp5Capture);
  if (!decodedGp50 || !decodedGp5) {
    throw new Error("TOB captures must decode");
  }
  if (decodedGp50.model !== "gp50" || decodedGp50.name !== "TOB") {
    throw new Error("GP-50 TOB decode must yield GP-50 named TOB");
  }
  if (decodedGp5.model !== "gp5" || decodedGp5.name !== "TOB") {
    throw new Error("GP-5 TOB decode must yield GP-5 named TOB");
  }
  const roundTripGp50 = encodePrstFile({
    model: decodedGp50.model,
    name: decodedGp50.name,
    dump: decodedGp50.dump,
  });
  const roundTripGp5 = encodePrstFile({
    model: decodedGp5.model,
    name: decodedGp5.name,
    dump: decodedGp5.dump,
  });
  if (
    !roundTripGp50 ||
    !roundTripGp5 ||
    !sameBytes(roundTripGp50, gp50Capture) ||
    !sameBytes(roundTripGp5, gp5Capture)
  ) {
    throw new Error("TOB decode must round-trip through encode to the capture bytes");
  }
  if (
    packedWord(decodedGp50.dump, GP50_DUMP_VOL_AT) !== decodedGp50.volume ||
    readDumpPatchBpm("gp50", decodedGp50.dump) !== decodedGp50.bpm ||
    packedWord(decodedGp5.dump, GP50_DUMP_VOL_AT) !== decodedGp5.volume ||
    readDumpPatchVolume("gp5", decodedGp5.dump) !== decodedGp5.volume ||
    readDumpPatchBpm("gp5", decodedGp5.dump) !== decodedGp5.bpm
  ) {
    throw new Error("TOB decode must copy descriptor volume/BPM into dump word slots");
  }
  // GP-5 live dump: volume at 100 (not body-shifted 14). Byte 14 staying 0
  // must not be read as patch volume.
  const gp5LiveVol = new Uint8Array(decodedGp5.dump.length);
  writePackedWord(gp5LiveVol, GP50_DUMP_VOL_AT, 80);
  if (readDumpPatchVolume("gp5", gp5LiveVol) !== 80) {
    throw new Error("GP-5 dump patch volume must read from offset 100");
  }
  const highBpmDump = new Uint8Array(decodedGp50.dump);
  writeDumpPatchBpm("gp50", highBpmDump, 260);
  if (readDumpPatchBpm("gp50", highBpmDump) !== 260 || packedWord(highBpmDump, GP50_DUMP_BPM_AT) !== 4) {
    throw new Error("Dump BPM 256–260 must store as LSB and read back full tempo");
  }
  if (decodePrstFile(gp50Capture)?.model === "gp5") {
    throw new Error("A GP-50 capture must not decode as GP-5");
  }
  if (decodePrstFile(gp50Capture.subarray(0, gp5Capture.length))) {
    throw new Error("The other model's length must not decode");
  }
  if (decodePrstFile(gp50Capture.subarray(0, 40))) {
    throw new Error("A truncated buffer must not invent a dump");
  }
  const badCrc = Uint8Array.from(gp50Capture);
  badCrc[21] ^= 0x01;
  if (decodePrstFile(badCrc)) {
    throw new Error("Bad CRC must not decode");
  }
  const unknownHeader = Uint8Array.from(gp50Capture);
  unknownHeader[0] = 0x00;
  if (decodePrstFile(unknownHeader)) {
    throw new Error("Unknown headers must not decode");
  }

  const vol = encodePatchVolumeSysex(50);
  const bpm = encodePatchBpmSysex(120);
  if (!vol || !bpm || vol[0] !== 0xf0 || bpm[bpm.length - 1] !== 0xf7) {
    throw new Error("Patch volume/BPM SET must be framed SysEx");
  }
  if (
    vol[9] !== 0x01 ||
    vol[10] !== 0x01 ||
    vol[11] !== 0x04 ||
    vol[12] !== 0x02
  ) {
    throw new Error("Patch volume SET must nibble-expand packed family 1142");
  }
  if (encodePatchVolumeSysex(101) || encodePatchBpmSysex(39)) {
    throw new Error("Patch volume/BPM SET must reject out-of-range values");
  }
}

assertPatchStoreFixtures();
