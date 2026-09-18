import type { AudioChain, AudioChainSlot, ChainSlotId, EffectId } from "@/device/chain";
import { EFFECT_IDS } from "@/device/chain";
import type { DeviceModel } from "@/device/models";
import { crc8Atm, nibbleExpand } from "@/device/sysex-nibble";

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
 * Bluetooth wrap is applied by encodeLinkMidiPackets.
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
};

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

function bitOn(data: Uint8Array, offset: number, bit: number): boolean {
  if (offset >= data.length) {
    return false;
  }
  return (data[offset] & (1 << bit)) !== 0;
}

function parsePresetDump(data: Uint8Array, layout: PresetLayout, model: DeviceModel): AudioChain | null {
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
    return { id, enabled: bitOn(data, offset, bit) };
  });

  if (model === "gp50") {
    slots.push({ id: "exp", enabled: false });
  }

  return slots;
}

export class ChainDecoder {
  private fragments = new Map<number, Uint8Array>();
  private dumpClass: DumpClass | null = null;

  reset(): void {
    this.fragments.clear();
    this.dumpClass = null;
  }

  private finish(model: DeviceModel): AudioChain | null {
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
    }
    return chain;
  }

  push(bytes: Uint8Array, model: DeviceModel): AudioChain | null {
    const midi = midiPayload(bytes);
    if (midi.length < 8 || midi[0] !== 0xf0) {
      return null;
    }
    if (isNameDump(midi) || isCurrentPatchIdentity(midi)) {
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
