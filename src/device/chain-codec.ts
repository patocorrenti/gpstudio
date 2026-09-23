import {
  KIND_VALUE_COUNT,
  modelByWire,
  modelsForKind,
  snapModelValues,
  type WireIdentity,
} from "@/device/catalog";
import { EFFECT_IDS, type AudioChain, type AudioChainSlot, type ChainSlotId, type EffectId } from "@/device/chain";
import type { DeviceModel } from "@/device/models";
import { encodeIrNameDump, isIrNameDump } from "@/device/ir-names";
import { isGlobalsDump } from "@/device/globals";
import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

/** Snapshot stomp lists: length 1 on GP-5, 2 on GP-50. EXP is never included. */
export type StompAssignment = EffectId[][];

/**
 * Current-preset dump request (F0…F7). Same identity-family template as
 * name-list (size 0x0E, command 0x00) and current-patch (size 0x07, command 0x03).
 * Size 0x09 + command 0x01 is the current-preset class. A GP-50 Bluetooth Patone
 * capture of size 0x0E + command 0x01 only returned a 16-byte ACK, not a dump.
 * Bluetooth wrap is applied by encodeLinkMidi.
 */
const CURRENT_CHAIN_REQUEST = Uint8Array.from([
  0xf0, 0x00, 0x09, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x04, 0x01,
  0xf7,
]);

export function encodeCurrentChainRequest(): Uint8Array {
  return CURRENT_CHAIN_REQUEST;
}

/** Dump order ids: NR PRE DST AMP CAB EQ MOD DLY RVB NS (not the UI EFFECT_IDS order). */
export const DUMP_MODULE_IDS = [
  "nr",
  "pre",
  "dst",
  "amp",
  "cab",
  "eq",
  "mod",
  "dly",
  "rvb",
  "ns",
] as const satisfies readonly EffectId[];

/**
 * Identity-family live chain-order notify (Patone Log, pedal chain edit).
 * Size `0x0C` at byte 8, command `0x04`, path `01 02 04`. Not a SET.
 * App→pedal SET uses parameter-write path `01 01 04` (see encodeChainOrderSysex).
 */
const CHAIN_ORDER_SIZE = 0x0c;
const CHAIN_ORDER_COMMAND = 0x04;
/** Packed SET header: size `0x0C`, path `01 01 04`, command `04`. */
const CHAIN_ORDER_SET_PREFIX = [0x01, 0x00, 0x0c, 0x11, 0x44] as const;
/** Packed SET header: size `0x0E`, path `01 01 04`, family `1147` (model) / `1148` (control). */
const MODEL_WRITE_SET_PREFIX = [0x01, 0x00, 0x0e, 0x11, 0x47] as const;
const CONTROL_WRITE_SET_PREFIX = [0x01, 0x00, 0x0e, 0x11, 0x48] as const;
/**
 * Packed SET header: size `0x05`, path `01 01 04`, family `114d` (stomp assignment).
 * Body: wire footswitch, effect index (DUMP_MODULE_IDS / CTL; NS=9), value 0|1.
 * GP-50 UI Footswitch A is wire `1`, B is wire `0` (operator 2026-09-23).
 * One effect bit per SET — not a full stomp mask.
 */
const STOMP_ASSIGN_SET_PREFIX = [0x01, 0x00, 0x05, 0x11, 0x4d] as const;

/** GP-50 stomp A / B mask bases; GP-5 single stomp (same 86-byte front shift). */
const GP50_STOMP_BASES = [1006, 1014] as const;
const GP5_STOMP_BASES = [920] as const;

/**
 * Wire footswitch index for a UI stomp column.
 * GP-50: UI A → `1`, UI B → `0`. GP-5: always `0`.
 */
export function stompWireFootswitch(
  model: DeviceModel,
  stompIndex: number,
): 0 | 1 | null {
  if (model === "gp5") {
    return stompIndex === 0 ? 0 : null;
  }
  if (stompIndex === 0) {
    return 1;
  }
  if (stompIndex === 1) {
    return 0;
  }
  return null;
}

/**
 * Enable-style bit map relative to a stomp mask base (CAB/EQ/MOD/DLY, NR/PRE/DST/AMP, RVB/NS).
 */
function stompEnableBits(base: number): Record<EffectId, EnableBit> {
  return {
    cab: [base, 0],
    eq: [base, 1],
    mod: [base, 2],
    dly: [base, 3],
    nr: [base + 1, 0],
    pre: [base + 1, 1],
    dst: [base + 1, 2],
    amp: [base + 1, 3],
    rvb: [base + 3, 0],
    ns: [base + 3, 1],
  };
}

export function emptyStomps(model: DeviceModel): StompAssignment {
  return model === "gp50" ? [[], []] : [[]];
}

function decodeStompMask(data: Uint8Array, base: number): EffectId[] {
  const bits = stompEnableBits(base);
  return EFFECT_IDS.filter((id) => bitOn(data, bits[id][0], bits[id][1]));
}

/** Decode stomp assignment from a merged current-preset dump. Short dumps yield empty lists. */
export function decodeStompsFromDump(data: Uint8Array, model: DeviceModel): StompAssignment {
  const bases = model === "gp50" ? GP50_STOMP_BASES : GP5_STOMP_BASES;
  const last = bases[bases.length - 1] + 3;
  if (data.length <= last) {
    return emptyStomps(model);
  }
  return bases.map((base) => decodeStompMask(data, base));
}

