import {
  encodeModuleCcValue,
  gp50Cc,
  gp5Cc,
  MODULE_CC,
  MODULE_CC_OFF,
  MODULE_CC_ON,
} from "@/device/cc";
import type { AudioChain, ChainSlotId, EffectId } from "@/device/chain";
import {
  encodeChainOrderSysex,
  encodeCurrentChainRequest,
  encodeSlotControlSysex,
  encodeSlotModelSysex,
  encodeStompAssignmentEffectSysex,
  encodeStompAssignmentSysex,
} from "@/device/chain-codec";
import {
  encodePatchRecallSysex,
  encodePatchStoreSysex,
  encodePatchVolumeSysex,
  encodePatchBpmSysex,
} from "@/device/patch-store";
import type { WireIdentity } from "@/device/catalog";
import type { IdentityRequestKind } from "@/device/identity";
import { encodeIdentityRequest } from "@/device/identity";
import { encodeIrNameRequest } from "@/device/ir-names";
import { encodeNamNameRequest } from "@/device/nam-names";
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
import type { DeviceModel } from "@/device/models";

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

/**
 * USB: official CC 0 (value 0–99). Bluetooth: parameter-write SET family
 * `1143` (reference editors; CC 0 over GATT does not move the pedal).
 */
export function encodePatch(linkMode: LinkMode, patch: number): Uint8Array {
  if (linkMode === "bluetooth") {
    const sysex = encodePatchRecallSysex(patch);
    if (!sysex) {
      throw new Error("Patch must be an integer from 0 to 99.");
    }
    return encodeLinkMidi(linkMode, sysex);
  }
  return encodeLinkMidi(linkMode, midiCc(gp5Cc.patch, patch));
}

/** One stomp press: GP-5 and GP-50 A are CC 69; GP-50 B is CC 70. Value 127. */
const STOMP_PRESS_VALUE = 127;

export function encodeStompPress(
  linkMode: LinkMode,
  model: DeviceModel,
  stompIndex: number,
): Uint8Array | null {
  const controller = stompPressController(model, stompIndex);
  if (controller === null) {
    return null;
  }
  return encodeLinkMidi(linkMode, midiCc(controller, STOMP_PRESS_VALUE));
}

function stompPressController(model: DeviceModel, stompIndex: number): number | null {
  if (stompIndex === 0) {
    return gp5Cc.ctl;
  }
  if (model === "gp50" && stompIndex === 1) {
    return gp50Cc.ctrl2;
  }
  return null;
}

