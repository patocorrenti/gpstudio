import { encodeModuleCcValue, gp50Cc } from "@/device/cc";
import type { EffectId, StompAssignment } from "@/device/chain";
import { packStompLiveBytes, packStompMask } from "@/device/chain-codec";
import { encodeLinkMidi, encodeLinkMidiPackets } from "@/device/encode";
import type { LinkMode } from "@/device/link";
import type { DeviceModel } from "@/device/models";

/**
 * Temporary write-spike candidates. Not product protocol.
 * See openspec/changes/stomp-assignment/spike-assignment-write.md.
 */

export type StompWriteSpikeId =
  | "h7-param-0d"
  | "h1-exact"
  | "live-xor-cs"
  | "host-short-0d"
  | "host-size09-0d"
  | "host-04"
  | "host-0e"
  | "indexed-stomp"
  | "cc28-then-h1"
  | "offset-poke";

export type StompWriteSpike = {
  id: StompWriteSpikeId;
  title: string;
  hint: string;
  retired?: boolean;
};

export const STOMP_WRITE_SPIKES: readonly StompWriteSpike[] = [
  {
    id: "h7-param-0d",
    title: "H7 param 0D CRC-8",
    hint: "This round. One effect per click: CRC-8 then nibble-expand. Size 05, path 01 01 04, command 0D, stomp + effect + on/off. Try DST on Stomp 1.",
  },
  {
    id: "h1-exact",
    title: "H1 live 0D exact CS",
    hint: "Exact DST captures (checksum included). Use DST on/off.",
    retired: true,
  },
  {
    id: "live-xor-cs",
    title: "Live 0D XOR checksum",
    hint: "Same live envelope as the notify, checksum = XOR of bytes 3–28 as nibbles.",
    retired: true,
  },
  {
    id: "host-short-0d",
    title: "Host short 0D",
    hint: "Host marker 02, command 0D, 18 bytes: s1 then s2 live pairs.",
    retired: true,
  },
  {
    id: "host-size09-0d",
    title: "Host size 09 cmd 0D",
    hint: "Preset-class size 0x09, command 0D, 30-byte live map (not W3’s 0x0A).",
    retired: true,
  },
  {
    id: "host-04",
    title: "Host cmd 04",
    hint: "Host 30-byte live map, command 04 instead of 0D.",
    retired: true,
  },
  {
    id: "host-0e",
    title: "Host cmd 0E",
    hint: "Host 30-byte live map, command 0E (live mask class, not assignment notify).",
    retired: true,
  },
  {
    id: "indexed-stomp",
    title: "Host 0D + stomp index",
    hint: "Byte 13 = stomp index (0/1), byte 14–15 = that stomp only.",
    retired: true,
  },
  {
    id: "offset-poke",
    title: "Dump offset poke",
    hint: "Host size 09 cmd 02, nibble offset 1006/1014 (GP-5 920) + 4 dump mask bytes.",
    retired: true,
  },
  {
    id: "cc28-then-h1",
    title: "CC 28 Stomp + H1",
    hint: "May switch Patch/Stomp mode. Official CC 28 = 127, then the exact H1 DST frame. Try last.",
    retired: true,
  },
];

const LIVE_S1_DST_ON = hex(
  "F0 01 0D 00 01 00 00 00 0A 01 02 04 0D 00 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 F7",
);
const LIVE_S1_OFF = hex(
  "F0 05 01 00 01 00 00 00 0A 01 02 04 0D 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 F7",
);
const LIVE_S2_DST_ON = hex(
  "F0 00 09 00 01 00 00 00 0A 01 02 04 0D 00 00 00 00 00 00 00 00 00 04 00 00 00 00 00 00 F7",
);

const STOMP_OFFSET: Record<DeviceModel, readonly number[]> = {
  gp5: [920],
  gp50: [1006, 1014],
};

/** Parameter-write effect index (NS is 9, not dump order). */
const PARAM_EFFECT_INDEX: Record<EffectId, number> = {
  nr: 0,
  pre: 1,
  dst: 2,
  amp: 3,
  cab: 4,
  eq: 5,
  mod: 6,
  dly: 7,
  rvb: 8,
  ns: 9,
};