/**
 * App→pedal stomp-assignment SET (family `114d`). One effect bit per call.
 * Path `01 01 04`, CRC-8 ATM, nibble-expand. Bluetooth wrap is one GATT write.
 * `footswitch` is the wire index from {@link stompWireFootswitch}, not the UI column.
 */
export function encodeStompAssignmentSysex(
  footswitch: 0 | 1,
  effect: EffectId,
  assigned: boolean,
): Uint8Array | null {
  const effectIndex = DUMP_MODULE_IDS.indexOf(effect);
  if (effectIndex < 0 || (footswitch !== 0 && footswitch !== 1)) {
    return null;
  }
  const packed = Uint8Array.from([
    ...STOMP_ASSIGN_SET_PREFIX,
    footswitch,
    effectIndex,
    assigned ? 1 : 0,
  ]);
  return framePackedSet(packed);
}

export function dumpOrderIndices(chain: AudioChain): number[] | null {
  const effects = chain.filter((slot) => slot.id !== "exp");
  if (effects.length !== EFFECT_IDS.length) {
    return null;
  }
  const indices: number[] = [];
  const seen = new Set<number>();
  for (const slot of effects) {
    const index = DUMP_MODULE_IDS.indexOf(slot.id as EffectId);
    if (index < 0 || seen.has(index)) {
      return null;
    }
    seen.add(index);
    indices.push(index);
  }
  if (seen.size !== DUMP_MODULE_IDS.length) {
    return null;
  }
  return indices;
}

/**
 * App→pedal chain-order SET (accepted Bluetooth capture, PRE before NR).
 * Packed `01 00 0C 11 44` + ten `DUMP_MODULE_IDS` indices, CRC-8 ATM,
 * nibble-expand, `F0`…`F7`. Not the identity-family live notify.
 * Bluetooth wrap is one BLE-MIDI GATT write (`encodeLinkMidiPackets`).
 */
