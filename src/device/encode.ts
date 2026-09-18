import {
  encodeModuleCcValue,
  gp50Cc,
  gp5Cc,
  MODULE_CC,
} from "@/device/cc";
import type { AudioChain, ChainSlotId, EffectId } from "@/device/chain";
import {
  encodeChainOrderSysex,
  encodeCurrentChainRequest,
  encodeSlotControlSysex,
  encodeSlotModelSysex,
} from "@/device/chain-codec";
import type { WireIdentity } from "@/device/catalog";
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

/** Parameter-write model SET (family `1147`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodeSlotModel(
  linkMode: LinkMode,
  kind: EffectId,
  wire: WireIdentity,
): Uint8Array[] | null {
  const midi = encodeSlotModelSysex(kind, wire);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** Parameter-write control SET (family `1148`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodeSlotControl(
  linkMode: LinkMode,
  kind: EffectId,
  index: number,
  value: number,
): Uint8Array[] | null {
  const midi = encodeSlotControlSysex(kind, index, value);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

function concatBlePackets(packets: Uint8Array[]): Uint8Array {
  const parts = packets.map((packet) => packet.subarray(2));
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function assertUsbBluetoothWrapOnly(): void {
  const usbModel = encodeSlotModel("usb", "amp", [0x01, 0x00, 0x00, 0x07]);
  const bleModel = encodeSlotModel("bluetooth", "amp", [0x01, 0x00, 0x00, 0x07]);
  const usbControl = encodeSlotControl("usb", "amp", 0, 45);
  const bleControl = encodeSlotControl("bluetooth", "amp", 0, 45);
  if (
    !usbModel ||
    !bleModel ||
    !usbControl ||
    !bleControl ||
    !sameBytes(usbModel[0], concatBlePackets(bleModel)) ||
    !sameBytes(usbControl[0], concatBlePackets(bleControl))
  ) {
    throw new Error("USB and Bluetooth slot writes must differ only by BLE-MIDI wrap");
  }
}

assertUsbBluetoothWrapOnly();
