import type { AudioChain, AudioChainSlot, EffectId } from "@/device/chain";
import type { DeviceModel } from "@/device/models";

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
const DUMP_MODULE_IDS = [
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