export type StompWriteSpikeInput = {
  linkMode: LinkMode;
  model: DeviceModel;
  stomps: StompAssignment;
  changedIndex: number;
  changedEffect?: EffectId;
  enabled?: boolean;
};

export function assignmentToggle(
  previous: readonly EffectId[],
  next: readonly EffectId[],
): { id: EffectId; enabled: boolean } | null {
  const added = next.find((id) => !previous.includes(id));
  if (added) {
    return { id: added, enabled: true };
  }
  const removed = previous.find((id) => !next.includes(id));
  if (removed) {
    return { id: removed, enabled: false };
  }
  return null;
}

export function encodeStompWriteSpike(
  id: StompWriteSpikeId,
  input: StompWriteSpikeInput,
): Uint8Array[] {
  const { linkMode, model, stomps, changedIndex, changedEffect, enabled } = input;
  switch (id) {
    case "h7-param-0d": {
      if (!changedEffect || enabled === undefined) {
        return [];
      }
      return encodeLinkMidiPackets(
        linkMode,
        encodeParamAssign(changedIndex, changedEffect, enabled),
      );
    }
    case "h1-exact":
      return encodeLinkMidiPackets(linkMode, exactOrLive(stomps));
    case "live-xor-cs":
      return encodeLinkMidiPackets(linkMode, liveXor(stomps));
    case "host-short-0d":
      return encodeLinkMidiPackets(linkMode, hostShort0d(stomps));
    case "host-size09-0d":
      return encodeLinkMidiPackets(linkMode, hostLive(0x09, 0x0d, stomps));
    case "host-04":
      return encodeLinkMidiPackets(linkMode, hostLive(0x0a, 0x04, stomps));
    case "host-0e":
      return encodeLinkMidiPackets(linkMode, hostLive(0x0a, 0x0e, stomps));
    case "indexed-stomp":
      return encodeLinkMidiPackets(linkMode, hostIndexed(stomps, changedIndex));
    case "offset-poke":
      return encodeLinkMidiPackets(
        linkMode,
        hostOffsetPoke(model, changedIndex, stomps[changedIndex] ?? []),
      );
    case "cc28-then-h1":
      return [
        encodeLinkMidi(linkMode, midiCc(gp50Cc.patchStompMode, encodeModuleCcValue(true))),
        ...encodeLinkMidiPackets(linkMode, exactOrLive(stomps)),
      ];
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function hex(text: string): Uint8Array {
  return Uint8Array.from(text.trim().split(/\s+/).map((byte) => Number.parseInt(byte, 16)));
}

/**
 * CRC-8 ATM / CCITT (poly 0x07, init 0). Standard; not a copied SysEx payload.
 */
function crc8Atm(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte & 0xff;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function nibbleExpand(packed: Uint8Array): Uint8Array {
  const midi = new Uint8Array(packed.length * 2);
  for (let index = 0; index < packed.length; index += 1) {
    const value = packed[index] ?? 0;
    midi[index * 2] = (value >> 4) & 0x0f;
    midi[index * 2 + 1] = value & 0x0f;
  }
  return midi;
}

/**
 * Per-effect assignment SET: size 0x05 (not live 0x0A), path 01 01 04,
 * command 0D, then stomp / effect / 0|1. CRC-8 of the packed body, then
 * nibble-expand onto the wire like inbound dumps.
 */
function encodeParamAssign(stomp: number, effect: EffectId, enabled: boolean): Uint8Array {
  const packed = Uint8Array.from([
    0x01,
    0x00,
    0x05,
    0x11,
    0x4d,
    stomp & 0x0f,
    PARAM_EFFECT_INDEX[effect] & 0x0f,
    enabled ? 1 : 0,
  ]);
  const crc = crc8Atm(packed);
  const body = nibbleExpand(packed);
  const midi = new Uint8Array(4 + body.length);
  midi[0] = 0xf0;
  midi[1] = (crc >> 4) & 0x0f;
  midi[2] = crc & 0x0f;
  midi.set(body, 3);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

function midiCc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
}

function dstOnly(ids: readonly EffectId[] | undefined): boolean {
  return Boolean(ids && ids.length === 1 && ids[0] === "dst");
}

function empty(ids: readonly EffectId[] | undefined): boolean {
  return !ids || ids.length === 0;
}

function exactOrLive(stomps: StompAssignment): Uint8Array {
  const first = stomps[0];
  const second = stomps[1];
  if (dstOnly(first) && empty(second)) {
    return LIVE_S1_DST_ON;
  }
  if (empty(first) && empty(second)) {
    return LIVE_S1_OFF;
  }
  if (empty(first) && dstOnly(second)) {
    return LIVE_S2_DST_ON;
  }
  return liveXor(stomps);
}

function liveFrame(stomps: StompAssignment): Uint8Array {
  const midi = new Uint8Array(30);
  midi[0] = 0xf0;
  midi[3] = 0x00;
  midi[4] = 0x01;
  midi[8] = 0x0a;
  midi[9] = 0x01;
  midi[10] = 0x02;
  midi[11] = 0x04;
  midi[12] = 0x0d;
  putLivePairs(midi, stomps);
  midi[29] = 0xf7;
  return midi;
}

function liveXor(stomps: StompAssignment): Uint8Array {
  const midi = liveFrame(stomps);
  let xor = 0;
  for (let index = 3; index < 29; index += 1) {
    xor ^= midi[index] ?? 0;
  }
  midi[1] = (xor >> 4) & 0x0f;
  midi[2] = xor & 0x0f;
  return midi;
}

function putLivePairs(midi: Uint8Array, stomps: StompAssignment): void {
  const first = packStompLiveBytes(stomps[0] ?? []);
  midi[14] = first.low;
  midi[15] = first.high;
  if (stomps.length > 1) {
    const second = packStompLiveBytes(stomps[1] ?? []);
    midi[22] = second.low;
    midi[23] = second.high;
  }
}

function hostHeader(midi: Uint8Array, size: number, command: number): void {
  midi[0] = 0xf0;
  midi[2] = size;
  midi[3] = 0x00;
  midi[4] = 0x01;
  midi[8] = 0x02;
  midi[9] = 0x01;
  midi[10] = 0x02;
  midi[11] = 0x04;
  midi[12] = command;
}

function hostLive(size: number, command: number, stomps: StompAssignment): Uint8Array {
  const midi = new Uint8Array(30);
  hostHeader(midi, size, command);
  putLivePairs(midi, stomps);
  midi[29] = 0xf7;
  return midi;
}

function hostShort0d(stomps: StompAssignment): Uint8Array {
  const midi = new Uint8Array(18);
  hostHeader(midi, 0x0a, 0x0d);
  const first = packStompLiveBytes(stomps[0] ?? []);
  const second = packStompLiveBytes(stomps[1] ?? []);
  midi[13] = first.low;
  midi[14] = first.high;
  midi[15] = second.low;
  midi[16] = second.high;
  midi[17] = 0xf7;
  return midi;
}

function hostIndexed(stomps: StompAssignment, changedIndex: number): Uint8Array {
  const midi = new Uint8Array(30);
  hostHeader(midi, 0x0a, 0x0d);
  const packed = packStompLiveBytes(stomps[changedIndex] ?? []);
  midi[13] = changedIndex & 0x0f;
  midi[14] = packed.low;
  midi[15] = packed.high;
  midi[29] = 0xf7;
  return midi;
}

function hostOffsetPoke(
  model: DeviceModel,
  changedIndex: number,
  ids: readonly EffectId[],
): Uint8Array {
  const offsets = STOMP_OFFSET[model];
  const offset = offsets[Math.min(changedIndex, offsets.length - 1)] ?? offsets[0];
  const mask = packStompMask(ids);
  const midi = new Uint8Array(22);
  hostHeader(midi, 0x09, 0x02);
  midi[13] = (offset >> 12) & 0x0f;
  midi[14] = (offset >> 8) & 0x0f;
  midi[15] = (offset >> 4) & 0x0f;
  midi[16] = offset & 0x0f;
  midi[17] = mask[0] ?? 0;
  midi[18] = mask[1] ?? 0;
  midi[19] = mask[2] ?? 0;
  midi[20] = mask[3] ?? 0;
  midi[21] = 0xf7;
  return midi;
}
