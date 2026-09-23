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
  encodeStompAssignmentSysex,
} from "@/device/chain-codec";
import { encodePatchStoreSysex, encodePatchVolumeSysex, encodePatchBpmSysex } from "@/device/patch-store";
import type { WireIdentity } from "@/device/catalog";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import { encodeIrNameRequest } from "@/device/ir-names";
import {
  encodeGlobalsRequest,
  encodeGlobalSysex,
  encodeGp5Footswitch,
  encodeGp5GlobalSysex,
  type FootswitchMode,
  type GlobalSysexKey,
  type Gp5FootswitchMode,
  type Gp5GlobalSysexKey,
  type RecMode,
} from "@/device/globals";
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

/** GP-50 globals dump request. USB vs Bluetooth differ only by the BLE-MIDI wrap. */
export function encodeGlobals(linkMode: LinkMode): Uint8Array {
  return encodeLinkMidi(linkMode, encodeGlobalsRequest());
}

/** Parameter-write global SysEx SET (family `1111`). USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodeGlobalSetting(
  linkMode: LinkMode,
  key: GlobalSysexKey,
  value: number | boolean | RecMode,
): Uint8Array[] | null {
  const midi = encodeGlobalSysex(key, value);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** GP-5 parameter-write global SET. Not CC 1. USB vs Bluetooth differ only by the BLE-MIDI wrap. */
