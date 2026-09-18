import {
  encodeModuleCcValue,
  gp50Cc,
  gp5Cc,
  MODULE_CC,
} from "@/device/cc";
import type { ChainSlotId, StompAssignment } from "@/device/chain";
import { encodeCurrentChainRequest, packStompLiveBytes } from "@/device/chain-codec";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import type { LinkMode } from "@/device/link";

function midiCc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
}

/**
 * Conservative BLE-MIDI packet size: default ATT MTU 23 leaves 20 bytes of PDU.
 * Header + timestamp take 2, so a long SysEx must span packets.
 */
const BLE_MIDI_PACKET = 20;

/**
 * MMA BLE-MIDI packet: header + timestamp + MIDI (timestamp 0).
 * Long SysEx is split so each GATT write fits a default MTU.
 */
function wrapBleMidiPackets(midi: Uint8Array): Uint8Array[] {
  const packets: Uint8Array[] = [];
  const chunk = BLE_MIDI_PACKET - 2;
  for (let offset = 0; offset < midi.length; offset += chunk) {
    const slice = midi.subarray(offset, offset + chunk);
    const packet = new Uint8Array(2 + slice.length);
    packet[0] = 0x80;
    packet[1] = 0x80;
    packet.set(slice, 2);
    packets.push(packet);
  }
  return packets;
}

export function encodeLinkMidi(linkMode: LinkMode, midi: Uint8Array): Uint8Array {
  if (linkMode === "bluetooth") {
    const packets = wrapBleMidiPackets(midi);
    if (packets.length !== 1) {
      throw new Error("SysEx is too long for a single BLE-MIDI packet.");
    }
    return packets[0];
  }
  return midi;
}

export function encodeLinkMidiPackets(
  linkMode: LinkMode,
  midi: Uint8Array,
): Uint8Array[] {
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

/**
 * Last failed SET candidate (W3 in spike-assignment-write.md): host envelope,
 * command 0x0D, live payload map. Pedal ignored this on USB and Bluetooth.
 * Replace only after the spike accepts a candidate. Do not retry W1/W2 as-is.
 */
const ASSIGN_COMMAND = 0x0d;

export function encodeStompAssignment(
  linkMode: LinkMode,
  stomps: StompAssignment,
): Uint8Array[] {
  const midi = new Uint8Array(30);
  midi[0] = 0xf0;
  midi[2] = 0x0a;
  midi[3] = 0x00;
  midi[4] = 0x01;
  midi[8] = 0x02;
  midi[9] = 0x01;
  midi[10] = 0x02;
  midi[11] = 0x04;
  midi[12] = ASSIGN_COMMAND;
  const first = packStompLiveBytes(stomps[0] ?? []);
  midi[14] = first.low;
  midi[15] = first.high;
  if (stomps.length > 1) {
    const second = packStompLiveBytes(stomps[1] ?? []);
    midi[22] = second.low;
    midi[23] = second.high;
  }
  midi[29] = 0xf7;
  return encodeLinkMidiPackets(linkMode, midi);
}
