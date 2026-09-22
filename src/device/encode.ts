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
import { encodePatchStoreSysex, encodePatchVolumeSysex, encodePatchBpmSysex } from "@/device/patch-store";
import type { WireIdentity } from "@/device/catalog";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import { encodeIrNameRequest } from "@/device/ir-names";
import type { LinkMode } from "@/device/link";

function midiCc(controller: number, value: number): Uint8Array {
  return new Uint8Array([0xb0, controller, value]);
}

/**
 * MMA BLE-MIDI packet: header + timestamp + MIDI (timestamp 0).
 *
 * Host SET SysEx stays one GATT write (`80 80` + F0…F7), matching the accepted
 * chain-order capture and the GP-50 Bluetooth reference editor. A 38-byte
 * model/control SysEx split into 20-byte packets is ignored on the pedal.
 */
const BLE_MIDI_HEADER = 0x80;
const BLE_MIDI_TIMESTAMP = 0x80;

function wrapBleMidi(midi: Uint8Array): Uint8Array {
  const packet = new Uint8Array(2 + midi.length);
  packet[0] = BLE_MIDI_HEADER;
  packet[1] = BLE_MIDI_TIMESTAMP;
  packet.set(midi, 2);
  return packet;
}

export function encodeLinkMidi(linkMode: LinkMode, midi: Uint8Array): Uint8Array {
  if (linkMode === "bluetooth") {
    return wrapBleMidi(midi);
  }
  return midi;
}

export function encodeLinkMidiPackets(linkMode: LinkMode, midi: Uint8Array): Uint8Array[] {
  return [encodeLinkMidi(linkMode, midi)];
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

/** IR-name dump request. USB vs Bluetooth differ only by the BLE-MIDI wrap. */
export function encodeIrNames(linkMode: LinkMode): Uint8Array {
  return encodeLinkMidi(linkMode, encodeIrNameRequest());
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

/** Parameter-write store SET (family `114a`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodePatchStore(
  linkMode: LinkMode,
  slot: number,
  name: string,
): Uint8Array[] | null {
  const midi = encodePatchStoreSysex(slot, name);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** Parameter-write patch volume SET (family `1142`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodePatchVolume(linkMode: LinkMode, volume: number): Uint8Array[] | null {
  const midi = encodePatchVolumeSysex(volume);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** Parameter-write patch BPM SET (family `1142`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodePatchBpm(linkMode: LinkMode, bpm: number): Uint8Array[] | null {
  const midi = encodePatchBpmSysex(bpm);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
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

function unwrapBlePacket(packet: Uint8Array): Uint8Array | null {
  if (
    packet.length < 3 ||
    packet[0] !== BLE_MIDI_HEADER ||
    packet[1] !== BLE_MIDI_TIMESTAMP
  ) {
    return null;
  }
  return packet.subarray(2);
}

function assertUsbBluetoothWrapOnly(): void {
  const usbModel = encodeSlotModel("usb", "amp", [0x01, 0x00, 0x00, 0x07]);
  const bleModel = encodeSlotModel("bluetooth", "amp", [0x01, 0x00, 0x00, 0x07]);
  const usbControl = encodeSlotControl("usb", "amp", 0, 45);
  const bleControl = encodeSlotControl("bluetooth", "amp", 0, 45);
  const usbStore = encodePatchStore("usb", 5, "Flow");
  const bleStore = encodePatchStore("bluetooth", 5, "Flow");
  const usbVol = encodePatchVolume("usb", 50);
  const bleVol = encodePatchVolume("bluetooth", 50);
  const usbIr = encodeIrNames("usb");
  const bleIr = encodeIrNames("bluetooth");
  const bleModelMidi = bleModel && bleModel.length === 1 ? unwrapBlePacket(bleModel[0]) : null;
  const bleControlMidi =
    bleControl && bleControl.length === 1 ? unwrapBlePacket(bleControl[0]) : null;
  const bleStoreMidi = bleStore && bleStore.length === 1 ? unwrapBlePacket(bleStore[0]) : null;
  const bleVolMidi = bleVol && bleVol.length === 1 ? unwrapBlePacket(bleVol[0]) : null;
  const bleIrMidi = unwrapBlePacket(bleIr);
  const nameList = encodeIdentity("usb", "name-list");
  const currentPatch = encodeIdentity("usb", "current-patch");
  const currentPreset = encodeChainRequest("usb");
  if (
    !usbModel ||
    !bleModel ||
    !usbControl ||
    !bleControl ||
    !usbStore ||
    !bleStore ||
    !usbVol ||
    !bleVol ||
    !bleModelMidi ||
    !bleControlMidi ||
    !bleStoreMidi ||
    !bleVolMidi ||
    !sameBytes(usbModel[0], bleModelMidi) ||
    !sameBytes(usbControl[0], bleControlMidi) ||
    !sameBytes(usbStore[0], bleStoreMidi) ||
    !sameBytes(usbVol[0], bleVolMidi)
  ) {
    throw new Error("USB and Bluetooth slot writes must differ only by one BLE-MIDI wrap");
  }
  const factoryCab = encodeSlotModel("usb", "cab", [0x01, 0x00, 0x00, 0x0a]);
  const userCab = encodeSlotModel("usb", "cab", [0x02, 0x00, 0x10, 0x0a]);
  if (
    !bleIrMidi ||
    !factoryCab ||
    !userCab ||
    !sameBytes(usbIr, bleIrMidi) ||
    sameBytes(usbIr, nameList) ||
    sameBytes(usbIr, currentPatch) ||
    sameBytes(usbIr, currentPreset) ||
    factoryCab[0].length !== userCab[0].length ||
    userCab[0].length > 80
  ) {
    throw new Error("IR-name request must differ from other asks only by the BLE-MIDI wrap, and user IR select stays a model SET");
  }
}

assertUsbBluetoothWrapOnly();
