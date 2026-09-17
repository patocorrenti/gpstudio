import {
  EFFECT_IDS,
  type AudioChain,
  type AudioChainSlot,
} from "@/device/chain";
import type { DeviceModel } from "@/device/models";

/**
 * Current-preset / chain dump request (F0…F7). Same dump-class header as the
 * name-list identity request (size 0x0E), command 0x01. The short 0x07/0x01
 * frame only elicited a current-patch identity on GP-50 Bluetooth (Patone capture).
 * Bluetooth wrap is applied by encodeLinkMidi.
 */
const CURRENT_CHAIN_REQUEST = Uint8Array.from([
  0xf0, 0x00, 0x0e, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x04, 0x01,
  0xf7,
]);

export function encodeCurrentChainRequest(): Uint8Array {
  return CURRENT_CHAIN_REQUEST;
}

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
  if (midi.length < 8 || midi[0] !== 0xf0) {
    return false;
  }
  if (midi[3] === 6 && midi[4] === 10) {
    return true;
  }
  if (midi[3] === 1 && midi[4] === 5) {
    return true;
  }
  if (midi[5] === 1 && midi[6] === 5) {
    return true;
  }
  return false;
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

function unpackNibbles(bytes: Uint8Array): number[] {
  const values: number[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    values.push(nibble(bytes, index));
  }
  return values;
}

function asModuleIndex(value: number): number | null {
  if (Number.isInteger(value) && value >= 0 && value <= 9) {
    return value;
  }
  if (Number.isInteger(value) && value >= 1 && value <= 10) {
    return value - 1;
  }
  return null;
}

function permutationAt(values: number[], start: number): number[] | null {
  if (start + 10 > values.length) {
    return null;
  }
  const ids: number[] = [];
  const seen = new Set<number>();
  for (let offset = 0; offset < 10; offset += 1) {
    const id = asModuleIndex(values[start + offset]);
    if (id === null || seen.has(id)) {
      return null;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function asEnabled(value: number): boolean | null {
  if (value === 0 || value === 1) {
    return value === 1;
  }
  if (value >= 0 && value <= 127) {
    return value >= 64;
  }
  return null;
}

function readEnables(values: number[], start: number): boolean[] | null {
  if (start < 0 || start + 10 > values.length) {
    return null;
  }
  const enables: boolean[] = [];
  for (let offset = 0; offset < 10; offset += 1) {
    const enabled = asEnabled(values[start + offset]);
    if (enabled === null) {
      return null;
    }
    enables.push(enabled);
  }
  return enables;
}

function parseUnpacked(values: number[], model: DeviceModel): AudioChain | null {
  let order: number[] | null = null;
  let orderAt = -1;
  for (let start = 0; start <= values.length - 10; start += 1) {
    const candidate = permutationAt(values, start);
    if (candidate) {
      order = candidate;
      orderAt = start;
      break;
    }
  }
  if (!order) {
    return null;
  }

  const enablesBySlot =
    readEnables(values, orderAt + 10) ?? readEnables(values, orderAt - 10);
  const slots: AudioChainSlot[] = order.map((id, index) => ({
    id: EFFECT_IDS[id],
    enabled: enablesBySlot ? enablesBySlot[index] : false,
  }));

  if (model === "gp50") {
    const expSource = enablesBySlot ? values[orderAt + 20] : undefined;
    slots.push({
      id: "exp",
      enabled: expSource === undefined ? false : (asEnabled(expSource) ?? false),
    });
  }

  return slots;
}

function parsePayload(payload: Uint8Array, model: DeviceModel): AudioChain | null {
  return parseUnpacked(unpackNibbles(payload), model) ?? parseUnpacked([...payload], model);
}

export class ChainDecoder {
  private fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
  }

  private orderedPayloads(): Uint8Array[] {
    return [...this.fragments.entries()]
      .sort((left, right) => left[0] - right[0])
      .map((entry) => entry[1]);
  }

  private finish(model: DeviceModel): AudioChain | null {
    const parts = this.orderedPayloads();
    if (parts.length === 0) {
      return null;
    }
    const merged = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of parts) {
      merged.set(part, cursor);
      cursor += part.length;
    }
    const chain = parsePayload(merged, model);
    if (chain) {
      this.fragments.clear();
    }
    return chain;
  }

  private collect(
    midi: Uint8Array,
    indexAt: number,
    payloadAt: number,
    model: DeviceModel,
  ): AudioChain | null {
    this.fragments.set(nibble(midi, indexAt), sysexPayload(midi, payloadAt));
    return this.finish(model);
  }

  push(bytes: Uint8Array, model: DeviceModel): AudioChain | null {
    const midi = midiPayload(bytes);
    if (midi.length < 8 || midi[0] !== 0xf0) {
      return null;
    }
    if (isNameDump(midi) || isCurrentPatchIdentity(midi)) {
      return null;
    }

    if (midi[3] === 6) {
      return this.collect(midi, 5, 9, model);
    }
    if (midi[3] === 1 && midi[4] !== 0) {
      return this.collect(midi, 5, 9, model);
    }
    if (midi[5] === 1 && midi[6] !== 0) {
      return this.collect(midi, 7, 11, model);
    }

    return parsePayload(sysexPayload(midi, 1), model);
  }
}
