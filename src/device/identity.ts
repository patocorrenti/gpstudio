import { decodeLiveChainOrder, decodeLiveOnOffChanges } from "@/device/chain-codec";

export const PATCH_COUNT = 100;

export type IdentityRequestKind = "name-list" | "current-patch";

export type IdentityEvent =
  | { type: "name-list"; names: (string | null)[] }
  | { type: "current-patch"; patch: number }
  | { type: "patch-changed" };

export function emptyPatchNames(): (string | null)[] {
  return Array.from({ length: PATCH_COUNT }, () => null);
}

export function formatPatch(patch: number): string {
  const index = ((patch % PATCH_COUNT) + PATCH_COUNT) % PATCH_COUNT;
  return String(index).padStart(2, "0");
}

export function formatPatchOption(patch: number, name: string | null): string {
  const id = formatPatch(patch);
  if (!name) {
    return id;
  }
  return `${id} | ${name}`;
}

/**
 * MIDI SysEx identity requests (F0…F7). Bluetooth wrap is applied by encodeLinkMidi.
 * Same body on USB and Bluetooth.
 */
const NAME_LIST_REQUEST = Uint8Array.from([
  0xf0, 0x00, 0x0e, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x04, 0x00,
  0xf7,
]);

const CURRENT_PATCH_REQUEST = Uint8Array.from([
  0xf0, 0x00, 0x07, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x01, 0x02, 0x04, 0x03,
  0xf7,
]);

export function encodeIdentityRequest(kind: IdentityRequestKind): Uint8Array {
  return kind === "name-list" ? NAME_LIST_REQUEST : CURRENT_PATCH_REQUEST;
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

function decodePackedName(bytes: Uint8Array, start: number): string {
  let name = "";
  for (let offset = 0; offset < 20; offset += 2) {
    if (start + offset + 1 >= bytes.length) {
      break;
    }
    let code = nibble(bytes, start + offset);
    if (code === 0) {
      code = 32;
    }
    name += String.fromCharCode(code);
  }
  return name.trimEnd();
}

function parseNameList(payloads: Uint8Array[]): (string | null)[] | null {
  const merged = new Uint8Array(payloads.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of payloads) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  const names = emptyPatchNames();
  let start = 12;
  for (let index = 0; index < PATCH_COUNT; index += 1) {
    if (start + 19 >= merged.length) {
      return null;
    }
    names[index] = decodePackedName(merged, start);
    start += 40;
  }
  return names;
}

function sysexPayload(midi: Uint8Array, start: number): Uint8Array {
  const end = midi[midi.length - 1] === 0xf7 ? midi.length - 1 : midi.length;
  return midi.subarray(start, end);
}

export class IdentityDecoder {
  private fragments = new Map<number, Uint8Array>();

  reset(): void {
    this.fragments.clear();
  }

  private orderedPayloads(): Uint8Array[] {
    return [...this.fragments.entries()]
      .sort((left, right) => left[0] - right[0])
      .map((entry) => entry[1]);
  }

  private finishNames(): IdentityEvent | null {
    const names = parseNameList(this.orderedPayloads());
    if (!names) {
      return null;
    }
    this.fragments.clear();
    return { type: "name-list", names };
  }

  private collectNameDump(
    midi: Uint8Array,
    indexAt: number,
    payloadAt: number,
  ): IdentityEvent | null {
    this.fragments.set(nibble(midi, indexAt), sysexPayload(midi, payloadAt));
    return this.finishNames();
  }

  push(bytes: Uint8Array): IdentityEvent | null {
    const midi = midiPayload(bytes);
    if (midi.length < 8 || midi[0] !== 0xf0) {
      return null;
    }

    // Live-module (09), EXP (02), Stomp mask (0E), and live chain-order share
    // the identity-family header. They are chain state, never a patch change.
    if (decodeLiveOnOffChanges(midi).length > 0) {
      return null;
    }
    if (decodeLiveChainOrder(midi)) {
      return null;
    }

    // USB Web MIDI: 48-byte fragments, 24-byte terminator, command 06 0A.
    if (midi[3] === 6 && midi[4] === 10) {
      return this.collectNameDump(midi, 5, 9);
    }

    // Bluetooth after BLE-MIDI unwrap: GATT dumps are ~210-byte SysEx
    // with command 01 05 (raw packet has those bytes two later).
    if (midi[3] === 1 && midi[4] === 5) {
      return this.collectNameDump(midi, 5, 9);
    }

    // Raw BLE-MIDI packet (header + timestamp still present).
    // USB SysEx starts at F0; bytes 5–6 are a fragment index, not this command.
    if (midi[0] !== 0xf0 && midi[5] === 1 && midi[6] === 5) {
      return this.collectNameDump(midi, 7, 11);
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
      return { type: "current-patch", patch: nibble(midi, 13) };
    }

    if (
      midi[5] === 0 &&
      midi[6] === 1 &&
      midi[10] === 4 &&
      midi[11] === 1 &&
      midi[12] === 2 &&
      midi[13] === 4 &&
      midi[14] === 3 &&
      midi.length === 20
    ) {
      return { type: "current-patch", patch: nibble(midi, 15) };
    }

    if (
      midi[3] === 0 &&
      midi[4] === 1 &&
      midi[9] === 1 &&
      midi[10] === 2 &&
      midi[11] === 1 &&
      midi[12] === 11 &&
      midi.length === 22
    ) {
      return { type: "patch-changed" };
    }

    if (
      midi[5] === 0 &&
      midi[6] === 1 &&
      midi[11] === 1 &&
      midi[12] === 2 &&
      midi[13] === 4 &&
      midi[14] === 3 &&
      midi.length === 24
    ) {
      return { type: "current-patch", patch: nibble(midi, 15) };
    }

    return null;
  }
}

export class SysexAssembler {
  private pending: number[] | null = null;

  reset(): void {
    this.pending = null;
  }

  push(bytes: Uint8Array): Uint8Array[] {
    if (bytes.length === 0) {
      return [];
    }
    if (this.pending) {
      this.pending.push(...bytes);
      if (this.pending[this.pending.length - 1] === 0xf7) {
        const complete = Uint8Array.from(this.pending);
        this.pending = null;
        return [complete];
      }
      return [];
    }
    // Hold only tiny USB splits. Bluetooth name dumps are long SysEx chunks
    // without a per-fragment F7; concatenating them hides the dump headers.
    if (bytes[0] === 0xf0 && bytes[bytes.length - 1] !== 0xf7 && bytes.length < 8) {
      this.pending = [...bytes];
      return [];
    }
    return [bytes];
  }
}