export function encodeChainOrderSysex(chain: AudioChain): Uint8Array | null {
  const indices = dumpOrderIndices(chain);
  if (!indices) {
    return null;
  }
  const packed = Uint8Array.from([...CHAIN_ORDER_SET_PREFIX, ...indices]);
  const framed = Uint8Array.from([crc8Atm(packed), ...packed]);
  const body = nibbleExpand(framed);
  const midi = new Uint8Array(2 + body.length);
  midi[0] = 0xf0;
  midi.set(body, 1);
  midi[midi.length - 1] = 0xf7;
  return midi;
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

function float32Le(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return bytes;
}

/**
 * App→pedal model write SET (family `1147`). Packed kind index + 4-byte wire identity.
 * Path `01 01 04`, CRC-8 ATM, nibble-expand. Bluetooth wrap is one GATT write.
 */
export function encodeSlotModelSysex(kind: EffectId, wire: WireIdentity): Uint8Array | null {
  const block = DUMP_MODULE_IDS.indexOf(kind);
  if (block < 0) {
    return null;
  }
  const packed = Uint8Array.from([
    ...MODEL_WRITE_SET_PREFIX,
    block,
    0x00,
    0x00,
    0x00,
    block,
    0x00,
    0x00,
    0x00,
    ...wire,
  ]);
  return framePackedSet(packed);
}

/**
 * App→pedal control write SET (family `1148`). Packed kind index + control index + float32 LE.
 * Path `01 01 04`, CRC-8 ATM, nibble-expand. Bluetooth wrap is one GATT write.
 */
export function encodeSlotControlSysex(
  kind: EffectId,
  index: number,
  value: number,
): Uint8Array | null {
  const block = DUMP_MODULE_IDS.indexOf(kind);
  if (block < 0 || index < 0 || index > 255 || !Number.isFinite(value)) {
    return null;
  }
  const packed = Uint8Array.from([
    ...CONTROL_WRITE_SET_PREFIX,
    block,
    0x00,
    0x00,
    0x00,
    index,
    0x00,
    0x00,
    0x00,
    ...float32Le(value),
  ]);
  return framePackedSet(packed);
}

function parseNibbleOrder(bytes: Uint8Array, start: number): EffectId[] | null {
  if (start + 19 >= bytes.length) {
    return null;
  }
  const order: EffectId[] = [];
  const seen = new Set<EffectId>();
  for (let slot = 0; slot < DUMP_MODULE_IDS.length; slot += 1) {
    const raw = nibble(bytes, start + slot * 2);
    if (raw < 0 || raw > 9) {
      return null;
    }
    const id = DUMP_MODULE_IDS[raw];
    if (seen.has(id)) {
      return null;
    }
    seen.add(id);
    order.push(id);
  }
  if (seen.size !== DUMP_MODULE_IDS.length) {
    return null;
  }
  return order;
}

/**
 * Live chain-order SysEx (Patone capture). Identity-family, size `0x0C`,
 * command `0x04`, path `01 02 04`, 34 bytes. Notify has size at byte 8.
 * Ten nibble-expanded `DUMP_MODULE_IDS` indices from byte 13. Returns null
 * for name dumps, current-patch identity, live-module `09`, EXP `02`,
 * Stomp mask `0E`, and the app→pedal SET (`01 01 04`).
 */
export function decodeLiveChainOrder(bytes: Uint8Array): EffectId[] | null {
  const midi = midiPayload(bytes);
  if (midi.length < 34 || midi[0] !== 0xf0) {
    return null;
  }
  if (isNameDump(midi) || isCurrentPatchIdentity(midi)) {
    return null;
  }
  if (decodeLiveExp(midi) !== null) {
    return null;
  }
  if (decodeLiveModule(midi) !== null) {
    return null;
  }
  if (decodeLiveStompMask(midi) !== null) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  const notify = midi[8] === CHAIN_ORDER_SIZE;
  const host = midi[2] === CHAIN_ORDER_SIZE && midi[8] === 0x02;
  if (!notify && !host) {
    return null;
  }
  if (midi[9] !== 1 || midi[10] !== 2 || midi[11] !== 4) {
    return null;
  }
  if (midi[12] !== CHAIN_ORDER_COMMAND) {
    return null;
  }
  return parseNibbleOrder(midi, 13);
}

type EnableBit = readonly [offset: number, bit: number];

type PresetLayout = {
  enable: Record<EffectId, EnableBit>;
  orderAt: number;
  identityAt: Record<EffectId, number>;
  valuesAt: Record<EffectId, number>;
};

const GP50_IDENTITY_AT: Record<EffectId, number> = {
  nr: 270,
  pre: 278,
  dst: 286,
  amp: 294,
  cab: 302,
  eq: 310,
  mod: 318,
  dly: 326,
  rvb: 334,
  ns: 342,
};

const GP50_VALUES_AT: Record<EffectId, number> = {
  nr: 358,
  pre: 422,
  dst: 486,
  amp: 550,
  cab: 614,
  eq: 678,
  mod: 742,
  dly: 806,
  rvb: 870,
  ns: 934,
};

const GP5_DUMP_SHIFT = 86;

const GP50_LAYOUT: PresetLayout = {
  enable: {
    nr: [227, 0],
    pre: [227, 1],
    dst: [227, 2],
    amp: [227, 3],
    cab: [226, 0],
    eq: [226, 1],
    mod: [226, 2],
    dly: [226, 3],
    rvb: [229, 0],
    ns: [229, 1],
  },
  orderAt: 243,
  identityAt: GP50_IDENTITY_AT,
  valuesAt: GP50_VALUES_AT,
};

const GP5_LAYOUT: PresetLayout = {
  enable: {
    nr: [141, 0],
    pre: [141, 1],
    dst: [141, 2],
    amp: [141, 3],
    cab: [140, 0],
    eq: [140, 1],
    mod: [140, 2],
    dly: [140, 3],
    rvb: [143, 0],
    ns: [143, 1],
  },
  orderAt: 157,
  identityAt: {
    nr: GP50_IDENTITY_AT.nr - GP5_DUMP_SHIFT,
    pre: GP50_IDENTITY_AT.pre - GP5_DUMP_SHIFT,
    dst: GP50_IDENTITY_AT.dst - GP5_DUMP_SHIFT,
    amp: GP50_IDENTITY_AT.amp - GP5_DUMP_SHIFT,
    cab: GP50_IDENTITY_AT.cab - GP5_DUMP_SHIFT,
    eq: GP50_IDENTITY_AT.eq - GP5_DUMP_SHIFT,
    mod: GP50_IDENTITY_AT.mod - GP5_DUMP_SHIFT,
    dly: GP50_IDENTITY_AT.dly - GP5_DUMP_SHIFT,
    rvb: GP50_IDENTITY_AT.rvb - GP5_DUMP_SHIFT,
    ns: GP50_IDENTITY_AT.ns - GP5_DUMP_SHIFT,
  },
  valuesAt: {
    nr: GP50_VALUES_AT.nr - GP5_DUMP_SHIFT,
    pre: GP50_VALUES_AT.pre - GP5_DUMP_SHIFT,
    dst: GP50_VALUES_AT.dst - GP5_DUMP_SHIFT,
    amp: GP50_VALUES_AT.amp - GP5_DUMP_SHIFT,
    cab: GP50_VALUES_AT.cab - GP5_DUMP_SHIFT,
    eq: GP50_VALUES_AT.eq - GP5_DUMP_SHIFT,
    mod: GP50_VALUES_AT.mod - GP5_DUMP_SHIFT,
    dly: GP50_VALUES_AT.dly - GP5_DUMP_SHIFT,
    rvb: GP50_VALUES_AT.rvb - GP5_DUMP_SHIFT,
    ns: GP50_VALUES_AT.ns - GP5_DUMP_SHIFT,
  },
};

type DumpClass = "gp5" | "gp50";

type DumpHeader = {
  dumpClass: DumpClass;
  indexAt: number;
  payloadAt: number;
  terminator: boolean;
};

function midiPayload(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0x80 &&
    bytes[1] === 0x80 &&
    bytes[2] === 0xf0
  ) {
    return bytes.subarray(2);
  }
  return bytes;
}

function nibble(bytes: Uint8Array, index: number): number {
  return bytes[index] * 16 + bytes[index + 1];
}

function sysexPayload(midi: Uint8Array, start: number): Uint8Array {
  const end = midi[midi.length - 1] === 0xf7 ? midi.length - 1 : midi.length;
  return midi.subarray(start, end);
}

function isNameDump(midi: Uint8Array): boolean {
  if (midi.length < 8) {
    return false;
  }
  if (midi[0] === 0xf0) {
    return (midi[3] === 6 && midi[4] === 10) || (midi[3] === 1 && midi[4] === 5);
  }
  return midi[5] === 1 && midi[6] === 5;
}

