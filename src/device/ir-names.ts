export const USER_IR_COUNT = 20;

/** First name in the concatenated IR-name payload (nibble bytes). */
const IR_NAME_ORIGIN = 44;
/**
 * Bytes between names. 32 nibbles is 16 ASCII characters.
 * The reference editor's shared helper only displays the first 10;
 * the record is the full stride so a name such as "Greenback 412" is kept.
 * NUL nibbles become space; trim; empty is null.
 */
const IR_NAME_STRIDE = 32;

/**
 * Bluetooth IR-name fragments, F0-aligned.
 * The reference editor sees 212 / 96 including the BLE-MIDI header.
 * USB command and length are not locked (no Patone USB log); those packets stay unrecognized.
 */
const BT_IR_DATA_LENGTH = 210;
const BT_IR_TERMINATOR_LENGTH = 94;
const BT_IR_DATA_PAYLOAD = 200;
const BT_IR_TERMINATOR_PAYLOAD = 84;

/**
 * Identity-family IR-name request (F0…F7). Same 14-byte envelope as name-list /
 * current-patch / current-preset, with a distinct size and path.
 * Name-list is size 0x0E command 0x00 path 01 02 04.
 * Current-patch is size 0x07 command 0x03. Current-preset is size 0x09 command 0x01.
 * This ask is F0 02 09 … path 02 01 02 02 command 0x00.
 * Bluetooth wrap is encodeLinkMidi. Do not paste a reference 8080f0 string.
 */
const IR_NAME_REQUEST = Uint8Array.from([
  0xf0, 0x02, 0x09, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x02, 0x00, 0xf7,
]);

export function emptyUserIrNames(): (string | null)[] {
  return Array.from({ length: USER_IR_COUNT }, () => null);
}

export function encodeIrNameRequest(): Uint8Array {
  return IR_NAME_REQUEST;
}