export function encodeGp5GlobalSetting(
  linkMode: LinkMode,
  key: Gp5GlobalSysexKey,
  value: number | boolean,
): Uint8Array[] | null {
  const midi = encodeGp5GlobalSysex(key, value);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** GP-5 footswitch SET (family `1115`). Not CC 28. */
export function encodeGp5FootswitchMode(
  linkMode: LinkMode,
  mode: Gp5FootswitchMode,
): Uint8Array[] | null {
  const midi = encodeGp5Footswitch(mode);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/** Official GP-50 master volume CC 1 (0–100). Not the relative step CC 17. */
export function encodeMasterVolumeCc(
  linkMode: LinkMode,
  volume: number,
): Uint8Array[] | null {
  if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
    return null;
  }
  return [encodeLinkMidi(linkMode, midiCc(gp50Cc.masterVolume, volume))];
}

/** Official GP-50 Patch | Stomp CC 28. Patch = 0, Stomp = 127. */
export function encodeFootswitchModeCc(
  linkMode: LinkMode,
  mode: FootswitchMode,
): Uint8Array[] | null {
  const value = mode === "patch" ? 0 : 127;
  return [encodeLinkMidi(linkMode, midiCc(gp50Cc.patchStompMode, value))];
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

/** Parameter-write stomp-assignment SET (family `114d`). Full stomp mask. USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodeStompAssignment(
  linkMode: LinkMode,
  footswitch: 0 | 1,
  effects: readonly EffectId[],
): Uint8Array[] | null {
  const midi = encodeStompAssignmentSysex(footswitch, effects);
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

const PATCH_VOLUME_CC_MAX = 100;
const PATCH_TEMPO_CC_MIN = 40;
const PATCH_TEMPO_CC_MAX = 260;

/**
 * Official patch-volume CC 7 (0–100). USB is the CC bytes; Bluetooth wraps that
 * one message. Not the family-`1142` upload SET.
 */
export function encodePatchVolumeCc(
  linkMode: LinkMode,
  volume: number,
): Uint8Array[] | null {
  if (!Number.isInteger(volume) || volume < 0 || volume > PATCH_VOLUME_CC_MAX) {
    return null;
  }
  return [encodeLinkMidi(linkMode, midiCc(gp5Cc.volume, volume))];
}

/**
 * Official GP-50 tempo: CC 73 then CC 74.
 * 40–127 → 0 / BPM; 128–255 → 1 / BPM−128; 256–260 → 2 / BPM−256.
 * Each message is wrapped once on Bluetooth. Rejects anything outside 40–260.
 */
export function encodePatchTempoCc(linkMode: LinkMode, bpm: number): Uint8Array[] | null {
  if (!Number.isInteger(bpm) || bpm < PATCH_TEMPO_CC_MIN || bpm > PATCH_TEMPO_CC_MAX) {
    return null;
  }
  let msb: number;
  let lsb: number;
  if (bpm <= 127) {
    msb = 0;
    lsb = bpm;
  } else if (bpm <= 255) {
    msb = 1;
    lsb = bpm - 128;
  } else {
    msb = 2;
    lsb = bpm - 256;
  }
  return [
    encodeLinkMidi(linkMode, midiCc(gp50Cc.tempoMsb, msb)),
    encodeLinkMidi(linkMode, midiCc(gp50Cc.tempoLsb, lsb)),
  ];
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
  const usbStomp = encodeStompAssignment("usb", 0, ["dst"]);
  const bleStomp = encodeStompAssignment("bluetooth", 0, ["dst"]);
  const usbStore = encodePatchStore("usb", 5, "Flow");
  const bleStore = encodePatchStore("bluetooth", 5, "Flow");
  const usbVol = encodePatchVolume("usb", 50);
  const bleVol = encodePatchVolume("bluetooth", 50);
  const usbVolCc = encodePatchVolumeCc("usb", 60);
  const bleVolCc = encodePatchVolumeCc("bluetooth", 60);
  const usbTempo = encodePatchTempoCc("usb", 140);
  const bleTempo = encodePatchTempoCc("bluetooth", 140);
  const usbTempoLow = encodePatchTempoCc("usb", 120);
  const usbTempoHigh = encodePatchTempoCc("usb", 260);
  const bleVolCcMidi = bleVolCc && bleVolCc.length === 1 ? unwrapBlePacket(bleVolCc[0]) : null;
  const bleTempoMsb = bleTempo && bleTempo.length === 2 ? unwrapBlePacket(bleTempo[0]) : null;
  const bleTempoLsb = bleTempo && bleTempo.length === 2 ? unwrapBlePacket(bleTempo[1]) : null;
  const usbIr = encodeIrNames("usb");
  const bleIr = encodeIrNames("bluetooth");
  const usbGlobals = encodeGlobals("usb");
  const bleGlobals = encodeGlobals("bluetooth");
  const usbMaster = encodeMasterVolumeCc("usb", 63);
  const bleMaster = encodeMasterVolumeCc("bluetooth", 63);
  const usbFoot = encodeFootswitchModeCc("usb", "stomp");
  const bleFoot = encodeFootswitchModeCc("bluetooth", "stomp");
  const usbGlobalSet = encodeGlobalSetting("usb", "inputLevel", 0);
  const bleGlobalSet = encodeGlobalSetting("bluetooth", "inputLevel", 0);
  const bleModelMidi = bleModel && bleModel.length === 1 ? unwrapBlePacket(bleModel[0]) : null;
  const bleControlMidi =
    bleControl && bleControl.length === 1 ? unwrapBlePacket(bleControl[0]) : null;
  const bleStompMidi = bleStomp && bleStomp.length === 1 ? unwrapBlePacket(bleStomp[0]) : null;
  const bleStoreMidi = bleStore && bleStore.length === 1 ? unwrapBlePacket(bleStore[0]) : null;
  const bleVolMidi = bleVol && bleVol.length === 1 ? unwrapBlePacket(bleVol[0]) : null;
  const bleIrMidi = unwrapBlePacket(bleIr);
  const bleGlobalsMidi = unwrapBlePacket(bleGlobals);
  const bleMasterMidi = bleMaster && bleMaster.length === 1 ? unwrapBlePacket(bleMaster[0]) : null;
  const bleFootMidi = bleFoot && bleFoot.length === 1 ? unwrapBlePacket(bleFoot[0]) : null;
  const bleGlobalSetMidi =
    bleGlobalSet && bleGlobalSet.length === 1 ? unwrapBlePacket(bleGlobalSet[0]) : null;
  const nameList = encodeIdentity("usb", "name-list");
  const currentPatch = encodeIdentity("usb", "current-patch");
  const currentPreset = encodeChainRequest("usb");
  if (
    !usbModel ||
    !bleModel ||
    !usbControl ||
    !bleControl ||
    !usbStomp ||
    !bleStomp ||
    !usbStore ||
    !bleStore ||
    !usbVol ||
    !bleVol ||
    !bleModelMidi ||
    !bleControlMidi ||
    !bleStompMidi ||
    !bleStoreMidi ||
    !bleVolMidi ||
    !sameBytes(usbModel[0], bleModelMidi) ||
    !sameBytes(usbControl[0], bleControlMidi) ||
    !sameBytes(usbStomp[0], bleStompMidi) ||
    !sameBytes(usbStore[0], bleStoreMidi) ||
    !sameBytes(usbVol[0], bleVolMidi) ||
    !usbVolCc ||
    !bleVolCc ||
    !usbTempo ||
    !bleTempo ||
    !usbTempoLow ||
    !usbTempoHigh ||
    !bleVolCcMidi ||
    !bleTempoMsb ||
    !bleTempoLsb ||
    usbVolCc.length !== 1 ||
    usbTempo.length !== 2 ||
    usbVolCc[0][0] !== 0xb0 ||
    usbVolCc[0][1] !== gp5Cc.volume ||
    usbVolCc[0][2] !== 60 ||
    usbTempo[0][1] !== gp50Cc.tempoMsb ||
    usbTempo[0][2] !== 1 ||
    usbTempo[1][1] !== gp50Cc.tempoLsb ||
    usbTempo[1][2] !== 12 ||
    usbTempoLow[0][2] !== 0 ||
    usbTempoLow[1][2] !== 120 ||
    usbTempoHigh[0][2] !== 2 ||
    usbTempoHigh[1][2] !== 4 ||
    !sameBytes(usbVolCc[0], bleVolCcMidi) ||
    !sameBytes(usbTempo[0], bleTempoMsb) ||
    !sameBytes(usbTempo[1], bleTempoLsb) ||
    encodePatchVolumeCc("usb", 101) !== null ||
    encodePatchVolumeCc("usb", -1) !== null ||
    encodePatchTempoCc("usb", 39) !== null ||
    encodePatchTempoCc("usb", 261) !== null ||
    encodePatchTempoCc("usb", 40) === null
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
  if (
    !bleGlobalsMidi ||
    !usbMaster ||
    !bleMaster ||
    !usbFoot ||
    !bleFoot ||
    !usbGlobalSet ||
    !bleGlobalSet ||
    !bleMasterMidi ||
    !bleFootMidi ||
    !bleGlobalSetMidi ||
    !sameBytes(usbGlobals, bleGlobalsMidi) ||
    !sameBytes(usbMaster[0], bleMasterMidi) ||
    !sameBytes(usbFoot[0], bleFootMidi) ||
    !sameBytes(usbGlobalSet[0], bleGlobalSetMidi) ||
    sameBytes(usbGlobals, usbIr) ||
    sameBytes(usbGlobals, nameList) ||
    sameBytes(usbGlobals, currentPatch) ||
    sameBytes(usbGlobals, currentPreset) ||
    usbMaster[0][1] !== gp50Cc.masterVolume ||
    usbMaster[0][2] !== 63 ||
    usbFoot[0][1] !== gp50Cc.patchStompMode ||
    usbFoot[0][2] !== 127 ||
    encodeMasterVolumeCc("usb", 101) !== null
  ) {
    throw new Error("Globals ask and master/foot CCs must differ from other asks only by the BLE-MIDI wrap");
  }
}

assertUsbBluetoothWrapOnly();