function isCurrentPatchIdentity(midi: Uint8Array): boolean {
  if (midi[0] !== 0xf0) {
    return false;
  }
  if (
    midi[3] === 0 &&
    midi[4] === 1 &&
    midi[9] === 1 &&
    midi[10] === 2 &&
    midi[11] === 4 &&
    midi[12] === 3 &&
    midi.length >= 16
  ) {
    return true;
  }
  if (midi.length === 20 && midi[5] === 0 && midi[6] === 1 && midi[14] === 3) {
    return true;
  }
  if (midi.length === 24 && midi[5] === 0 && midi[6] === 1 && midi[14] === 3) {
    return true;
  }
  if (midi.length === 22 && midi[3] === 0 && midi[4] === 1 && midi[12] === 11) {
    return true;
  }
  return false;
}

function commandAt(
  midi: Uint8Array,
  cmd0: number,
  cmd1: number,
): { indexAt: number; payloadAt: number } | null {
  if (midi[0] === 0xf0 && midi[3] === cmd0 && midi[4] === cmd1) {
    return { indexAt: 5, payloadAt: 9 };
  }
  if (
    midi[0] !== 0xf0 &&
    midi.length > 11 &&
    midi[5] === cmd0 &&
    midi[6] === cmd1
  ) {
    return { indexAt: 7, payloadAt: 11 };
  }
  return null;
}

function classifyDump(midi: Uint8Array): DumpHeader | null {
  const gp50Bt = commandAt(midi, 0, 6);
  if (gp50Bt) {
    const index = nibble(midi, gp50Bt.indexAt);
    const terminator = midi.length < 50 && index === 5;
    if (!terminator && midi.length < 200) {
      return null;
    }
    return {
      dumpClass: "gp50",
      ...gp50Bt,
      terminator,
    };
  }

  const gp5Bt = commandAt(midi, 0, 5);
  if (gp5Bt) {
    const index = nibble(midi, gp5Bt.indexAt);
    const terminator = midi.length >= 130 && midi.length < 200 && index === 4;
    if (!terminator && midi.length < 200) {
      return null;
    }
    return {
      dumpClass: "gp5",
      ...gp5Bt,
      terminator,
    };
  }

  const gp50Usb = commandAt(midi, 1, 11);
  if (gp50Usb && midi.length >= 40 && midi.length <= 52) {
    const index = nibble(midi, gp50Usb.indexAt);
    return {
      dumpClass: "gp50",
      ...gp50Usb,
      terminator: index === 26,
    };
  }

  const gp5Usb = commandAt(midi, 1, 9);
  if (gp5Usb && midi.length >= 30 && midi.length <= 52) {
    return {
      dumpClass: "gp5",
      ...gp5Usb,
      terminator: midi.length <= 36,
    };
  }

  return null;
}

export type LiveModuleChange = {
  id: EffectId;
  enabled: boolean;
};

export type LiveOnOffChange = {
  id: ChainSlotId;
  enabled: boolean;
};

/**
 * GP-50 Bluetooth EXP on/off (Patone capture). Identity-family template
 * (01 02 04), size 0x07, command 0x02. Enable is the last data byte (0 off, 1 on).
 * Distinct from live patch-volume (same size, different body signature).
 */
export function decodeLiveExp(bytes: Uint8Array): boolean | null {
  const midi = midiPayload(bytes);
  if (midi.length < 24 || midi[0] !== 0xf0) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  if (
    midi[8] !== 0x07 ||
    midi[9] !== 1 ||
    midi[10] !== 2 ||
    midi[11] !== 4 ||
    midi[12] !== 0x02
  ) {
    return null;
  }
  if (
    midi[13] !== 0 ||
    midi[14] !== 3 ||
    midi[15] !== 2 ||
    midi[16] !== 0 ||
    midi[17] !== 0 ||
    midi[18] !== 1
  ) {
    return null;
  }
  return midi[22] !== 0;
}

/**
 * Pedal→app live patch volume (Bluetooth). Identity-family, size `0x07`,
 * path `01 02 04`, body signature `02 00 01 02 00 00 01 00 00` then the volume
 * as a nibble pair (0–100). Same value encoding as preset_volume SETs; not a SET.
 * Locked from a GP-50 Bluetooth notify after CC 7 (volume 50 → `03 02`, 51 → `03 03`).
 */
export function decodeLivePatchVolume(bytes: Uint8Array): number | null {
  const midi = midiPayload(bytes);
  if (midi.length !== 24 || midi[0] !== 0xf0 || midi[23] !== 0xf7) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  if (
    midi[8] !== 0x07 ||
    midi[9] !== 1 ||
    midi[10] !== 2 ||
    midi[11] !== 4 ||
    midi[12] !== 0x02 ||
    midi[13] !== 0x00 ||
    midi[14] !== 0x01 ||
    midi[15] !== 0x02 ||
    midi[16] !== 0x00 ||
    midi[17] !== 0x00 ||
    midi[18] !== 0x01 ||
    midi[19] !== 0x00 ||
    midi[20] !== 0x00
  ) {
    return null;
  }
  if (midi[21] > 0x0f || midi[22] > 0x0f) {
    return null;
  }
  const volume = midi[21] * 16 + midi[22];
  if (volume < 0 || volume > 100) {
    return null;
  }
  return volume;
}

