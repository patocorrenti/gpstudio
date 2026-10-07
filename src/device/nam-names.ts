export const USER_NS_COUNT = 24;
/** Dump indices 0–55 are factory SnapTones; 56–79 are user slots. */
export const USER_NS_DUMP_ORIGIN = 56;
const DUMP_NAME_COUNT = 80;

/** First name in the concatenated Nam payload (nibble bytes). */
const NAM_NAME_ORIGIN = 164;
/**
 * Bytes between names. 32 nibbles is 16 ASCII characters.
 * The reference editor's shared helper only displays the first 10;
 * the record is the full stride so longer loaded names are kept.
 * NUL nibbles become space; trim; empty is null.
 */
const NAM_NAME_STRIDE = 32;

/**
 * Bluetooth Nam / SnapTone-name fragments, F0-aligned.
 * The reference editor sees 212 / 136 including the BLE-MIDI header.
 */
const BT_NAM_DATA_LENGTH = 210;
const BT_NAM_TERMINATOR_LENGTH = 134;
const BT_NAM_DATA_PAYLOAD = 200;
const BT_NAM_TERMINATOR_PAYLOAD = 124;
const BT_NAM_DATA_FRAGMENTS = 13;

/**
 * USB Nam fragments (GP-50 and GP-5 reference editors).
 * Complete SysEx, command `04 08`, length 48 data / 36 terminator.
 * Index nibbles at bytes 5–6. Payload from byte 9 (38 / 26 bytes).
 * Concatenated length 2724 matches the eighty-name table (origin 164, stride 32).
 * Last data+term index is `0x47` (71); terminator is also length 36.
 */
const USB_NAM_DATA_LENGTH = 48;
const USB_NAM_TERMINATOR_LENGTH = 36;
const USB_NAM_DATA_PAYLOAD = 38;
const USB_NAM_TERMINATOR_PAYLOAD = 26;
const USB_NAM_LAST_INDEX = 0x47;

/**
 * Identity-family Nam-name request (F0…F7). Same 14-byte envelope as IR-name,
 * with size `03 05` and path ending `04` (`F0 03 05 … 02 01 02 02 04 F7`).
 * Bluetooth wrap is encodeLinkMidi. Do not paste a reference 8080f0 string.
 */
const NAM_NAME_REQUEST = Uint8Array.from([
  0xf0, 0x03, 0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x02, 0x04, 0xf7,
]);

export function emptyUserNsNames(): (string | null)[] {
  return Array.from({ length: USER_NS_COUNT }, () => null);
}

export function encodeNamNameRequest(): Uint8Array {
  return NAM_NAME_REQUEST;
}

