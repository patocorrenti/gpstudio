import {
  encodeModuleCcValue,
  gp50Cc,
  gp5Cc,
  MODULE_CC,
} from "@/device/cc";
import type { ChainSlotId, StompAssignment } from "@/device/chain";
import { encodeCurrentChainRequest } from "@/device/chain-codec";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import type { LinkMode } from "@/device/link";

function midiCc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
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
 * Assignment write SysEx. Packed dump masks are known; the outbound
 * command is filled in from a Patone write capture. Null until then so a
 * missing dump never invents a write.
 */
export function encodeStompAssignment(
  _linkMode: LinkMode,
  _stomps: StompAssignment,
): Uint8Array | null {
  return null;
}