export function userIrDisplayName(
  model: { label: string; userIrSlot?: number },
  names: readonly (string | null)[] | undefined,
): string {
  if (model.userIrSlot === undefined) {
    return model.label;
  }
  const dumped = names?.[model.userIrSlot - 1]?.trim();
  return dumped ? dumped : model.label;
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

type IrHeader = {
  indexAt: number;
  payloadAt: number;
  terminator: boolean;
};

function irHeader(bytes: Uint8Array): IrHeader | null {
  const midi = midiPayload(bytes);
  if (midi.length < 12 || midi[0] !== 0xf0) {
    return null;
  }
  if (midi[3] !== 0 || midi[4] !== 4) {
    return null;
  }
  const terminator = midi.length === BT_IR_TERMINATOR_LENGTH;
  const data = midi.length === BT_IR_DATA_LENGTH;
  if (!terminator && !data) {
    return null;
  }
  return { indexAt: 5, payloadAt: 9, terminator };
}

/** True for a Bluetooth IR-name fragment. USB headers are not locked, so they return false. */
export function isIrNameDump(bytes: Uint8Array): boolean {
  return irHeader(bytes) !== null;
}

function sysexPayload(midi: Uint8Array, start: number): Uint8Array {
  const end = midi[midi.length - 1] === 0xf7 ? midi.length - 1 : midi.length;
  return midi.subarray(start, end);
}

function decodeIrName(bytes: Uint8Array, start: number): string | null {
  let name = "";
  for (let offset = 0; offset < IR_NAME_STRIDE; offset += 2) {
    if (start + offset + 1 >= bytes.length) {
      break;
    }
    let code = nibble(bytes, start + offset);
    if (code === 0) {
      code = 32;
    }
    name += String.fromCharCode(code);
  }
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function concatPayloads(payloads: Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(payloads.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of payloads) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return merged;
}

function parseIrNames(payloads: Uint8Array[]): (string | null)[] | null {
  const merged = concatPayloads(payloads);
  const tableEnd = IR_NAME_ORIGIN + USER_IR_COUNT * IR_NAME_STRIDE;
  if (merged.length < tableEnd) {
    return null;
  }
  const names = emptyUserIrNames();
  for (let index = 0; index < USER_IR_COUNT; index += 1) {
    names[index] = decodeIrName(merged, IR_NAME_ORIGIN + index * IR_NAME_STRIDE);
  }
  return names;
}

export class IrNameDecoder {
  private fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
  }

  push(bytes: Uint8Array): (string | null)[] | null {
    const midi = midiPayload(bytes);
    const header = irHeader(midi);
    if (!header || midi[0] !== 0xf0) {
      return null;
    }
    this.fragments.set(nibble(midi, header.indexAt), sysexPayload(midi, header.payloadAt));
    if (!header.terminator) {
      return null;
    }
    const entries = [...this.fragments.entries()].sort((left, right) => left[0] - right[0]);
    this.fragments.clear();
    const names = parseIrNames(entries.map((entry) => entry[1]));
    return names;
  }
}

function packAscii(text: string): Uint8Array {
  const nibbles = new Uint8Array(IR_NAME_STRIDE);
  const chars = [...text].slice(0, IR_NAME_STRIDE / 2);
  for (let index = 0; index < chars.length; index += 1) {
    const code = chars[index]?.charCodeAt(0) ?? 0;
    nibbles[index * 2] = (code >> 4) & 0x0f;
    nibbles[index * 2 + 1] = code & 0x0f;
  }
  return nibbles;
}

function frameIrFragment(index: number, payload: Uint8Array, terminator: boolean): Uint8Array {
  const length = terminator ? BT_IR_TERMINATOR_LENGTH : BT_IR_DATA_LENGTH;
  const midi = new Uint8Array(length);
  midi[0] = 0xf0;
  midi[3] = 0x00;
  midi[4] = 0x04;
  midi[5] = (index >> 4) & 0x0f;
  midi[6] = index & 0x0f;
  midi.set(payload, 9);
  midi[length - 1] = 0xf7;
  return midi;
}

/** Indexed Bluetooth IR-name fragments. Slot 1 is index 0. */
export function encodeIrNameDump(names: readonly (string | null)[]): Uint8Array[] {
  const merged = new Uint8Array(BT_IR_DATA_PAYLOAD * 3 + BT_IR_TERMINATOR_PAYLOAD);
  for (let index = 0; index < USER_IR_COUNT; index += 1) {
    const name = names[index];
    if (!name) {
      continue;
    }
    merged.set(packAscii(name), IR_NAME_ORIGIN + index * IR_NAME_STRIDE);
  }
  const payloads = [
    merged.subarray(0, BT_IR_DATA_PAYLOAD),
    merged.subarray(BT_IR_DATA_PAYLOAD, BT_IR_DATA_PAYLOAD * 2),
    merged.subarray(BT_IR_DATA_PAYLOAD * 2, BT_IR_DATA_PAYLOAD * 3),
    merged.subarray(BT_IR_DATA_PAYLOAD * 3),
  ];
  return payloads.map((payload, index) =>
    frameIrFragment(index, payload, index === payloads.length - 1),
  );
}

function assertIrNameFixtures(): void {
  const names = emptyUserIrNames();
  names[2] = "Greenback 412";
  const decoder = new IrNameDecoder();
  const packets = encodeIrNameDump(names);
  let decoded: (string | null)[] | null = null;
  for (const packet of packets) {
    if (!isIrNameDump(packet)) {
      throw new Error("IR-name fixture fragment was not classified");
    }
    decoded = decoder.push(packet);
  }
  if (decoded?.[2] !== "Greenback 412") {
    throw new Error("IR-name fixture must yield Greenback 412 at slot 03");
  }
  if (decoded[6] !== null) {
    throw new Error("A blank IR slot must decode as null");
  }
  if (decoded.length !== USER_IR_COUNT) {
    throw new Error("IR-name dump must carry twenty slots");
  }
  const usbLookalike = new Uint8Array(48);
  usbLookalike[0] = 0xf0;
  usbLookalike[47] = 0xf7;
  if (isIrNameDump(usbLookalike)) {
    throw new Error("Unlocked USB headers must not classify as an IR-name dump");
  }
  const shown = userIrDisplayName(
    { label: "User IR 03", userIrSlot: 3 },
    decoded,
  );
  if (shown !== "Greenback 412") {
    throw new Error("CAB select must show the dumped IR name");
  }
  const blank = userIrDisplayName(
    { label: "User IR 07", userIrSlot: 7 },
    decoded,
  );
  if (blank !== "User IR 07") {
    throw new Error("A blank IR name must keep the User IR fallback");
  }
}

assertIrNameFixtures();