export function userNsDisplayName(
  model: { label: string; userNsSlot?: number },
  names: readonly (string | null)[] | undefined,
): string {
  if (model.userNsSlot === undefined) {
    return model.label;
  }
  const dumped = names?.[model.userNsSlot - 1]?.trim();
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

type NamHeader = {
  indexAt: number;
  payloadAt: number;
  terminator: boolean;
};

function namHeader(bytes: Uint8Array): NamHeader | null {
  const midi = midiPayload(bytes);
  if (midi.length < 12 || midi[0] !== 0xf0) {
    return null;
  }
  if (midi[3] === 0 && midi[4] === 0x0e) {
    const terminator = midi.length === BT_NAM_TERMINATOR_LENGTH;
    const data = midi.length === BT_NAM_DATA_LENGTH;
    if (!terminator && !data) {
      return null;
    }
    return { indexAt: 5, payloadAt: 9, terminator };
  }
  if (midi[3] === 4 && midi[4] === 8) {
    const terminator = midi.length === USB_NAM_TERMINATOR_LENGTH;
    const data = midi.length === USB_NAM_DATA_LENGTH;
    if (!terminator && !data) {
      return null;
    }
    return { indexAt: 5, payloadAt: 9, terminator };
  }
  return null;
}

/** True for a Bluetooth or USB Nam / SnapTone-name fragment. */
export function isNamNameDump(bytes: Uint8Array): boolean {
  return namHeader(bytes) !== null;
}

function sysexPayload(midi: Uint8Array, start: number): Uint8Array {
  const end = midi[midi.length - 1] === 0xf7 ? midi.length - 1 : midi.length;
  return midi.subarray(start, end);
}

function decodeNamName(bytes: Uint8Array, start: number): string | null {
  let name = "";
  for (let offset = 0; offset < NAM_NAME_STRIDE; offset += 2) {
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

function parseUserNsNames(payloads: Uint8Array[]): (string | null)[] | null {
  const merged = concatPayloads(payloads);
  const tableEnd = NAM_NAME_ORIGIN + DUMP_NAME_COUNT * NAM_NAME_STRIDE;
  if (merged.length < tableEnd) {
    return null;
  }
  const names = emptyUserNsNames();
  for (let index = 0; index < USER_NS_COUNT; index += 1) {
    const dumpIndex = USER_NS_DUMP_ORIGIN + index;
    names[index] = decodeNamName(merged, NAM_NAME_ORIGIN + dumpIndex * NAM_NAME_STRIDE);
  }
  return names;
}

export class NamNameDecoder {
  private fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
  }

  push(bytes: Uint8Array): (string | null)[] | null {
    const midi = midiPayload(bytes);
    const header = namHeader(midi);
    if (!header || midi[0] !== 0xf0) {
      return null;
    }
    this.fragments.set(nibble(midi, header.indexAt), sysexPayload(midi, header.payloadAt));
    if (!header.terminator) {
      return null;
    }
    const entries = [...this.fragments.entries()].sort((left, right) => left[0] - right[0]);
    this.fragments.clear();
    return parseUserNsNames(entries.map((entry) => entry[1]));
  }
}

function packAscii(text: string): Uint8Array {
  const nibbles = new Uint8Array(NAM_NAME_STRIDE);
  const chars = [...text].slice(0, NAM_NAME_STRIDE / 2);
  for (let index = 0; index < chars.length; index += 1) {
    const code = chars[index]?.charCodeAt(0) ?? 0;
    nibbles[index * 2] = (code >> 4) & 0x0f;
    nibbles[index * 2 + 1] = code & 0x0f;
  }
  return nibbles;
}

function frameBtNamFragment(index: number, payload: Uint8Array, terminator: boolean): Uint8Array {
  const length = terminator ? BT_NAM_TERMINATOR_LENGTH : BT_NAM_DATA_LENGTH;
  const midi = new Uint8Array(length);
  midi[0] = 0xf0;
  midi[3] = 0x00;
  midi[4] = 0x0e;
  midi[5] = (index >> 4) & 0x0f;
  midi[6] = index & 0x0f;
  midi.set(payload, 9);
  midi[length - 1] = 0xf7;
  return midi;
}

function frameUsbNamFragment(index: number, payload: Uint8Array, terminator: boolean): Uint8Array {
  const length = terminator ? USB_NAM_TERMINATOR_LENGTH : USB_NAM_DATA_LENGTH;
  const midi = new Uint8Array(length);
  midi[0] = 0xf0;
  midi[3] = 0x04;
  midi[4] = 0x08;
  midi[5] = (index >> 4) & 0x0f;
  midi[6] = index & 0x0f;
  midi.set(payload, 9);
  midi[length - 1] = 0xf7;
  return midi;
}

function packNamNameTable(names: readonly (string | null)[], length: number): Uint8Array {
  const merged = new Uint8Array(length);
  for (let index = 0; index < USER_NS_COUNT; index += 1) {
    const name = names[index];
    if (!name) {
      continue;
    }
    const dumpIndex = USER_NS_DUMP_ORIGIN + index;
    merged.set(packAscii(name), NAM_NAME_ORIGIN + dumpIndex * NAM_NAME_STRIDE);
  }
  return merged;
}

/** Indexed Nam-name fragments. User slot 1 is dump index 56. Default is the Bluetooth dump. */
export function encodeNamNameDump(
  names: readonly (string | null)[],
  link: "bluetooth" | "usb" = "bluetooth",
): Uint8Array[] {
  if (link === "usb") {
    const merged = packNamNameTable(
      names,
      USB_NAM_DATA_PAYLOAD * USB_NAM_LAST_INDEX + USB_NAM_TERMINATOR_PAYLOAD,
    );
    const packets: Uint8Array[] = [];
    for (let index = 0; index < USB_NAM_LAST_INDEX; index += 1) {
      const start = index * USB_NAM_DATA_PAYLOAD;
      packets.push(
        frameUsbNamFragment(index, merged.subarray(start, start + USB_NAM_DATA_PAYLOAD), false),
      );
    }
    const termStart = USB_NAM_LAST_INDEX * USB_NAM_DATA_PAYLOAD;
    packets.push(
      frameUsbNamFragment(
        USB_NAM_LAST_INDEX,
        merged.subarray(termStart, termStart + USB_NAM_TERMINATOR_PAYLOAD),
        true,
      ),
    );
    return packets;
  }
  const merged = packNamNameTable(
    names,
    BT_NAM_DATA_PAYLOAD * BT_NAM_DATA_FRAGMENTS + BT_NAM_TERMINATOR_PAYLOAD,
  );
  const payloads: Uint8Array[] = [];
  for (let index = 0; index < BT_NAM_DATA_FRAGMENTS; index += 1) {
    const start = index * BT_NAM_DATA_PAYLOAD;
    payloads.push(merged.subarray(start, start + BT_NAM_DATA_PAYLOAD));
  }
  payloads.push(merged.subarray(BT_NAM_DATA_PAYLOAD * BT_NAM_DATA_FRAGMENTS));
  return payloads.map((payload, index) =>
    frameBtNamFragment(index, payload, index === payloads.length - 1),
  );
}

function assertNamNameFixtures(): void {
  const names = emptyUserNsNames();
  names[2] = "My Amp";
  const decoder = new NamNameDecoder();
  const packets = encodeNamNameDump(names);
  let decoded: (string | null)[] | null = null;
  for (const packet of packets) {
    if (!isNamNameDump(packet)) {
      throw new Error("Nam-name fixture fragment was not classified");
    }
    decoded = decoder.push(packet);
  }
  if (decoded?.[2] !== "My Amp") {
    throw new Error("Nam-name fixture must yield My Amp at user SnapTone slot 03");
  }
  if (decoded[6] !== null) {
    throw new Error("A blank SnapTone slot must decode as null");
  }
  if (decoded.length !== USER_NS_COUNT) {
    throw new Error("Nam-name dump must carry twenty-four user slots");
  }
  const usbLookalike = new Uint8Array(48);
  usbLookalike[0] = 0xf0;
  usbLookalike[47] = 0xf7;
  if (isNamNameDump(usbLookalike)) {
    throw new Error("A 48-byte SysEx without command 04 08 must not classify as a Nam dump");
  }
  const irLookalike = new Uint8Array(BT_NAM_DATA_LENGTH);
  irLookalike[0] = 0xf0;
  irLookalike[3] = 0x00;
  irLookalike[4] = 0x04;
  irLookalike[BT_NAM_DATA_LENGTH - 1] = 0xf7;
  if (isNamNameDump(irLookalike)) {
    throw new Error("An IR-name Bluetooth fragment must not classify as a Nam dump");
  }
  const usbDecoder = new NamNameDecoder();
  let usbDecoded: (string | null)[] | null = null;
  for (const packet of encodeNamNameDump(names, "usb")) {
    if (!isNamNameDump(packet)) {
      throw new Error("USB Nam-name fixture fragment was not classified");
    }
    usbDecoded = usbDecoder.push(packet);
  }
  if (usbDecoded?.[2] !== "My Amp" || usbDecoded[6] !== null) {
    throw new Error("USB Nam-name fixture must yield My Amp at user SnapTone slot 03");
  }
  const shown = userNsDisplayName({ label: "SnapTone 03", userNsSlot: 3 }, decoded);
  if (shown !== "My Amp") {
    throw new Error("NS select must show the dumped SnapTone name");
  }
  const blank = userNsDisplayName({ label: "SnapTone 07", userNsSlot: 7 }, decoded);
  if (blank !== "SnapTone 07") {
    throw new Error("A blank SnapTone name must keep the SnapTone fallback");
  }
}

assertNamNameFixtures();