/**
 * Bluetooth live module on/off (Patone capture). Same identity-family
 * template (01 02 04), size 0x0A, command 0x09. Module id uses DUMP_MODULE_IDS
 * (0=NR … 3=AMP … 9=NS). Enable is byte 22 (0 off, 1 on).
 */
export function decodeLiveModule(bytes: Uint8Array): LiveModuleChange | null {
  const midi = midiPayload(bytes);
  if (midi.length < 23 || midi[0] !== 0xf0) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  if (
    midi[8] !== 0x0a ||
    midi[9] !== 1 ||
    midi[10] !== 2 ||
    midi[11] !== 4 ||
    midi[12] !== 0x09
  ) {
    return null;
  }
  const raw = midi[14];
  if (raw < 0 || raw > 9) {
    return null;
  }
  return { id: DUMP_MODULE_IDS[raw], enabled: midi[22] !== 0 };
}

/**
 * Bluetooth Stomp footswitch (Patone GP-50 capture). Identity-family
 * template (01 02 04), size 0x06, command 0x0E, 22 bytes. Two packed bytes
 * at offsets 13 and 15 are the current on/off mask for all ten effects:
 * low byte bit0=NR … bit7=DLY, high byte bit0=RVB bit1=NS. Extra high bits
 * (seen when NS turns off) are ignored. One press may flip several modules.
 * GP-5 has one stomp and GP-50 has two; both send this same status mask,
 * not a footswitch index. EXP is not in the mask: the pedal does not stomp EXP.
 */
export function decodeLiveStompMask(bytes: Uint8Array): LiveOnOffChange[] | null {
  const midi = midiPayload(bytes);
  if (midi.length !== 22 || midi[0] !== 0xf0) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 1) {
    return null;
  }
  if (
    midi[8] !== 0x06 ||
    midi[9] !== 1 ||
    midi[10] !== 2 ||
    midi[11] !== 4 ||
    midi[12] !== 0x0e
  ) {
    return null;
  }
  const low = nibble(midi, 13);
  const high = nibble(midi, 15);
  const changes: LiveOnOffChange[] = [];
  for (let bit = 0; bit < DUMP_MODULE_IDS.length; bit += 1) {
    const packed = bit < 8 ? low : high;
    const localBit = bit < 8 ? bit : bit - 8;
    changes.push({
      id: DUMP_MODULE_IDS[bit],
      enabled: (packed & (1 << localBit)) !== 0,
    });
  }
  return changes;
}

/**
 * Every module/EXP on/off carried by one live or Stomp notify.
 * Command 09 / 02 are one slot; command 0E is the ten-module stomp mask.
 */
export function decodeLiveOnOffChanges(bytes: Uint8Array): LiveOnOffChange[] {
  const expEnabled = decodeLiveExp(bytes);
  if (expEnabled !== null) {
    return [{ id: "exp", enabled: expEnabled }];
  }
  const fromSysex = decodeLiveModule(bytes);
  if (fromSysex) {
    return [fromSysex];
  }
  return decodeLiveStompMask(bytes) ?? [];
}

export type LiveSlotControlChange = {
  kind: EffectId;
  index: number;
  value: number;
};

export type LiveSlotModelChange = {
  kind: EffectId;
  wire: WireIdentity;
};

function isLiveNotify(midi: Uint8Array, size: number, command: number): boolean {
  return (
    midi[0] === 0xf0 &&
    midi[3] === 0 &&
    midi[4] === 1 &&
    midi[8] === size &&
    midi[9] === 1 &&
    midi[10] === 2 &&
    midi[11] === 4 &&
    midi[12] === command
  );
}

/**
 * Pedal→app live control (Bluetooth). Identity-family, size `0x0E`, command `08`,
 * path `01 02 04`. Kind at byte 14 (`DUMP_MODULE_IDS`), control index at 22,
 * float32 LE nibble-expanded in the eight bytes before `F7`. Not a SET.
 */
export function decodeLiveSlotControl(bytes: Uint8Array): LiveSlotControlChange | null {
  const midi = midiPayload(bytes);
  if (midi.length < 38 || midi[midi.length - 1] !== 0xf7) {
    return null;
  }
  if (!isLiveNotify(midi, 0x0e, 0x08)) {
    return null;
  }
  const raw = midi[14];
  if (raw < 0 || raw > 9) {
    return null;
  }
  const index = midi[22];
  if (index < 0 || index > 255) {
    return null;
  }
  const value = readFloat32Le(midi, midi.length - 9);
  if (value === null) {
    return null;
  }
  return { kind: DUMP_MODULE_IDS[raw], index, value };
}

/**
 * Pedal→app live model (Bluetooth). Identity-family, size `0x0A`, command `07`,
 * path `01 02 04`. Kind at byte 14, 4-byte wire identity nibble-expanded in the
 * eight bytes before `F7`. Not a SET (path `01 01 04` / family `1147`).
 */
export function decodeLiveSlotModel(bytes: Uint8Array): LiveSlotModelChange | null {
  const midi = midiPayload(bytes);
  if (midi.length < 30 || midi[midi.length - 1] !== 0xf7) {
    return null;
  }
  if (!isLiveNotify(midi, 0x0a, 0x07)) {
    return null;
  }
  const raw = midi[14];
  if (raw < 0 || raw > 9) {
    return null;
  }
  const wire = readWireIdentity(midi, midi.length - 9);
  if (!wire) {
    return null;
  }
  return { kind: DUMP_MODULE_IDS[raw], wire };
}