/** Official tuner on/off CC 58. Writes use 0 / 127 like module switches. */
export function encodeTuner(linkMode: LinkMode, on: boolean): Uint8Array {
  return encodeLinkMidi(
    linkMode,
    midiCc(gp5Cc.tuner, on ? MODULE_CC_ON : MODULE_CC_OFF),
  );
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

/** Nam / SnapTone-name dump request. USB vs Bluetooth differ only by the BLE-MIDI wrap. */
export function encodeNamNames(linkMode: LinkMode): Uint8Array {
  return encodeLinkMidi(linkMode, encodeNamNameRequest());
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

/** Parameter-write stomp-assignment SET (family `114d`). Both stomp masks. USB vs Bluetooth only differ by BLE-MIDI wrap. */
export function encodeStompAssignment(
  linkMode: LinkMode,
  stomps: readonly (readonly EffectId[])[],
): Uint8Array[] | null {
  const midi = encodeStompAssignmentSysex(stomps);
  if (!midi) {
    return null;
  }
  return encodeLinkMidiPackets(linkMode, midi);
}

/**
 * GP-5 per-effect stomp-assignment SET (family `114d`, size `0x05`).
 * USB vs Bluetooth only differ by BLE-MIDI wrap.
 */
export function encodeStompAssignmentEffect(
  linkMode: LinkMode,
  footswitch: 0 | 1,
  effect: EffectId,
  assigned: boolean,
): Uint8Array[] | null {
  const midi = encodeStompAssignmentEffectSysex(footswitch, effect, assigned);
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
  const usbStomp = encodeStompAssignment("usb", [["dst"], []]);
  const bleStomp = encodeStompAssignment("bluetooth", [["dst"], []]);
  const usbStompEffect = encodeStompAssignmentEffect("usb", 0, "dst", true);
  const bleStompEffect = encodeStompAssignmentEffect("bluetooth", 0, "dst", true);
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
  const usbNam = encodeNamNames("usb");
  const bleNam = encodeNamNames("bluetooth");
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
  const bleStompEffectMidi =
    bleStompEffect && bleStompEffect.length === 1 ? unwrapBlePacket(bleStompEffect[0]) : null;
  const bleStoreMidi = bleStore && bleStore.length === 1 ? unwrapBlePacket(bleStore[0]) : null;
  const bleVolMidi = bleVol && bleVol.length === 1 ? unwrapBlePacket(bleVol[0]) : null;
  const bleIrMidi = unwrapBlePacket(bleIr);
  const bleNamMidi = unwrapBlePacket(bleNam);
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
    !usbStompEffect ||
    !bleStompEffect ||
    !usbStore ||
    !bleStore ||
    !usbVol ||
    !bleVol ||
    !bleModelMidi ||
    !bleControlMidi ||
    !bleStompMidi ||
    !bleStompEffectMidi ||
    !bleStoreMidi ||
    !bleVolMidi ||
    !sameBytes(usbModel[0], bleModelMidi) ||
    !sameBytes(usbControl[0], bleControlMidi) ||
    !sameBytes(usbStomp[0], bleStompMidi) ||
    !sameBytes(usbStompEffect[0], bleStompEffectMidi) ||
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
  const factoryNs = encodeSlotModel("usb", "ns", [0x00, 0x00, 0x00, 0x0f]);
  const userNs = encodeSlotModel("usb", "ns", [0x3a, 0x00, 0x00, 0x0f]);
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
    !bleNamMidi ||
    !factoryNs ||
    !userNs ||
    !sameBytes(usbNam, bleNamMidi) ||
    sameBytes(usbNam, usbIr) ||
    sameBytes(usbNam, nameList) ||
    sameBytes(usbNam, currentPreset) ||
    factoryNs[0].length !== userNs[0].length ||
    userNs[0].length > 80
  ) {
    throw new Error("Nam-name request must differ from other asks only by the BLE-MIDI wrap, and user SnapTone select stays a model SET");
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

function assertStompPress(): void {
  const usbGp5 = encodeStompPress("usb", "gp5", 0);
  const bleGp5 = encodeStompPress("bluetooth", "gp5", 0);
  const usbA = encodeStompPress("usb", "gp50", 0);
  const bleA = encodeStompPress("bluetooth", "gp50", 0);
  const usbB = encodeStompPress("usb", "gp50", 1);
  const bleB = encodeStompPress("bluetooth", "gp50", 1);
  const bleGp5Midi = bleGp5 ? unwrapBlePacket(bleGp5) : null;
  const bleAMidi = bleA ? unwrapBlePacket(bleA) : null;
  const bleBMidi = bleB ? unwrapBlePacket(bleB) : null;
  const moduleCc = usbGp5 !== null && usbGp5[1] >= 48 && usbGp5[1] <= 57;
  if (
    !usbGp5 ||
    !usbA ||
    !usbB ||
    !bleGp5Midi ||
    !bleAMidi ||
    !bleBMidi ||
    usbGp5.length !== 3 ||
    usbGp5[0] !== 0xb0 ||
    usbGp5[1] !== 0x45 ||
    usbGp5[2] !== 0x7f ||
    usbA[1] !== 0x45 ||
    usbB[0] !== 0xb0 ||
    usbB[1] !== 0x46 ||
    usbB[2] !== 0x7f ||
    moduleCc ||
    !sameBytes(usbGp5, bleGp5Midi) ||
    !sameBytes(usbA, bleAMidi) ||
    !sameBytes(usbB, bleBMidi) ||
    encodeStompPress("usb", "gp5", 1) !== null ||
    encodeStompPress("usb", "gp50", 2) !== null ||
    encodeStompPress("bluetooth", "gp5", 1) !== null
  ) {
    throw new Error("Stomp press must be CC 69 (0x45) or GP-50 CC 70 (0x46) at 0x7F, not CC 48-57");
  }
}

assertUsbBluetoothWrapOnly();
assertPatchRecall();
assertStompPress();
assertTuner();

function assertPatchRecall(): void {
  const usb = encodePatch("usb", 42);
  const ble = encodePatch("bluetooth", 42);
  const bleMidi = unwrapBlePacket(ble);
  const recallSysex = encodePatchRecallSysex(42);
  if (
    usb.length !== 3 ||
    usb[0] !== 0xb0 ||
    usb[1] !== 0x00 ||
    usb[2] !== 42 ||
    !bleMidi ||
    !recallSysex ||
    !sameBytes(bleMidi, recallSysex) ||
    bleMidi[0] !== 0xf0 ||
    bleMidi[9] !== 0x01 ||
    bleMidi[10] !== 0x01 ||
    bleMidi[11] !== 0x04 ||
    bleMidi[12] !== 0x03 ||
    sameBytes(usb, bleMidi)
  ) {
    throw new Error("USB patch recall must stay CC 0; Bluetooth must be SET family 1143");
  }
}

function assertTuner(): void {
  const usbOn = encodeTuner("usb", true);
  const bleOn = encodeTuner("bluetooth", true);
  const usbOff = encodeTuner("usb", false);
  const bleOff = encodeTuner("bluetooth", false);
  const bleOnMidi = unwrapBlePacket(bleOn);
  const bleOffMidi = unwrapBlePacket(bleOff);
  if (
    usbOn.length !== 3 ||
    usbOn[0] !== 0xb0 ||
    usbOn[1] !== 0x3a ||
    usbOn[2] !== 0x7f ||
    usbOff[1] !== 0x3a ||
    usbOff[2] !== 0x00 ||
    !bleOnMidi ||
    !bleOffMidi ||
    !sameBytes(usbOn, bleOnMidi) ||
    !sameBytes(usbOff, bleOffMidi)
  ) {
    throw new Error("Tuner must be CC 58 (0x3a) with 0x7F on and 0x00 off");
  }
}