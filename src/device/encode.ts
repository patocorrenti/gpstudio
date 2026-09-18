import {
  encodeModuleCcValue,
  gp50Cc,
  gp5Cc,
  MODULE_CC,
} from "@/device/cc";
import type { AudioChain, ChainSlotId } from "@/device/chain";
import {
  encodeChainOrderSysex,
  encodeCurrentChainRequest,
} from "@/device/chain-codec";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import type { LinkMode } from "@/device/link";

function midiCc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
}

/**
 * MMA BLE-MIDI packet: header + timestamp + MIDI (timestamp 0).
 * SysEx longer than one GATT write is split into 20-byte packets.
 */
const BLE_MIDI_HEADER = 0x80;
const BLE_MIDI_TIMESTAMP = 0x80;
const BLE_MIDI_PACKET_MAX = 20;

function wrapBleMidi(midi: Uint8Array): Uint8Array {
  const packet = new Uint8Array(2 + midi.length);
  packet[0] = BLE_MIDI_HEADER;
  packet[1] = BLE_MIDI_TIMESTAMP;
  packet.set(midi, 2);
  return packet;
}

function wrapBleMidiPackets(midi: Uint8Array): Uint8Array[] {
  const room = BLE_MIDI_PACKET_MAX - 2;
  const packets: Uint8Array[] = [];
  let offset = 0;
  while (offset < midi.length) {
    const n = Math.min(room, midi.length - offset);
    const packet = new Uint8Array(2 + n);
    packet[0] = BLE_MIDI_HEADER;
    packet[1] = BLE_MIDI_TIMESTAMP;
    packet.set(midi.subarray(offset, offset + n), 2);
    packets.push(packet);
    offset += n;
  }
  return packets;
}

export function encodeLinkMidi(linkMode: LinkMode, midi: Uint8Array): Uint8Array {
  if (linkMode === "bluetooth") {
    return wrapBleMidi(midi);
  }
  return midi;
}

export function encodeLinkMidiPackets(linkMode: LinkMode, midi: Uint8Array): Uint8Array[] {
  if (linkMode === "bluetooth") {
    return wrapBleMidiPackets(midi);
  }
  return [midi];
}

export function encodePatch(linkMode: LinkMode, patch: number): Uint8Array {
  return encodeLinkMidi(linkMode, midiCc(gp5Cc.patch, patch));
}

export function encodeModule(
  linkMode: LinkMode,
  id: ChainSlotId,
  enabled: boolean,
): Uint8Array {
  if (id === "exp") {
    return encodeLinkMidi(linkMode, midiCc(gp50Cc.expOnOff, encodeModuleCcValue(enabled)));
  }
  return encodeLinkMidi(linkMode, midiCc(MODULE_CC[id], encodeModuleCcValue(enabled)));
}

export function encodeIdentity(linkMode: LinkMode, kind: IdentityRequestKind): Uint8Array {
  return encodeLinkMidi(linkMode, encodeIdentityRequest(kind));
}

export function encodeChainRequest(linkMode: LinkMode): Uint8Array {
  return encodeLinkMidi(linkMode, encodeCurrentChainRequest());
}

/** Parameter-write chain-order SET. Same MIDI body on USB and Bluetooth. */
export function encodeChainOrder(linkMode: LinkMode, chain: AudioChain): Uint8Array[] | null {
  const midi = encodeChainOrderSysex(chain);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}