function bitOn(data: Uint8Array, offset: number, bit: number): boolean {
  if (offset >= data.length) {
    return false;
  }
  return (data[offset] & (1 << bit)) !== 0;
}

function readWireIdentity(data: Uint8Array, start: number): WireIdentity | null {
  if (start + 7 >= data.length) {
    return null;
  }
  const bytes: [number, number, number, number] = [0, 0, 0, 0];
  for (let index = 0; index < 4; index += 1) {
    const high = data[start + index * 2];
    const low = data[start + index * 2 + 1];
    if (high > 0x0f || low > 0x0f) {
      return null;
    }
    bytes[index] = ((high & 0x0f) << 4) | (low & 0x0f);
  }
  return bytes;
}

function readFloat32Le(data: Uint8Array, start: number): number | null {
  if (start + 7 >= data.length) {
    return null;
  }
  const packed = new Uint8Array(4);
  for (let index = 0; index < 4; index += 1) {
    const high = data[start + index * 2];
    const low = data[start + index * 2 + 1];
    packed[index] = (high << 4) | (low & 0x0f);
  }
  const value = new DataView(packed.buffer).getFloat32(0, true);
  return Number.isFinite(value) ? value : null;
}

function decodeSlotModel(
  data: Uint8Array,
  layout: PresetLayout,
  id: EffectId,
  pedal: DeviceModel,
): Pick<AudioChainSlot, "modelId" | "values"> {
  const wire = readWireIdentity(data, layout.identityAt[id]);
  let model = wire ? modelByWire(id, wire) : undefined;
  if (model && !model.devices.has(pedal)) {
    return {};
  }
  if (!model) {
    const sole = modelsForKind(id, pedal);
    // NR (GATE) has one factory model; the dump identity is unused in captures.
    if (sole.length !== 1) {
      return {};
    }
    model = sole[0];
  }
  const count = KIND_VALUE_COUNT[id];
  const raw: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = readFloat32Le(data, layout.valuesAt[id] + index * 8);
    if (value === null) {
      return {};
    }
    raw.push(value);
  }
  return { modelId: model.id, values: snapModelValues(model, raw) };
}

function parsePresetDump(
  data: Uint8Array,
  layout: PresetLayout,
  model: DeviceModel,
): AudioChain | null {
  const lastOrder = layout.orderAt + 18;
  if (data.length <= lastOrder) {
    return null;
  }

  const order: EffectId[] = [];
  const seen = new Set<EffectId>();
  for (let slot = 0; slot < 10; slot += 1) {
    const raw = data[layout.orderAt + slot * 2];
    if (raw < 0 || raw > 9) {
      return null;
    }
    const id = DUMP_MODULE_IDS[raw];
    if (seen.has(id)) {
      return null;
    }
    seen.add(id);
    order.push(id);
  }
  if (seen.size !== 10) {
    return null;
  }

  const slots: AudioChainSlot[] = order.map((id) => {
    const [offset, bit] = layout.enable[id];
    return {
      id,
      enabled: bitOn(data, offset, bit),
      ...decodeSlotModel(data, layout, id, model),
    };
  });

  if (model === "gp50") {
    slots.push({ id: "exp", enabled: false });
  }

  return slots;
}

/** Merged current-preset payload (same bytes ChainDecoder concatenates). */
export function decodePresetDump(
  data: Uint8Array,
  dumpClass: DumpClass,
  model: DeviceModel,
): AudioChain | null {
  return parsePresetDump(data, dumpClass === "gp50" ? GP50_LAYOUT : GP5_LAYOUT, model);
}

function writeNibbleBytes(data: Uint8Array, start: number, packed: Uint8Array): void {
  for (let index = 0; index < packed.length; index += 1) {
    data[start + index * 2] = (packed[index] >> 4) & 0x0f;
    data[start + index * 2 + 1] = packed[index] & 0x0f;
  }
}

