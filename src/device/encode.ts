import { gp5Cc } from "@/device/cc";
import { encodeCurrentChainRequest } from "@/device/chain-codec";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import type { LinkMode } from "@/device/link";

function midiCc0(patch: number): Uint8Array {
  return new Uint8Array([0xb0, gp5Cc.patch, patch]);
}

/**
 * MMA BLE-MIDI packet: header + timestamp + MIDI message (timestamp 0).
 * Used because Patone listed the BLE-MIDI I/O characteristic on this pedal.
 */
function wrapBleMidi(midi: Uint8Array): Uint8Array {
  const packet = new Uint8Array(2 + midi.length);
  packet[0] = 0x80;
  packet[1] = 0x80;
  packet.set(midi, 2);
  return packet;
}

export function encodeLinkMidi(linkMode: LinkMode, midi: Uint8Array): Uint8Array {
  if (linkMode === "bluetooth") {
    return wrapBleMidi(midi);
  }
  return midi;
}

export function encodePatch(linkMode: LinkMode, patch: number): Uint8Array {
  return encodeLinkMidi(linkMode, midiCc0(patch));
}

export function encodeIdentity(linkMode: LinkMode, kind: IdentityRequestKind): Uint8Array {
  return encodeLinkMidi(linkMode, encodeIdentityRequest(kind));
}

export function encodeChainRequest(linkMode: LinkMode): Uint8Array {
  return encodeLinkMidi(linkMode, encodeCurrentChainRequest());
}
