import { formatPatch } from "@/device/identity";
import type { DeviceModel } from "@/device/models";
import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/** Packed SET header: size `0x10`, path `01 01 04`, family `114a` (store). */
const STORE_SET_PREFIX = [0x01, 0x00, 0x10, 0x11, 0x4a] as const;
const PATCH_NAME_LENGTH = 10;
const PATCH_FILE_MAGIC = new Uint8Array([0x50, 0x41, 0x54, 0x4f]); // PATO
const PATCH_FILE_VERSION = 1;

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
  return `${model}-${formatPatch(slot)}-${slug}.patch`;
}

/** Patone-owned current-patch file: magic + version + model + slot + name + dump. */
export function encodePatchFile(options: {
  model: DeviceModel;
  slot: number;
  name: string;
  dump: Uint8Array;
}): Uint8Array {
  const nameBytes =
    paddedNameBytes(options.name) ?? new Uint8Array(PATCH_NAME_LENGTH).fill(0x20);
  const header = new Uint8Array(4 + 1 + 1 + 1 + PATCH_NAME_LENGTH);
  header.set(PATCH_FILE_MAGIC, 0);
  header[4] = PATCH_FILE_VERSION;
  header[5] = options.model === "gp50" ? 1 : 0;
  header[6] = options.slot & 0xff;
  header.set(nameBytes, 7);
  const bytes = new Uint8Array(header.length + options.dump.length);
  bytes.set(header, 0);
  bytes.set(options.dump, header.length);
  return bytes;
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
  if (currentPatchFilename("gp50", 5, "Flow") !== "gp50-05-Flow.patch") {
    throw new Error("GP-50 download filename must be gp50-05-Flow.patch");
  }
  if (currentPatchFilename("gp5", 5, "Flow") !== "gp5-05-Flow.patch") {
    throw new Error("GP-5 download filename must follow the connected model");
  }
  const wrapped = encodePatchFile({
    model: "gp50",
    slot: 5,
    name: "Flow",
    dump: Uint8Array.from([0xab, 0xcd]),
  });
  if (
    wrapped[0] !== 0x50 ||
    wrapped[5] !== 1 ||
    wrapped[6] !== 5 ||
    wrapped[wrapped.length - 2] !== 0xab ||
    wrapped[wrapped.length - 1] !== 0xcd
  ) {
    throw new Error("Patch file must wrap magic + model + slot + dump");
  }
  if (!sameBytes(save.subarray(3, 13), duplicate.subarray(3, 13))) {
    throw new Error("Save and duplicate must share the 114a header");
  }
}

assertPatchStoreFixtures();