function assertPresetDumpFixtures(): void {
  const tweedy = new Uint8Array(1024);
  for (let slot = 0; slot < DUMP_MODULE_IDS.length; slot += 1) {
    tweedy[GP50_LAYOUT.orderAt + slot * 2] = slot;
  }
  tweedy[227] = 1 << 3;
  // Stomp 1: PRE (1007 bit 1). Stomp 2: MOD+DLY (1006 bits → 1014 bits 2+3 = 0x0C).
  tweedy[1007] = 1 << 1;
  tweedy[1014] = (1 << 2) | (1 << 3);
  writeNibbleBytes(tweedy, GP50_IDENTITY_AT.amp, Uint8Array.from([0x01, 0x00, 0x00, 0x07]));
  writeNibbleBytes(tweedy, GP50_VALUES_AT.amp, float32Le(30));
  writeNibbleBytes(tweedy, GP50_IDENTITY_AT.nr, Uint8Array.from([0x12, 0x34, 0x56, 0x78]));
  writeNibbleBytes(tweedy, GP50_VALUES_AT.nr, float32Le(18));
  const loaded = parsePresetDump(tweedy, GP50_LAYOUT, "gp50");
  const amp = loaded?.find((slot) => slot.id === "amp");
  if (amp?.modelId !== "amp-tweedy" || amp.values?.[0] !== 30) {
    throw new Error("GP-50 Tweedy dump fixture did not fill AMP Gain 30");
  }
  const nr = loaded?.find((slot) => slot.id === "nr");
  if (nr?.modelId !== "nr-gate" || nr.values?.[0] !== 18) {
    throw new Error("GP-50 dump fixture did not fill sole NR GATE from THRE");
  }
  const gp50Stomps = decodeStompsFromDump(tweedy, "gp50");
  if (
    gp50Stomps.length !== 2 ||
    gp50Stomps[0].join(",") !== "pre" ||
    gp50Stomps[1].join(",") !== "mod,dly"
  ) {
    throw new Error("GP-50 dump fixture must decode PRE on stomp 1 and MOD+DLY on stomp 2");
  }
  if (loaded?.find((slot) => slot.id === "amp")?.enabled !== true) {
    throw new Error("GP-50 stomp decode must leave AMP enable intact");
  }

  const gp5Dump = new Uint8Array(940);
  for (let slot = 0; slot < DUMP_MODULE_IDS.length; slot += 1) {
    gp5Dump[GP5_LAYOUT.orderAt + slot * 2] = slot;
  }
  gp5Dump[141] = 1 << 3;
  // Single stomp: MOD+DLY at 920 bits 2+3.
  gp5Dump[920] = (1 << 2) | (1 << 3);
  const gp5Chain = parsePresetDump(gp5Dump, GP5_LAYOUT, "gp5");
  const gp5Stomps = decodeStompsFromDump(gp5Dump, "gp5");
  if (!gp5Chain || gp5Stomps.length !== 1 || gp5Stomps[0].join(",") !== "mod,dly") {
    throw new Error("GP-5 dump fixture must decode one stomp with MOD+DLY");
  }
  if (gp5Chain.find((slot) => slot.id === "amp")?.enabled !== true) {
    throw new Error("GP-5 stomp decode must leave AMP enable intact");
  }

  const shortDump = new Uint8Array(300);
  if (decodeStompsFromDump(shortDump, "gp50").join("|") !== "|") {
    throw new Error("Short GP-50 dump must yield two empty stomp lists");
  }

  const dstOn = encodeStompAssignmentSysex(1, "dst", true);
  const nsOff = encodeStompAssignmentSysex(0, "ns", false);
  if (!dstOn || !nsOff) {
    throw new Error("Stomp assignment SET must encode DST and NS");
  }
  if (stompWireFootswitch("gp50", 0) !== 1 || stompWireFootswitch("gp50", 1) !== 0) {
    throw new Error("GP-50 UI A must wire foot 1 and UI B must wire foot 0");
  }
  if (stompWireFootswitch("gp5", 0) !== 0) {
    throw new Error("GP-5 must wire foot 0");
  }
  // Packed: 01 00 05 11 4d foot effect val — UI A DST on → wire foot 1 effect 2
  const dstPacked = [0x01, 0x00, 0x05, 0x11, 0x4d, 0x01, 0x02, 0x01];
  const nsPacked = [0x01, 0x00, 0x05, 0x11, 0x4d, 0x00, 0x09, 0x00];
  const dstCrc = crc8Atm(Uint8Array.from(dstPacked));
  const nsCrc = crc8Atm(Uint8Array.from(nsPacked));
  const expectDst = nibbleExpand(Uint8Array.from([dstCrc, ...dstPacked]));
  const expectNs = nibbleExpand(Uint8Array.from([nsCrc, ...nsPacked]));
  if (
    dstOn[0] !== 0xf0 ||
    dstOn[dstOn.length - 1] !== 0xf7 ||
    !expectDst.every((byte, index) => dstOn[index + 1] === byte)
  ) {
    throw new Error("DST stomp SET must match family 114d wire foot 1 effect 2 on");
  }
  if (!expectNs.every((byte, index) => nsOff[index + 1] === byte)) {
    throw new Error("NS stomp SET must match family 114d wire foot 0 effect 9 off");
  }

  writeNibbleBytes(tweedy, GP50_IDENTITY_AT.cab, Uint8Array.from([0x02, 0x00, 0x10, 0x0a]));
  writeNibbleBytes(tweedy, GP50_VALUES_AT.cab, float32Le(50));
  const withUserIr = parsePresetDump(tweedy, GP50_LAYOUT, "gp50");
  const userCab = withUserIr?.find((slot) => slot.id === "cab");
  if (userCab?.modelId !== "cab-user-ir-03" || userCab.values?.[0] !== 50) {
    throw new Error("GP-50 user IR dump fixture did not fill CAB User IR 03 VOL 50");
  }

  const unknown = new Uint8Array(tweedy);
  writeNibbleBytes(unknown, GP50_IDENTITY_AT.amp, Uint8Array.from([0x99, 0x00, 0x00, 0x07]));
  const skipped = parsePresetDump(unknown, GP50_LAYOUT, "gp50");
  const unknownAmp = skipped?.find((slot) => slot.id === "amp");
  if (unknownAmp?.modelId !== undefined || unknownAmp?.values !== undefined) {
    throw new Error("Unknown AMP identity must stay unwritable");
  }

  const liveGain = new Uint8Array(38);
  liveGain[0] = 0xf0;
  liveGain[3] = 0;
  liveGain[4] = 1;
  liveGain[8] = 0x0e;
  liveGain[9] = 1;
  liveGain[10] = 2;
  liveGain[11] = 4;
  liveGain[12] = 0x08;
  liveGain[14] = DUMP_MODULE_IDS.indexOf("amp");
  liveGain[22] = 0;
  writeNibbleBytes(liveGain, 29, float32Le(45));
  liveGain[37] = 0xf7;
  const liveControl = decodeLiveSlotControl(liveGain);
  if (
    liveControl?.kind !== "amp" ||
    liveControl.index !== 0 ||
    Math.abs(liveControl.value - 45) > 0.01
  ) {
    throw new Error("Live AMP Gain notify fixture did not decode 45");
  }
  if (decodeLiveSlotControl(liveGain.slice(0, 20))) {
    throw new Error("Short SysEx must not decode as a live control");
  }

  const liveModel = new Uint8Array(30);
  liveModel[0] = 0xf0;
  liveModel[3] = 0;
  liveModel[4] = 1;
  liveModel[8] = 0x0a;
  liveModel[9] = 1;
  liveModel[10] = 2;
  liveModel[11] = 4;
  liveModel[12] = 0x07;
  liveModel[14] = DUMP_MODULE_IDS.indexOf("amp");
  writeNibbleBytes(liveModel, 21, Uint8Array.from([0x03, 0x00, 0x00, 0x07]));
  liveModel[29] = 0xf7;
  const liveAmp = decodeLiveSlotModel(liveModel);
  if (
    liveAmp?.kind !== "amp" ||
    liveAmp.wire[0] !== 0x03 ||
    liveAmp.wire[3] !== 0x07
  ) {
    throw new Error("Live AMP model notify fixture did not decode Bellman identity");
  }

  const liveCab = new Uint8Array(liveModel);
  liveCab[14] = DUMP_MODULE_IDS.indexOf("cab");
  writeNibbleBytes(liveCab, 21, Uint8Array.from([0x02, 0x00, 0x10, 0x0a]));
  const liveUserIr = decodeLiveSlotModel(liveCab);
  const resolved = liveUserIr ? modelByWire("cab", liveUserIr.wire) : undefined;
  if (liveUserIr?.kind !== "cab" || resolved?.id !== "cab-user-ir-03") {
    throw new Error("Live CAB user IR notify must decode User IR 03");
  }

  const liveVol50 = Uint8Array.from(
    "F0 00 06 00 01 00 00 00 07 01 02 04 02 00 01 02 00 00 01 00 00 03 02 F7"
      .split(" ")
      .map((byte) => Number.parseInt(byte, 16)),
  );
  const liveVol51 = Uint8Array.from(liveVol50);
  liveVol51[2] = 0x01;
  liveVol51[22] = 0x03;
  if (decodeLivePatchVolume(liveVol50) !== 50 || decodeLivePatchVolume(liveVol51) !== 51) {
    throw new Error("Live patch-volume notify must decode 50 and 51");
  }
  if (decodeLiveExp(liveVol50) !== null) {
    throw new Error("Live patch-volume notify must not decode as EXP");
  }
}

assertPresetDumpFixtures();

export type ChainDumpResult = {
  chain: AudioChain;
  stomps: StompAssignment;
  dump: Uint8Array;
};

export class ChainDecoder {
  private fragments = new Map<number, Uint8Array>();
  private dumpClass: DumpClass | null = null;

  reset(): void {
    this.fragments.clear();
    this.dumpClass = null;
  }

  private finish(model: DeviceModel): ChainDumpResult | null {
    if (!this.dumpClass) {
      return null;
    }
    const entries = [...this.fragments.entries()].sort((left, right) => left[0] - right[0]);
    if (entries.length === 0) {
      return null;
    }
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index][0] !== index) {
        return null;
      }
    }
    const parts = entries.map((entry) => entry[1]);
    const merged = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of parts) {
      merged.set(part, cursor);
      cursor += part.length;
    }
    const layout = this.dumpClass === "gp50" ? GP50_LAYOUT : GP5_LAYOUT;
    const chain = parsePresetDump(merged, layout, model);
    if (chain) {
      this.reset();
      return {
        chain,
        stomps: decodeStompsFromDump(merged, model),
        dump: merged,
      };
    }
    return null;
  }

  push(bytes: Uint8Array, model: DeviceModel): ChainDumpResult | null {
    const midi = midiPayload(bytes);
    if (midi.length < 8 || midi[0] !== 0xf0) {
      return null;
    }
    if (isNameDump(midi) || isCurrentPatchIdentity(midi) || isIrNameDump(midi) || isGlobalsDump(midi)) {
      return null;
    }

    const header = classifyDump(midi);
    if (!header) {
      return null;
    }

    if (this.dumpClass && this.dumpClass !== header.dumpClass) {
      this.reset();
    }
    this.dumpClass = header.dumpClass;
    this.fragments.set(nibble(midi, header.indexAt), sysexPayload(midi, header.payloadAt));
    if (!header.terminator) {
      return null;
    }
    return this.finish(model);
  }
}

function assertIrFragmentsSkipChainDecoder(): void {
  const chain = new ChainDecoder();
  for (const packet of encodeIrNameDump(["", "", "Greenback 412"])) {
    if (chain.push(packet, "gp50")) {
      throw new Error("IR-name fragments must not feed ChainDecoder");
    }
  }
}

assertIrFragmentsSkipChainDecoder();
