import type { BluetoothLink } from "@/bluetooth/types";
import { decodePresetDump } from "@/device/chain-codec";
import { commandReceivedAckFixture, RECALL_ACK_TIMEOUT_MS } from "@/device/command-ack";
import { emptyUserIrNames, encodeIrNameDump, USER_IR_COUNT } from "@/device/ir-names";
import { emptyUserNsNames, encodeNamNameDump, USER_NS_COUNT } from "@/device/nam-names";
import { decodePrstFile, encodePrstFile } from "@/device/patch-store";
import { GP5_TOB_PRST_HEX, GP50_TOB_PRST_HEX } from "@/device/prst-tob-fixtures";
import { planUploadedPatch } from "@/device/session/patch-io";
import { CHAIN_TIMEOUT_MS, DeviceSession } from "./device-session";
import "@/snaptone/golden";
import {
  SNAP_FILE_BYTES,
  encodeSnapImportFrames,
  encodeSnapPayload,
  encodeUserSnapDelete,
  encodeUserSnapRename,
  encodeUserSnapRenameCommit,
  parseSnapSysex,
} from "@/device/snaptone-table";
import {
  USER_IR_DATA_BYTES,
  decodeUserIrTable,
  encodeUserIrImportFrames,
  encodeUserIrTableRequest,
  sanitizeUserIrName,
} from "@/device/user-ir-table";
import { encodeTestWav, prepareUserIr } from "@/snaptone/ir-wav";
import type { MidiTransport } from "@/midi/types";
import type { EffectId } from "@/device/chain";
import {
  encodeChainOrder,
  encodeChainRequest,
  encodeGlobals,
  encodeGp5FootswitchMode,
  encodeGp5GlobalSetting,
  encodeIdentity,
  encodeIrNames,
  encodeNamNames,
  encodePatch,
  encodePatchBpm,
  encodePatchStore,
  encodePatchTempoCc,
  encodeSlotModel,
} from "@/device/encode";

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function assertUploadSessionFixtures(): void {
  const gp50 = bytesFromHex(GP50_TOB_PRST_HEX);
  const gp5 = bytesFromHex(GP5_TOB_PRST_HEX);
  const decoded = decodePrstFile(gp50);
  if (!decoded) {
    throw new Error("GP-50 TOB must decode for upload");
  }
  const chain = decodePresetDump(decoded.dump, "gp50", "gp50");
  if (!chain) {
    throw new Error("GP-50 TOB dump must decode as a chain");
  }
  const order = encodeChainOrder("usb", chain);
  const store = encodePatchStore("usb", 5, decoded.name);
  const recall = encodePatch("usb", 5);
  if (!order || !store) {
    throw new Error("Upload apply must encode chain-order and store 114a");
  }
  if (recall[0] !== 0xb0 || recall[1] !== 0x00) {
    throw new Error("Patch recall fixture must be CC 0");
  }
  for (const packet of [...order, ...store]) {
    if (packet[0] === 0xb0 && packet[1] === 0x00) {
      throw new Error("Upload writes must not include extra patch recall");
    }
  }
  if (decodePrstFile(gp5)?.model === "gp50") {
    throw new Error("A GP-5 file must not classify as GP-50");
  }
}

assertUploadSessionFixtures();

function recordingUsb(): {
  sent: Uint8Array[];
  transport: MidiTransport;
} {
  const sent: Uint8Array[] = [];
  let open = false;
  return {
    sent,
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes) => {
        sent.push(Uint8Array.from(bytes));
      },
      subscribe: () => () => undefined,
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => false,
    },
  };
}

function stubBluetooth(): BluetoothLink {
  let open = false;
  return {
    discover: async () => ({ endpoints: [] }),
    open: async () => {
      open = true;
    },
    send: async () => undefined,
    subscribe: () => () => undefined,
    subscribeDisconnect: () => () => undefined,
    isOpen: () => open,
    resetInbound: () => undefined,
    close: async () => {
      open = false;
    },
    forget: async () => undefined,
  };
}

async function assertUploadRejectsWithoutMidi(): Promise<void> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  const connecting = session.connect(
    { id: "usb-1", label: "GP-50", kind: "usb-midi" },
    "gp50",
  );
  await untilReady("Upload reject fixture did not ask for names", () => usb.sent.length > 0);
  await tick();
  usb.push(usbNameList());
  await connecting;
  await untilReady("Upload reject fixture did not ask for current patch", () => usb.sent.length > 1);
  await tick();
  usb.push(currentPatchAt(0));
  await untilReady("Upload reject fixture did not become ready", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.sync === "ready";
  });
  for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
    usb.push(packet);
  }
  await untilReady("Upload reject fixture chain did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });
  const sentAfterConnect = usb.sent.length;
  const beforeSnap = session.getSnapshot();
  const patchBefore = beforeSnap.status === "connected" ? beforeSnap.patch : -1;
  const invalid = await session.uploadCurrentPatch(new Uint8Array([0x00, 0x01, 0x02]));
  if (invalid.ok || invalid.reason !== "invalid") {
    throw new Error("Invalid bytes must return without sending MIDI");
  }
  if (usb.sent.length !== sentAfterConnect) {
    throw new Error("Rejected upload must not send MIDI");
  }
  const disconnected = await new DeviceSession(
    recordingUsb().transport,
    stubBluetooth(),
  ).uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (disconnected.ok || disconnected.reason !== "disconnected") {
    throw new Error("Disconnected upload must no-op");
  }

  const cross = await session.uploadCurrentPatch(bytesFromHex(GP5_TOB_PRST_HEX));
  if (!cross.ok || cross.omissions.length !== 0) {
    throw new Error("GP-5 TOB on a GP-50 session must apply with no omission");
  }
  const afterCross = session.getSnapshot();
  if (afterCross.status !== "connected" || afterCross.patch !== patchBefore) {
    throw new Error("Cross-model upload must not change the patch index");
  }
  const applied = usb.sent.slice(sentAfterConnect);
  if (applied.some(isStore114a) || applied.some(isPatchRecall)) {
    throw new Error("Upload must not send store 114a or extra patch recall");
  }
  const preview = session.previewUploadPatch(bytesFromHex(GP5_TOB_PRST_HEX));
  if (!preview.ok || preview.omissions.length !== 0 || preview.fileModel !== "gp5") {
    throw new Error("Preview must report a GP-5 file with no omissions on GP-50");
  }
}

void assertUploadRejectsWithoutMidi();

function isStore114a(bytes: Uint8Array): boolean {
  const midi = bytes[0] === 0x80 && bytes[1] === 0x80 ? bytes.subarray(2) : bytes;
  return (
    midi[0] === 0xf0 &&
    midi.length >= 15 &&
    midi[9] === 0x01 &&
    midi[10] === 0x01 &&
    midi[11] === 0x04 &&
    midi[12] === 0x0a
  );
}

function writeIdentityNibbles(data: Uint8Array, start: number, packed: Uint8Array): void {
  for (let index = 0; index < packed.length; index += 1) {
    data[start + index * 2] = (packed[index] >> 4) & 0x0f;
    data[start + index * 2 + 1] = packed[index] & 0x0f;
  }
}

function gp50PrstWithIdentity(kind: EffectId, wire: Uint8Array): Uint8Array {
  const parsed = decodePrstFile(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!parsed) {
    throw new Error("GP-50 TOB must decode for upload fixtures");
  }
  const dump = parsed.dump.slice();
  const identityAt: Partial<Record<EffectId, number>> = {
    pre: 278,
    cab: 302,
    mod: 318,
  };
  const at = identityAt[kind];
  if (at === undefined) {
    throw new Error(`Upload fixture has no identity offset for ${kind}`);
  }
  writeIdentityNibbles(dump, at, wire);
  const encoded = encodePrstFile({ model: "gp50", name: parsed.name || "TOB", dump });
  if (!encoded) {
    throw new Error("Mutated GP-50 dump must re-encode as .prst");
  }
  return encoded;
}

function packetsInclude(sent: Uint8Array[], packets: Uint8Array[] | null): boolean {
  if (!packets) {
    return false;
  }
  return packets.some((packet) => sent.some((item) => packetsEqual(item, packet)));
}

async function readyGp5UsbSession(): Promise<{
  session: DeviceSession;
  usb: ReturnType<typeof scriptedUsb>;
}> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  const connecting = session.connect(
    { id: "usb-1", label: "GP-5", kind: "usb-midi" },
    "gp5",
  );
  await untilReady("GP-5 upload fixture did not ask for names", () => usb.sent.length > 0);
  await tick();
  usb.push(usbNameList());
  await connecting;
  await untilReady("GP-5 upload fixture did not ask for current patch", () => usb.sent.length > 1);
  await tick();
  usb.push(currentPatchAt(5));
  await untilReady("GP-5 upload fixture did not become ready", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.sync === "ready";
  });
  for (const packet of gp5ChainPackets("usb")) {
    usb.push(packet);
  }
  await untilReady("GP-5 upload fixture chain did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });
  return { session, usb };
}

async function readyGp5BluetoothSession(): Promise<{
  session: DeviceSession;
  bluetooth: ReturnType<typeof scriptedBluetooth>;
}> {
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(recordingUsb().transport, bluetooth.link);
  const connecting = session.connect(
    { id: "bt-1", label: "GP-5", kind: "bluetooth" },
    "gp5",
  );
  await untilReady("GP-5 Bluetooth upload fixture did not ask for names", () => {
    return bluetooth.sent.length > 0;
  });
  await tick();
  bluetooth.push(bluetoothNameList());
  await connecting;
  await untilReady("GP-5 Bluetooth upload fixture did not ask for current patch", () => {
    return bluetooth.sent.length > 1;
  });
  await tick();
  bluetooth.push(currentPatchAt(5));
  await untilReady("GP-5 Bluetooth upload fixture did not become ready", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.sync === "ready";
  });
  for (const packet of gp5ChainPackets("bluetooth")) {
    bluetooth.push(packet);
  }
  await untilReady("GP-5 Bluetooth upload fixture chain did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });
  return { session, bluetooth };
}

function settleGp5UsbChain(usb: ReturnType<typeof scriptedUsb>): void {
  for (const packet of gp5ChainPackets("usb")) {
    usb.push(packet);
  }
}

async function assertCrossModelUploadSession(): Promise<void> {
  const { session, usb } = await readyGp5UsbSession();
  const snapshotBefore = session.getSnapshot();
  const patchBefore = snapshotBefore.status === "connected" ? snapshotBefore.patch : -1;

  const shared = await session.uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!shared.ok || shared.omissions.length !== 0) {
    throw new Error("Shared GP-50 TOB on GP-5 must apply with no omission");
  }
  const afterShared = usb.sent.slice();
  const tob = decodePrstFile(bytesFromHex(GP50_TOB_PRST_HEX));
  if (tob?.bpm !== null && tob?.bpm !== undefined) {
    const bpmPackets =
      tob.bpm > 255 ? encodePatchTempoCc("usb", tob.bpm) : encodePatchBpm("usb", tob.bpm);
    if (packetsInclude(afterShared, bpmPackets)) {
      throw new Error("GP-50 file on GP-5 must not send a BPM write");
    }
  }
  const afterSharedSnap = session.getSnapshot();
  if (afterSharedSnap.status !== "connected" || afterSharedSnap.patch !== patchBefore) {
    throw new Error("Shared upload must not change the patch index");
  }
  settleGp5UsbChain(usb);
  await untilReady("Shared upload dump reply did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });

  const cWahBytes = gp50PrstWithIdentity("pre", Uint8Array.from([0x08, 0x00, 0x00, 0x05]));
  const sentBeforeCwah = usb.sent.length;
  const cWah = await session.uploadCurrentPatch(cWahBytes);
  if (
    !cWah.ok ||
    cWah.omissions.length !== 1 ||
    cWah.omissions[0]?.kind !== "pre" ||
    cWah.omissions[0]?.label !== "C-Wah"
  ) {
    throw new Error("PRE C-Wah upload must report that omission");
  }
  const cWahSent = usb.sent.slice(sentBeforeCwah);
  const cWahModel = encodeSlotModel("usb", "pre", [0x08, 0x00, 0x00, 0x05]);
  if (packetsInclude(cWahSent, cWahModel)) {
    throw new Error("PRE C-Wah upload must not send C-Wah model bytes");
  }
  const planned = planUploadedPatch(cWahBytes, "gp5", "usb");
  if (!planned.ok) {
    throw new Error("PRE C-Wah must still plan writable steps");
  }
  const order = planned.steps.filter((step) => step.kind === "order");
  const modules = planned.steps.filter((step) => step.kind === "module");
  if (
    !order.every((step) => cWahSent.some((packet) => packetsEqual(packet, step.bytes))) ||
    !modules.every((step) => cWahSent.some((packet) => packetsEqual(packet, step.bytes)))
  ) {
    throw new Error("PRE C-Wah upload must still write order and module on/off");
  }
  if (planned.steps.filter((step) => step.kind === "model").length === 0) {
    throw new Error("PRE C-Wah upload must still write other transferable models");
  }
  if (
    !planned.steps
      .filter((step) => step.kind === "model")
      .every((step) => cWahSent.some((packet) => packetsEqual(packet, step.bytes)))
  ) {
    throw new Error("PRE C-Wah upload must send the other model SETs");
  }
  settleGp5UsbChain(usb);
  await untilReady("C-Wah upload dump reply did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });

  const userIrBytes = gp50PrstWithIdentity("cab", Uint8Array.from([0x02, 0x00, 0x10, 0x0a]));
  const sentBeforeIr = usb.sent.length;
  const userIr = await session.uploadCurrentPatch(userIrBytes);
  if (!userIr.ok || userIr.omissions.some((item) => item.kind === "cab")) {
    throw new Error("User IR 03 must transfer with no CAB omission");
  }
  const irModel = encodeSlotModel("usb", "cab", [0x02, 0x00, 0x10, 0x0a]);
  if (!packetsInclude(usb.sent.slice(sentBeforeIr), irModel)) {
    throw new Error("User IR 03 must send a model write");
  }
  settleGp5UsbChain(usb);
  await untilReady("User IR upload dump reply did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });

  const syncPlan = planUploadedPatch(bytesFromHex(GP50_TOB_PRST_HEX), "gp5", "usb");
  if (!syncPlan.ok || syncPlan.omissions.some((item) => item.label === "Sync")) {
    throw new Error("Shared model with Sync must not report a Sync omission");
  }
  const fullPlan = planUploadedPatch(bytesFromHex(GP50_TOB_PRST_HEX), "gp50", "usb");
  if (!fullPlan.ok) {
    throw new Error("GP-50 TOB must plan against GP-50");
  }
  const gp50OnlyControls = fullPlan.steps.filter(
    (step) =>
      step.kind === "control" &&
      !syncPlan.steps.some((other) => packetsEqual(other.bytes, step.bytes)),
  );
  const sentBeforeSync = usb.sent.length;
  const syncUpload = await session.uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!syncUpload.ok) {
    throw new Error("Shared Sync model upload must apply");
  }
  const syncSent = usb.sent.slice(sentBeforeSync);
  if (gp50OnlyControls.some((step) => syncSent.some((packet) => packetsEqual(packet, step.bytes)))) {
    throw new Error("Shared model upload must not send Sync");
  }
  const modModels = syncPlan.steps.filter((step) => step.kind === "model");
  if (
    modModels.length === 0 ||
    !modModels.some((step) => syncSent.some((packet) => packetsEqual(packet, step.bytes)))
  ) {
    throw new Error("Shared model upload must still write the model");
  }
  settleGp5UsbChain(usb);
  await untilReady("Sync upload dump reply did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });

  const sentBeforeInvalid = usb.sent.length;
  const invalid = await session.uploadCurrentPatch(new Uint8Array([0xff, 0x00]));
  if (invalid.ok || invalid.reason !== "invalid" || usb.sent.length !== sentBeforeInvalid) {
    throw new Error("Invalid bytes on GP-5 must send nothing");
  }

  const { session: bleSession, bluetooth } = await readyGp5BluetoothSession();
  const blePreview = bleSession.previewUploadPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!blePreview.ok || blePreview.fileModel !== "gp50") {
    throw new Error("Bluetooth GP-5 session must use the same upload planner");
  }
  const bleSentBefore = bluetooth.sent.length;
  const bleUpload = await bleSession.uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (!bleUpload.ok || bleUpload.omissions.length !== 0) {
    throw new Error("Bluetooth GP-5 must apply a shared GP-50 file");
  }
  if (bluetooth.sent.length <= bleSentBefore) {
    throw new Error("Bluetooth upload must send planned writes");
  }
  if (bluetooth.sent.slice(bleSentBefore).some(isStore114a)) {
    throw new Error("Bluetooth upload must not send store 114a");
  }
}

void assertCrossModelUploadSession();

function scriptedBluetooth(): {
  sent: Uint8Array[];
  push: (bytes: Uint8Array) => void;
  link: BluetoothLink;
} {
  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  return {
    sent,
    push(bytes) {
      handler?.(bytes);
    },
    link: {
      discover: async () => ({ endpoints: [] }),
      open: async () => {
        open = true;
      },
      send: async (bytes) => {
        sent.push(Uint8Array.from(bytes));
      },
      subscribe: (next) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      resetInbound: () => undefined,
      close: async () => {
        open = false;
      },
      forget: async () => undefined,
    },
  };
}

function packetsEqual(left: Uint8Array, right: Uint8Array): boolean {
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

function isPatchRecall(bytes: Uint8Array): boolean {
  const midi = bytes[0] === 0x80 && bytes[1] === 0x80 ? bytes.subarray(2) : bytes;
  if (midi[0] === 0xb0 && midi[1] === 0x00) {
    return true;
  }
  // Bluetooth recall is packed family `1143` (nibble-expanded after CRC).
  return (
    midi[0] === 0xf0 &&
    midi.length >= 15 &&
    midi[9] === 0x01 &&
    midi[10] === 0x01 &&
    midi[11] === 0x04 &&
    midi[12] === 0x03
  );
}

function bluetoothNameList(): Uint8Array {
  const payload = new Uint8Array(4000);
  const midi = new Uint8Array(10 + payload.length);
  midi[0] = 0xf0;
  midi[3] = 1;
  midi[4] = 5;
  midi.set(payload, 9);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

function currentPatchZero(): Uint8Array {
  const midi = new Uint8Array(16);
  midi[0] = 0xf0;
  midi[3] = 0;
  midi[4] = 1;
  midi[9] = 1;
  midi[10] = 2;
  midi[11] = 4;
  midi[12] = 3;
  midi[15] = 0xf7;
  return midi;
}

function writeDumpNibbles(data: Uint8Array, start: number, packed: Uint8Array): void {
  for (let index = 0; index < packed.length; index += 1) {
    data[start + index * 2] = (packed[index] >> 4) & 0x0f;
    data[start + index * 2 + 1] = packed[index] & 0x0f;
  }
}

function gp50UsbChainWithCab(wire: Uint8Array, volume: number): Uint8Array[] {
  const merged = new Uint8Array(27 * 38);
  for (let slot = 0; slot < 10; slot += 1) {
    merged[243 + slot * 2] = slot;
  }
  merged[226] |= 1;
  writeDumpNibbles(merged, 302, wire);
  const packed = new Uint8Array(4);
  new DataView(packed.buffer).setFloat32(0, volume, true);
  writeDumpNibbles(merged, 614, packed);
  const packets: Uint8Array[] = [];
  for (let index = 0; index < 27; index += 1) {
    const midi = new Uint8Array(48);
    midi[0] = 0xf0;
    midi[3] = 1;
    midi[4] = 11;
    midi[5] = (index >> 4) & 0x0f;
    midi[6] = index & 0x0f;
    midi.set(merged.subarray(index * 38, (index + 1) * 38), 9);
    midi[47] = 0xf7;
    packets.push(midi);
  }
  return packets;
}

function gp50UsbChainWithNs(wire: Uint8Array, gain: number): Uint8Array[] {
  const merged = new Uint8Array(27 * 38);
  for (let slot = 0; slot < 10; slot += 1) {
    merged[243 + slot * 2] = slot;
  }
  merged[229] |= 1 << 1;
  writeDumpNibbles(merged, 342, wire);
  const packed = new Uint8Array(4);
  new DataView(packed.buffer).setFloat32(0, gain, true);
  writeDumpNibbles(merged, 934, packed);
  const packets: Uint8Array[] = [];
  for (let index = 0; index < 27; index += 1) {
    const midi = new Uint8Array(48);
    midi[0] = 0xf0;
    midi[3] = 1;
    midi[4] = 11;
    midi[5] = (index >> 4) & 0x0f;
    midi[6] = index & 0x0f;
    midi.set(merged.subarray(index * 38, (index + 1) * 38), 9);
    midi[47] = 0xf7;
    packets.push(midi);
  }
  return packets;
}

function liveCabUserIr(): Uint8Array {
  const live = new Uint8Array(30);
  live[0] = 0xf0;
  live[3] = 0;
  live[4] = 1;
  live[8] = 0x0a;
  live[9] = 1;
  live[10] = 2;
  live[11] = 4;
  live[12] = 0x07;
  live[14] = 4;
  writeDumpNibbles(live, 21, Uint8Array.from([0x02, 0x00, 0x10, 0x0a]));
  live[29] = 0xf7;
  return live;
}

function liveNsUserSnapTone(): Uint8Array {
  const live = new Uint8Array(30);
  live[0] = 0xf0;
  live[3] = 0;
  live[4] = 1;
  live[8] = 0x0a;
  live[9] = 1;
  live[10] = 2;
  live[11] = 4;
  live[12] = 0x07;
  live[14] = 9;
  writeDumpNibbles(live, 21, Uint8Array.from([0x3a, 0x00, 0x00, 0x0f]));
  live[29] = 0xf7;
  return live;
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function untilReady(label: string, ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (ready()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error(label);
}

async function assertUserIrSession(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  const irRequest = encodeIrNames("bluetooth");
  const irCount = () => bluetooth.sent.filter((packet) => packetsEqual(packet, irRequest)).length;
  try {
    const connecting = session.connect(
      { id: "ble-1", label: "GP-50", kind: "bluetooth" },
      "gp50",
    );
    await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
    await tick();
    bluetooth.push(bluetoothNameList());
    await connecting;
    await untilReady("Identity sync did not request the current patch", () => bluetooth.sent.length > 1);
    await tick();
    bluetooth.push(currentPatchZero());
    await untilReady("Identity sync did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    if (irCount() !== 0) {
      throw new Error("Ready state must not wait for the IR-name request");
    }
    const beforeNames = session.getSnapshot();
    if (beforeNames.status !== "connected" || beforeNames.userIrNames.some((name) => name !== null)) {
      throw new Error("IR names must stay empty until the dump arrives");
    }
    if (bluetooth.sent.some(isPatchRecall)) {
      throw new Error("Connect must not send patch recall to load IR names");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      bluetooth.push(packet);
    }
    await untilReady("First preset dump did not request the IR-name dump", () => irCount() === 1);
    const afterChain = session.getSnapshot();
    const cab =
      afterChain.status === "connected" ? afterChain.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      afterChain.status !== "connected" ||
      afterChain.userIrNames.some((name) => name !== null) ||
      afterChain.chainSync !== "idle" ||
      cab?.modelId !== "cab-twd-cp-1x8" ||
      cab.values?.[0] !== 50 ||
      bluetooth.sent.some(isPatchRecall)
    ) {
      throw new Error("The first preset dump must request IR names once and leave them empty");
    }
    const named = emptyUserIrNames();
    named[2] = "Greenback 412";
    const sentBeforeDump = bluetooth.sent.length;
    const namRequest = encodeNamNames("bluetooth");
    for (const packet of encodeIrNameDump(named)) {
      bluetooth.push(packet);
    }
    await untilReady("IR dump did not chain the Nam-name ask", () =>
      bluetooth.sent.some((packet) => packetsEqual(packet, namRequest)),
    );
    const namedSnapshot = session.getSnapshot();
    if (
      namedSnapshot.status !== "connected" ||
      namedSnapshot.userIrNames[2] !== "Greenback 412" ||
      namedSnapshot.userIrNames[6] !== null ||
      namedSnapshot.userIrNames.length !== USER_IR_COUNT ||
      namedSnapshot.sync !== "ready" ||
      bluetooth.sent.filter((packet) => packetsEqual(packet, namRequest)).length !== 1 ||
      bluetooth.sent.length !== sentBeforeDump + 1
    ) {
      throw new Error("IR-name dump must fill slot 03 and ask Nam once without patch recall");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      bluetooth.push(packet);
    }
    const afterLater = session.getSnapshot();
    const laterCab =
      afterLater.status === "connected" ? afterLater.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      afterLater.status !== "connected" ||
      afterLater.userIrNames[2] !== "Greenback 412" ||
      afterLater.chainSync !== "idle" ||
      laterCab?.modelId !== "cab-twd-cp-1x8" ||
      laterCab.values?.[0] !== 50 ||
      irCount() !== 1
    ) {
      throw new Error("A later current-preset dump must not clear IR names");
    }
    bluetooth.push(liveCabUserIr());
    const afterLive = session.getSnapshot();
    const liveCab = afterLive.status === "connected" ? afterLive.chain.find((slot) => slot.id === "cab") : undefined;
    if (liveCab?.modelId !== "cab-user-ir-03") {
      throw new Error("Bluetooth live user IR notify must update CAB like a factory cab");
    }
    await session.setSlotModel("cab", "cab-twd-cp-1x8");
    await session.setSlotModel("cab", "cab-user-ir-03");
    const factorySet = encodeSlotModel("bluetooth", "cab", [0x01, 0x00, 0x00, 0x0a]);
    const userSet = encodeSlotModel("bluetooth", "cab", [0x02, 0x00, 0x10, 0x0a]);
    const last = bluetooth.sent[bluetooth.sent.length - 1];
    const selected = session.getSnapshot();
    const selectedCab = selected.status === "connected" ? selected.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      !factorySet ||
      !userSet ||
      !last ||
      factorySet[0].length !== userSet[0].length ||
      userSet[0].length > 80 ||
      !packetsEqual(last, userSet[0]) ||
      selectedCab?.modelId !== "cab-user-ir-03" ||
      irCount() !== 1
    ) {
      throw new Error("Selecting User IR 03 must send the existing model SET and no IR file");
    }
    await session.setPatch(1);
    const afterPatch = session.getSnapshot();
    if (irCount() !== 1 || afterPatch.status !== "connected" || afterPatch.userIrNames[2] !== "Greenback 412") {
      throw new Error("A patch change must not re-request or clear IR names");
    }
  } finally {
    await session.disconnect();
  }
  if (session.getSnapshot().status !== "disconnected") {
    throw new Error("Disconnect must drop IR names");
  }
}

void assertUserIrSession();

async function assertUserNsSession(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  const namRequest = encodeNamNames("bluetooth");
  const namCount = () => bluetooth.sent.filter((packet) => packetsEqual(packet, namRequest)).length;
  try {
    const connecting = session.connect(
      { id: "ble-1", label: "GP-50", kind: "bluetooth" },
      "gp50",
    );
    await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
    await tick();
    bluetooth.push(bluetoothNameList());
    await connecting;
    await untilReady("Identity sync did not request the current patch", () => bluetooth.sent.length > 1);
    await tick();
    bluetooth.push(currentPatchZero());
    await untilReady("Identity sync did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    if (namCount() !== 0) {
      throw new Error("Ready state must not wait for the Nam-name request");
    }
    const beforeNames = session.getSnapshot();
    if (beforeNames.status !== "connected" || beforeNames.userNsNames.some((name) => name !== null)) {
      throw new Error("SnapTone names must stay empty until the dump arrives");
    }
    for (const packet of gp50UsbChainWithNs(Uint8Array.from([0x00, 0x00, 0x00, 0x0f]), 50)) {
      bluetooth.push(packet);
    }
    await untilReady("First preset dump did not request the IR-name dump", () => {
      const irRequest = encodeIrNames("bluetooth");
      return bluetooth.sent.some((packet) => packetsEqual(packet, irRequest));
    });
    if (namCount() !== 0) {
      throw new Error("Nam ask must wait until the IR dump finishes");
    }
    const afterChain = session.getSnapshot();
    const ns =
      afterChain.status === "connected" ? afterChain.chain.find((slot) => slot.id === "ns") : undefined;
    if (
      afterChain.status !== "connected" ||
      afterChain.userNsNames.some((name) => name !== null) ||
      afterChain.chainSync !== "idle" ||
      ns?.modelId !== "ns-14-dst" ||
      bluetooth.sent.some(isPatchRecall)
    ) {
      throw new Error("The first preset dump must leave SnapTone names empty until Nam arrives");
    }
    for (const packet of encodeIrNameDump(emptyUserIrNames())) {
      bluetooth.push(packet);
    }
    await untilReady("IR dump did not request the Nam dump", () => namCount() === 1);
    const named = emptyUserNsNames();
    named[2] = "My Amp";
    const sentBeforeDump = bluetooth.sent.length;
    for (const packet of encodeNamNameDump(named)) {
      bluetooth.push(packet);
    }
    const namedSnapshot = session.getSnapshot();
    if (
      namedSnapshot.status !== "connected" ||
      namedSnapshot.userNsNames[2] !== "My Amp" ||
      namedSnapshot.userNsNames[6] !== null ||
      namedSnapshot.userNsNames.length !== USER_NS_COUNT ||
      namedSnapshot.sync !== "ready" ||
      bluetooth.sent.length !== sentBeforeDump
    ) {
      throw new Error("Nam dump must fill SnapTone 03 without another request or patch recall");
    }
    for (const packet of gp50UsbChainWithNs(Uint8Array.from([0x00, 0x00, 0x00, 0x0f]), 50)) {
      bluetooth.push(packet);
    }
    const afterLater = session.getSnapshot();
    if (
      afterLater.status !== "connected" ||
      afterLater.userNsNames[2] !== "My Amp" ||
      namCount() !== 1
    ) {
      throw new Error("A later current-preset dump must not clear SnapTone names");
    }
    bluetooth.push(liveNsUserSnapTone());
    const afterLive = session.getSnapshot();
    const liveNs = afterLive.status === "connected" ? afterLive.chain.find((slot) => slot.id === "ns") : undefined;
    if (liveNs?.modelId !== "ns-user-58") {
      throw new Error("Bluetooth live user SnapTone notify must update NS like a factory SnapTone");
    }
    await session.setSlotModel("ns", "ns-14-dst");
    await session.setSlotModel("ns", "ns-user-58");
    const factorySet = encodeSlotModel("bluetooth", "ns", [0x00, 0x00, 0x00, 0x0f]);
    const userSet = encodeSlotModel("bluetooth", "ns", [0x3a, 0x00, 0x00, 0x0f]);
    const last = bluetooth.sent[bluetooth.sent.length - 1];
    const selected = session.getSnapshot();
    const selectedNs = selected.status === "connected" ? selected.chain.find((slot) => slot.id === "ns") : undefined;
    if (
      !factorySet ||
      !userSet ||
      !last ||
      factorySet[0].length !== userSet[0].length ||
      userSet[0].length > 80 ||
      !packetsEqual(last, userSet[0]) ||
      selectedNs?.modelId !== "ns-user-58" ||
      namCount() !== 1
    ) {
      throw new Error("Selecting SnapTone 58 must send the existing model SET and no SnapTone file");
    }
    await session.setPatch(1);
    const afterPatch = session.getSnapshot();
    if (namCount() !== 1 || afterPatch.status !== "connected" || afterPatch.userNsNames[2] !== "My Amp") {
      throw new Error("A patch change must not re-request or clear SnapTone names");
    }
  } finally {
    await session.disconnect();
  }
  if (session.getSnapshot().status !== "disconnected") {
    throw new Error("Disconnect must drop SnapTone names");
  }
}

void assertUserNsSession();

function writeIdentityNibble(bytes: Uint8Array, index: number, value: number): void {
  bytes[index] = (value >> 4) & 0x0f;
  bytes[index + 1] = value & 0x0f;
}

function currentPatchAt(patch: number): Uint8Array {
  const midi = currentPatchZero();
  writeIdentityNibble(midi, 13, patch);
  return midi;
}

function patchChangedNotify(): Uint8Array {
  const midi = new Uint8Array(22);
  midi[0] = 0xf0;
  midi[3] = 0;
  midi[4] = 1;
  midi[9] = 1;
  midi[10] = 2;
  midi[11] = 1;
  midi[12] = 11;
  midi[21] = 0xf7;
  return midi;
}

function chainRequestCount(sent: Uint8Array[], linkMode: "usb" | "bluetooth" = "bluetooth"): number {
  const request = encodeChainRequest(linkMode);
  return sent.filter((packet) => packetsEqual(packet, request)).length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectBluetoothReady(
  session: DeviceSession,
  bluetooth: ReturnType<typeof scriptedBluetooth>,
  patch: number,
): Promise<void> {
  const connecting = session.connect(
    { id: "ble-1", label: "GP-50", kind: "bluetooth" },
    "gp50",
  );
  await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
  await tick();
  bluetooth.push(bluetoothNameList());
  await connecting;
  await untilReady("Identity sync did not request the current patch", () => bluetooth.sent.length > 1);
  await tick();
  bluetooth.push(currentPatchAt(patch));
  await untilReady("Identity sync did not become ready", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.sync === "ready";
  });
  for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
    bluetooth.push(packet);
  }
  await untilReady("Connect dump did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });
}

async function assertRapidPedalPatchRetarget(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 10);
    const chainsBefore = chainRequestCount(bluetooth.sent);
    bluetooth.push(patchChangedNotify());
    await untilReady("Pedal patch-changed did not ask current-patch", () => {
      const identity = encodeIdentity("bluetooth", "current-patch");
      return bluetooth.sent.some((packet) => packetsEqual(packet, identity));
    });
    await tick();
    bluetooth.push(currentPatchAt(11));
    bluetooth.push(currentPatchAt(12));
    bluetooth.push(currentPatchAt(13));
    await untilReady("Rapid pedal reports did not land on 13", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.patch === 13;
    });
    const chainsAfterReports = chainRequestCount(bluetooth.sent);
    if (chainsAfterReports <= chainsBefore) {
      throw new Error("Retarget must request a chain dump for the latest slot");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x04, 0x00, 0x00, 0x0a]), 40)) {
      bluetooth.push(packet);
    }
    await untilReady("First dump after retarget did not apply", () => {
      const snapshot = session.getSnapshot();
      return (
        snapshot.status === "connected" &&
        snapshot.patch === 13 &&
        snapshot.chain.some((slot) => slot.id === "cab" && slot.modelId === "cab-dark-vit-1x12")
      );
    });
    const mid = session.getSnapshot();
    if (mid.status !== "connected" || mid.chainSync !== "syncing") {
      throw new Error("Patch change must stay syncing until confirmation on Bluetooth");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x04, 0x00, 0x00, 0x0a]), 40)) {
      bluetooth.push(packet);
    }
    await untilReady("Confirmation did not clear syncing", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    const done = session.getSnapshot();
    if (done.status !== "connected" || done.patch !== 13) {
      throw new Error("Rapid pedal patch burst must leave the snapshot on patch 13");
    }
  } finally {
    await session.disconnect();
  }
}

void assertRapidPedalPatchRetarget().catch((error) => {
  console.error(error);
  throw error;
});

async function assertAppRecallKeepsPendingSlot(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 10);
    const sentBefore = bluetooth.sent.length;
    await session.setPatch(42);
    const afterSelect = session.getSnapshot();
    if (afterSelect.status !== "connected" || afterSelect.patch !== 42) {
      throw new Error("setPatch must select patch 42");
    }
    const recallPackets = bluetooth.sent.slice(sentBefore).filter(isPatchRecall);
    if (recallPackets.length !== 1) {
      throw new Error("Bluetooth setPatch must send exactly one patch recall");
    }
    const midi =
      recallPackets[0][0] === 0x80 && recallPackets[0][1] === 0x80
        ? recallPackets[0].subarray(2)
        : recallPackets[0];
    if (midi[0] === 0xb0) {
      throw new Error("Bluetooth setPatch must not send official CC 0");
    }
    if (midi[0] !== 0xf0 || midi[12] !== 0x03 || midi[13] !== 0x02 || midi[14] !== 0x0a) {
      throw new Error("Bluetooth setPatch must send SET family 1143 for patch 42");
    }
    bluetooth.push(currentPatchAt(17));
    await tick();
    const afterStale = session.getSnapshot();
    if (afterStale.status !== "connected" || afterStale.patch !== 42) {
      throw new Error("App recall must ignore a stale current-patch for another slot");
    }
  } finally {
    await session.disconnect();
  }
}

void assertAppRecallKeepsPendingSlot().catch((error) => {
  console.error(error);
  throw error;
});

async function assertAppRecallIgnoredWhileSyncing(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 10);
    const chainsBefore = chainRequestCount(bluetooth.sent);
    await session.setPatch(42);
    const afterRecall = session.getSnapshot();
    if (afterRecall.status !== "connected" || afterRecall.patch !== 42 || afterRecall.chainSync !== "syncing") {
      throw new Error("setPatch must select patch 42 and stay syncing until the dump path finishes");
    }
    const recalls = bluetooth.sent.filter(isPatchRecall).length;
    const sentAfterRecall = bluetooth.sent.length;
    if (chainRequestCount(bluetooth.sent) !== chainsBefore) {
      throw new Error("Bluetooth setPatch must not request the dump before the recall ACK");
    }
    await session.setPatch(7);
    await session.stepPatch(1);
    await session.setPatch(42);
    const blocked = session.getSnapshot();
    if (
      blocked.status !== "connected" ||
      blocked.patch !== 42 ||
      bluetooth.sent.length !== sentAfterRecall ||
      bluetooth.sent.filter(isPatchRecall).length !== recalls ||
      chainRequestCount(bluetooth.sent) !== chainsBefore
    ) {
      throw new Error("A second select or next while syncing must send nothing extra");
    }
  } finally {
    await session.disconnect();
  }
}

void assertAppRecallIgnoredWhileSyncing().catch((error) => {
  console.error(error);
  throw error;
});

async function assertBluetoothDumpWaitsForAck(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 10);
    const chainsBefore = chainRequestCount(bluetooth.sent);
    await session.setPatch(42);
    if (chainRequestCount(bluetooth.sent) !== chainsBefore) {
      throw new Error("Bluetooth setPatch must defer the dump until the recall ACK");
    }
    bluetooth.push(currentPatchAt(17));
    await tick();
    if (chainRequestCount(bluetooth.sent) !== chainsBefore) {
      throw new Error("An unrelated notify must not release the deferred dump");
    }
    bluetooth.push(commandReceivedAckFixture());
    await untilReady("Recall ACK did not request the chain dump", () => {
      return chainRequestCount(bluetooth.sent) === chainsBefore + 1;
    });
    bluetooth.push(commandReceivedAckFixture());
    await tick();
    if (chainRequestCount(bluetooth.sent) !== chainsBefore + 1) {
      throw new Error("A late command-received ACK must not request another dump");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 55)) {
      bluetooth.push(packet);
    }
    const afterFirst = session.getSnapshot();
    if (afterFirst.status !== "connected" || afterFirst.chainSync !== "syncing") {
      throw new Error("Bluetooth patch change must stay syncing after the first dump until confirmation");
    }
    await untilReady("Confirmation dump was not armed after the recall ACK", () => {
      return chainRequestCount(bluetooth.sent) === chainsBefore + 2;
    });
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 55)) {
      bluetooth.push(packet);
    }
    await untilReady("Confirmation after ACK did not clear syncing", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    const sentBeforeNext = bluetooth.sent.length;
    await session.setPatch(43);
    const resumed = session.getSnapshot();
    if (
      resumed.status !== "connected" ||
      resumed.patch !== 43 ||
      bluetooth.sent.length === sentBeforeNext ||
      !isPatchRecall(bluetooth.sent[bluetooth.sent.length - 1]!)
    ) {
      throw new Error("App recall must send again after chain sync returns to idle");
    }
  } finally {
    await session.disconnect();
  }
}

void assertBluetoothDumpWaitsForAck().catch((error) => {
  console.error(error);
  throw error;
});

async function assertBluetoothDumpAfterAckTimeout(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 4);
    const chainsBefore = chainRequestCount(bluetooth.sent);
    await session.setPatch(8);
    if (chainRequestCount(bluetooth.sent) !== chainsBefore) {
      throw new Error("Bluetooth setPatch must not dump before the ACK timeout");
    }
    await sleep(RECALL_ACK_TIMEOUT_MS + 150);
    if (chainRequestCount(bluetooth.sent) !== chainsBefore + 1) {
      throw new Error("Bluetooth setPatch must request the dump when the recall ACK times out");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 40)) {
      bluetooth.push(packet);
    }
    await untilReady("Timeout dump did not arm confirmation", () => {
      return chainRequestCount(bluetooth.sent) === chainsBefore + 2;
    });
  } finally {
    await session.disconnect();
  }
}

void assertBluetoothDumpAfterAckTimeout().catch((error) => {
  console.error(error);
  throw error;
});

function scriptedUsb(): {
  sent: Uint8Array[];
  push: (bytes: Uint8Array) => void;
  transport: MidiTransport;
} {
  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  return {
    sent,
    push(bytes) {
      handler?.(bytes);
    },
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes) => {
        sent.push(Uint8Array.from(bytes));
      },
      subscribe: (next) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => true,
    },
  };
}

function usbNameList(): Uint8Array {
  const payload = new Uint8Array(4000);
  const midi = new Uint8Array(10 + payload.length);
  midi[0] = 0xf0;
  midi[3] = 6;
  midi[4] = 10;
  midi.set(payload, 9);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

async function connectUsbReady(
  session: DeviceSession,
  usb: ReturnType<typeof scriptedUsb>,
  patch: number,
): Promise<void> {
  const connecting = session.connect(
    { id: "usb-1", label: "GP-50", kind: "usb-midi" },
    "gp50",
  );
  await untilReady("USB identity did not request names", () => usb.sent.length > 0);
  await tick();
  usb.push(usbNameList());
  await connecting;
  await untilReady("USB identity did not request current patch", () => usb.sent.length > 1);
  await tick();
  usb.push(currentPatchAt(patch));
  await untilReady("USB session did not become ready", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.sync === "ready";
  });
  for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
    usb.push(packet);
  }
  await untilReady("USB connect dump did not go idle", () => {
    const snapshot = session.getSnapshot();
    return snapshot.status === "connected" && snapshot.chainSync === "idle";
  });
}

async function assertUsbPatchConfirmHoldsSyncing(): Promise<void> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  try {
    await connectUsbReady(session, usb, 5);
    const chainsBefore = chainRequestCount(usb.sent, "usb");
    const recallsBefore = usb.sent.filter(isPatchRecall).length;
    await session.setPatch(6);
    const afterRecall = session.getSnapshot();
    if (
      afterRecall.status !== "connected" ||
      afterRecall.patch !== 6 ||
      afterRecall.chainSync !== "syncing" ||
      chainRequestCount(usb.sent, "usb") !== chainsBefore ||
      usb.sent.filter(isPatchRecall).length !== recallsBefore + 1
    ) {
      throw new Error("USB setPatch must send CC 0 and defer the dump until the matching index");
    }
    const sentWhileSyncing = usb.sent.length;
    await session.setPatch(9);
    await session.stepPatch(1);
    const blocked = session.getSnapshot();
    if (
      blocked.status !== "connected" ||
      blocked.patch !== 6 ||
      usb.sent.length !== sentWhileSyncing
    ) {
      throw new Error("USB select or next while syncing must send nothing extra");
    }
    usb.push(commandReceivedAckFixture());
    await tick();
    if (chainRequestCount(usb.sent, "usb") !== chainsBefore) {
      throw new Error("USB dump must not wait on the Bluetooth command-received ACK");
    }
    usb.push(currentPatchAt(17));
    await tick();
    const mismatched = session.getSnapshot();
    if (
      chainRequestCount(usb.sent, "usb") !== chainsBefore ||
      mismatched.status !== "connected" ||
      mismatched.patch !== 6
    ) {
      throw new Error("A different current-patch must not release the USB dump");
    }
    usb.push(currentPatchAt(6));
    await untilReady("Matching current-patch did not request the USB dump", () => {
      return chainRequestCount(usb.sent, "usb") === chainsBefore + 1;
    });
    if (usb.sent.filter(isPatchRecall).length !== recallsBefore + 1) {
      throw new Error("Matching current-patch must not send a second CC 0");
    }
    usb.push(currentPatchAt(6));
    await tick();
    if (
      chainRequestCount(usb.sent, "usb") !== chainsBefore + 1 ||
      usb.sent.filter(isPatchRecall).length !== recallsBefore + 1
    ) {
      throw new Error("A second matching current-patch must not ask for another dump or CC 0");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 55)) {
      usb.push(packet);
    }
    const afterFirst = session.getSnapshot();
    if (afterFirst.status !== "connected" || afterFirst.chainSync !== "syncing") {
      throw new Error("USB patch change must stay syncing after the first dump until confirmation");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 55)) {
      usb.push(packet);
    }
    await untilReady("USB confirmation did not clear syncing", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
  } finally {
    await session.disconnect();
  }
}

void assertUsbPatchConfirmHoldsSyncing().catch((error) => {
  console.error(error);
  throw error;
});

async function assertUsbDumpAfterIndexTimeout(): Promise<void> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  try {
    await connectUsbReady(session, usb, 4);
    const chainsBefore = chainRequestCount(usb.sent, "usb");
    const recallsBefore = usb.sent.filter(isPatchRecall).length;
    await session.setPatch(8);
    if (chainRequestCount(usb.sent, "usb") !== chainsBefore) {
      throw new Error("USB setPatch must not dump before the index wait times out");
    }
    usb.push(commandReceivedAckFixture());
    await tick();
    if (chainRequestCount(usb.sent, "usb") !== chainsBefore) {
      throw new Error("A command-received ACK must not release the USB dump");
    }
    await sleep(RECALL_ACK_TIMEOUT_MS + 150);
    if (
      chainRequestCount(usb.sent, "usb") !== chainsBefore + 1 ||
      usb.sent.filter(isPatchRecall).length !== recallsBefore + 1
    ) {
      throw new Error("USB setPatch must request the dump when the index wait times out");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 40)) {
      usb.push(packet);
    }
    const afterFirst = session.getSnapshot();
    if (afterFirst.status !== "connected" || afterFirst.chainSync !== "syncing") {
      throw new Error("USB timeout dump must stay syncing until confirmation");
    }
    await untilReady("Timeout dump did not arm confirmation", () => {
      return chainRequestCount(usb.sent, "usb") === chainsBefore + 2;
    });
  } finally {
    await session.disconnect();
  }
}

void assertUsbDumpAfterIndexTimeout().catch((error) => {
  console.error(error);
  throw error;
});

async function assertChainRefreshTimeoutClearsPatchLoad(): Promise<void> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  try {
    await connectUsbReady(session, usb, 5);
    const recallsBefore = usb.sent.filter(isPatchRecall).length;
    await session.setPatch(6);
    await sleep(RECALL_ACK_TIMEOUT_MS + 150);
    usb.push(currentPatchAt(11));
    await tick();
    const duringLoad = session.getSnapshot();
    if (duringLoad.status !== "connected" || duringLoad.patch !== 6 || duringLoad.chainSync !== "syncing") {
      throw new Error("An in-flight app recall must ignore a different current-patch");
    }
    await sleep(CHAIN_TIMEOUT_MS.usb);
    await tick();
    const timedOut = session.getSnapshot();
    if (timedOut.status !== "connected" || timedOut.patch !== 6 || timedOut.chainSync !== "idle") {
      throw new Error("Chain refresh timeout must return to idle without reverting the selected patch");
    }
    if (usb.sent.filter(isPatchRecall).length !== recallsBefore + 1) {
      throw new Error("Chain refresh timeout must not send another CC 0");
    }
    const chainsAfterTimeout = chainRequestCount(usb.sent, "usb");
    usb.push(currentPatchAt(11));
    await untilReady("Pedal current-patch after timeout did not update the index", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.patch === 11;
    });
    if (usb.sent.filter(isPatchRecall).length !== recallsBefore + 1) {
      throw new Error("A pedal current-patch after timeout must not send CC 0");
    }
    await untilReady("Pedal current-patch after timeout did not request a dump", () => {
      return chainRequestCount(usb.sent, "usb") === chainsAfterTimeout + 1;
    });
  } finally {
    await session.disconnect();
  }
}

void assertChainRefreshTimeoutClearsPatchLoad().catch((error) => {
  console.error(error);
  throw error;
});

async function assertDownloadLeavesConfirmOff(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  try {
    await connectBluetoothReady(session, bluetooth, 3);
    const before = chainRequestCount(bluetooth.sent);
    const downloadPromise = session.downloadCurrentPatch();
    await untilReady("Download did not request a chain dump", () => chainRequestCount(bluetooth.sent) === before + 1);
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      bluetooth.push(packet);
    }
    const file = await downloadPromise;
    if (!file) {
      throw new Error("Download must return a .prst when a dump is held");
    }
    await untilReady("Download refresh did not settle", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    // Download refreshes once (confirm off). A second quiet confirmation would
    // request another dump after the download dump applies.
    const after = chainRequestCount(bluetooth.sent);
    if (after !== before + 1) {
      throw new Error("Download must request one chain dump without arming confirmation");
    }
  } finally {
    await session.disconnect();
  }
}

void assertDownloadLeavesConfirmOff().catch((error) => {
  console.error(error);
  throw error;
});

function writeSignedNibbles(target: Uint8Array, at: number, value: number): void {
  const wire = value < 0 ? 0x100 + value : value;
  target[at] = (wire >> 4) & 0x0f;
  target[at + 1] = wire & 0x0f;
}

function frameSysex(
  command0: number,
  command1: number,
  length: number,
  index: number,
  payload: Uint8Array,
): Uint8Array {
  const midi = new Uint8Array(length);
  midi[0] = 0xf0;
  midi[3] = command0;
  midi[4] = command1;
  midi[5] = (index >> 4) & 0x0f;
  midi[6] = index & 0x0f;
  midi.set(payload, 9);
  midi[length - 1] = 0xf7;
  return midi;
}

/** Minimal GP-5 current-preset so the post-chain globals ask can fire. */
function gp5ChainPackets(link: "usb" | "bluetooth"): Uint8Array[] {
  if (link === "usb") {
    const merged = new Uint8Array(38 * 4 + 24);
    for (let slot = 0; slot < 10; slot += 1) {
      merged[157 + slot * 2] = slot;
    }
    const packets: Uint8Array[] = [];
    for (let index = 0; index < 4; index += 1) {
      packets.push(
        frameSysex(1, 9, 48, index, merged.subarray(index * 38, (index + 1) * 38)),
      );
    }
    packets.push(frameSysex(1, 9, 34, 4, merged.subarray(152)));
    return packets;
  }
  const merged = new Uint8Array(190 * 4 + 140);
  for (let slot = 0; slot < 10; slot += 1) {
    merged[157 + slot * 2] = slot;
  }
  const packets: Uint8Array[] = [];
  for (let index = 0; index < 4; index += 1) {
    packets.push(
      frameSysex(0, 5, 200, index, merged.subarray(index * 190, (index + 1) * 190)),
    );
  }
  packets.push(frameSysex(0, 5, 150, 4, merged.subarray(760)));
  return packets;
}

/**
 * GP-5 globals with volume nibbles at 101 (out of 0–100). Settings rows stay valid.
 * USB payload offsets are the Bluetooth F0 offsets minus 9.
 */
function gp5GlobalsPackets(link: "usb" | "bluetooth"): Uint8Array[] {
  if (link === "bluetooth") {
    const midi = new Uint8Array(164);
    midi[0] = 0xf0;
    midi[3] = 0;
    midi[4] = 1;
    midi[9] = 1;
    midi[10] = 2;
    midi[11] = 1;
    midi[163] = 0xf7;
    writeSignedNibbles(midi, 53, 101);
    writeSignedNibbles(midi, 79, 80);
    writeSignedNibbles(midi, 89, 0);
    writeSignedNibbles(midi, 99, -6);
    writeSignedNibbles(midi, 109, 2);
    writeSignedNibbles(midi, 139, 3);
    midi[150] = 0;
    midi[160] = 0;
    return [midi];
  }
  const payload = new Uint8Array(38 * 4 + 2);
  writeSignedNibbles(payload, 44, 101);
  writeSignedNibbles(payload, 70, 80);
  writeSignedNibbles(payload, 80, 0);
  writeSignedNibbles(payload, 90, -6);
  writeSignedNibbles(payload, 100, 2);
  writeSignedNibbles(payload, 130, 3);
  payload[141] = 0;
  payload[151] = 0;
  const packets: Uint8Array[] = [];
  let offset = 0;
  let index = 0;
  while (offset + 38 < payload.length) {
    packets.push(frameSysex(0, 5, 48, index, payload.subarray(offset, offset + 38)));
    offset += 38;
    index += 1;
  }
  packets.push(frameSysex(0, 5, 12, index, payload.subarray(offset)));
  return packets;
}

function liveMonitorNotify(level: number): Uint8Array {
  const midi = new Uint8Array(24);
  midi[0] = 0xf0;
  midi[3] = 0;
  midi[4] = 1;
  midi[8] = 0x07;
  midi[9] = 1;
  midi[10] = 2;
  midi[14] = 2;
  midi[16] = 4;
  const wire = level < 0 ? 0x100 + level : level;
  midi[21] = (wire >> 4) & 0x0f;
  midi[22] = wire & 0x0f;
  midi[23] = 0xf7;
  return midi;
}

function isControlChange(bytes: Uint8Array, controller: number): boolean {
  const midi = bytes[0] === 0x80 && bytes[1] === 0x80 ? bytes.subarray(2) : bytes;
  return midi.length >= 3 && (midi[0] & 0xf0) === 0xb0 && midi[1] === controller;
}

async function settleWrites(): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await tick();
  }
}

async function assertGp5GlobalsSession(): Promise<void> {
  const usb = scriptedUsb();
  const usbSession = new DeviceSession(usb.transport, stubBluetooth());
  try {
    const usbConnecting = usbSession.connect(
      { id: "usb-1", label: "GP-5", kind: "usb-midi" },
      "gp5",
    );
    await untilReady("GP-5 USB identity did not request names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await usbConnecting;
    await untilReady("GP-5 USB identity did not request current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(3));
    await untilReady("GP-5 USB session did not become ready", () => {
      const snapshot = usbSession.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    const recallsBeforeDump = usb.sent.filter(isPatchRecall).length;
    for (const packet of gp5ChainPackets("usb")) {
      usb.push(packet);
    }
    const globalsAsk = encodeGlobals("usb");
    await untilReady("GP-5 USB did not ask for globals after the chain", () => {
      return usb.sent.some((packet) => packetsEqual(packet, globalsAsk));
    });
    if (usb.sent.filter(isPatchRecall).length !== recallsBeforeDump) {
      throw new Error("The GP-5 globals ask must not send patch recall");
    }
    for (const packet of gp5GlobalsPackets("usb")) {
      usb.push(packet);
    }
    const loaded = usbSession.getSnapshot();
    if (
      loaded.status !== "connected" ||
      loaded.globals?.model !== "gp5" ||
      loaded.globals.globalVolume !== null ||
      loaded.globals.inputLevel !== 0 ||
      loaded.globals.noCab !== false ||
      loaded.globals.recLevel !== -6 ||
      loaded.globals.btRec !== 3 ||
      loaded.globals.monLevel !== 2 ||
      loaded.globals.screenBrightness !== 80 ||
      loaded.globals.footswitchMode !== "0-99" ||
      loaded.modified ||
      loaded.chainSync !== "idle"
    ) {
      throw new Error("GP-5 USB globals must fill Settings rows when volume is out of range");
    }
    usb.push(liveMonitorNotify(-6));
    const afterLive = usbSession.getSnapshot();
    if (
      afterLive.status !== "connected" ||
      afterLive.globals?.model !== "gp5" ||
      afterLive.globals.monLevel !== 2 ||
      afterLive.globals.btRec !== 3
    ) {
      throw new Error("GP-5 USB must ignore a live monitor report");
    }
    const sentBeforeWrites = usb.sent.length;
    await usbSession.setGlobalSysex("inputLevel", 6, { flush: true });
    await usbSession.setGlobalSysex("noCab", true, { flush: true });
    await usbSession.setGlobalSysex("screenBrightness", 40, { flush: true });
    await usbSession.setGp5FootswitchMode("CTL");
    await usbSession.setMasterVolume(80);
    await settleWrites();
    const written = usb.sent.slice(sentBeforeWrites);
    const inputSet = encodeGp5GlobalSetting("usb", "inputLevel", 6);
    const footSet = encodeGp5FootswitchMode("usb", "CTL");
    const afterWrite = usbSession.getSnapshot();
    if (
      !inputSet ||
      !footSet ||
      !written.some((packet) => packetsEqual(packet, inputSet[0])) ||
      !written.some((packet) => packetsEqual(packet, footSet[0])) ||
      written.some((packet) => isControlChange(packet, 1) || isControlChange(packet, 28)) ||
      afterWrite.status !== "connected" ||
      afterWrite.modified ||
      afterWrite.globals?.model !== "gp5" ||
      afterWrite.globals.inputLevel !== 6 ||
      afterWrite.globals.noCab !== true ||
      afterWrite.globals.screenBrightness !== 40 ||
      afterWrite.globals.footswitchMode !== "CTL" ||
      afterWrite.globals.globalVolume !== null
    ) {
      throw new Error("GP-5 USB Global settings writes must be SETs and must not dirty the patch");
    }
  } finally {
    await usbSession.disconnect();
  }
  if (usbSession.getSnapshot().status !== "disconnected") {
    throw new Error("Disconnect must drop GP-5 globals");
  }

  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  try {
    const bleConnecting = bleSession.connect(
      { id: "ble-1", label: "GP-5", kind: "bluetooth" },
      "gp5",
    );
    await untilReady("GP-5 Bluetooth identity did not request names", () => bluetooth.sent.length > 0);
    await tick();
    bluetooth.push(bluetoothNameList());
    await bleConnecting;
    await untilReady("GP-5 Bluetooth identity did not request current patch", () => bluetooth.sent.length > 1);
    await tick();
    bluetooth.push(currentPatchAt(4));
    await untilReady("GP-5 Bluetooth session did not become ready", () => {
      const snapshot = bleSession.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    for (const packet of gp5ChainPackets("bluetooth")) {
      bluetooth.push(packet);
    }
    const globalsAsk = encodeGlobals("bluetooth");
    await untilReady("GP-5 Bluetooth did not ask for globals after the chain", () => {
      return bluetooth.sent.some((packet) => packetsEqual(packet, globalsAsk));
    });
    for (const packet of gp5GlobalsPackets("bluetooth")) {
      bluetooth.push(packet);
    }
    const loaded = bleSession.getSnapshot();
    if (
      loaded.status !== "connected" ||
      loaded.globals?.model !== "gp5" ||
      loaded.globals.inputLevel !== 0 ||
      loaded.globals.noCab !== false ||
      loaded.globals.recLevel !== -6 ||
      loaded.globals.btRec !== 3 ||
      loaded.globals.monLevel !== 2 ||
      loaded.globals.screenBrightness !== 80 ||
      loaded.globals.footswitchMode !== "0-99" ||
      loaded.globals.globalVolume !== null ||
      loaded.modified
    ) {
      throw new Error("GP-5 Bluetooth globals must fill Settings rows when volume is out of range");
    }
    bluetooth.push(liveMonitorNotify(-6));
    const afterLive = bleSession.getSnapshot();
    if (
      afterLive.status !== "connected" ||
      afterLive.globals?.model !== "gp5" ||
      afterLive.globals.monLevel !== -6 ||
      afterLive.globals.btRec !== 3 ||
      afterLive.modified
    ) {
      throw new Error("GP-5 Bluetooth monitor report must not change BT REC or the patch");
    }
    const sentBeforeWrites = bluetooth.sent.length;
    await bleSession.setGlobalSysex("recLevel", -4, { flush: true });
    await bleSession.setGp5FootswitchMode("Tuner");
    await bleSession.setMasterVolume(50);
    await settleWrites();
    const written = bluetooth.sent.slice(sentBeforeWrites);
    const recSet = encodeGp5GlobalSetting("bluetooth", "recLevel", -4);
    const footSet = encodeGp5FootswitchMode("bluetooth", "Tuner");
    const afterWrite = bleSession.getSnapshot();
    if (
      !recSet ||
      !footSet ||
      !written.some((packet) => packetsEqual(packet, recSet[0])) ||
      !written.some((packet) => packetsEqual(packet, footSet[0])) ||
      written.some((packet) => isControlChange(packet, 1) || isControlChange(packet, 28)) ||
      afterWrite.status !== "connected" ||
      afterWrite.modified ||
      afterWrite.globals?.model !== "gp5" ||
      afterWrite.globals.recLevel !== -4 ||
      afterWrite.globals.footswitchMode !== "Tuner"
    ) {
      throw new Error("GP-5 Bluetooth Global settings writes must be SETs and must not dirty the patch");
    }
  } finally {
    await bleSession.disconnect();
  }
}

void assertGp5GlobalsSession().catch((error) => {
  console.error(error);
  throw error;
});

async function assertSilentNameListFailsConnect(): Promise<void> {
  const usb = scriptedUsb();
  const usbSession = new DeviceSession(usb.transport, stubBluetooth());
  usbSession.setNameTimeoutMsForTests({ usb: 20, bluetooth: 20 });
  let usbError: unknown;
  try {
    await usbSession.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
  } catch (cause) {
    usbError = cause;
  }
  if (
    !(usbError instanceof Error) ||
    usbError.message !== "Check that the pedal is powered on." ||
    usbSession.getSnapshot().status !== "disconnected"
  ) {
    throw new Error("USB silent name-list must fail connect with a power-on hint");
  }

  const noSysex = recordingUsb();
  const noSysexSession = new DeviceSession(noSysex.transport, stubBluetooth());
  let sysexError: unknown;
  try {
    await noSysexSession.connect({ id: "usb-2", label: "GP-50", kind: "usb-midi" }, "gp50");
  } catch (cause) {
    sysexError = cause;
  }
  if (
    !(sysexError instanceof Error) ||
    sysexError.message !== "MIDI SysEx is not available on this connection." ||
    noSysexSession.getSnapshot().status !== "disconnected"
  ) {
    throw new Error("USB without SysEx must fail connect");
  }

  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  bleSession.setNameTimeoutMsForTests({ usb: 20, bluetooth: 20 });
  let bleError: unknown;
  try {
    await bleSession.connect({ id: "ble-1", label: "GP-50", kind: "bluetooth" }, "gp50");
  } catch (cause) {
    bleError = cause;
  }
  if (
    !(bleError instanceof Error) ||
    bleError.message !== "The pedal did not respond with patch names." ||
    bleSession.getSnapshot().status !== "disconnected"
  ) {
    throw new Error("Bluetooth silent name-list must fail connect with a no-response message");
  }
}

void assertSilentNameListFailsConnect().catch((error) => {
  console.error(error);
  throw error;
});

function snapAckFrame(): Uint8Array {
  const frame = encodeSnapPayload(Uint8Array.from([0x14, 0x08, 0x00]))[0];
  if (!frame) {
    throw new Error("SnapTone ACK frame is missing");
  }
  return frame;
}

function snapUserTable(slot: number, name: string, holdsCapture = true): Uint8Array[] {
  const flags = new Uint8Array(80);
  flags.fill(1);
  if (holdsCapture) {
    flags[slot] = 0;
  }
  const names = new Uint8Array(80 * 16);
  const label = new TextEncoder().encode(name);
  names.set(label.subarray(0, 16), slot * 16);
  const payload = new Uint8Array(2 + flags.length + names.length);
  payload[0] = 0x12;
  payload[1] = 0x24;
  payload.set(flags, 2);
  payload.set(names, 2 + flags.length);
  return encodeSnapPayload(payload);
}

function isSnapTableRequest(bytes: Uint8Array): boolean {
  const frame = parseSnapSysex(bytes);
  return Boolean(
    frame?.crcOk && frame.total === 1 && frame.payload[0] === 0x12 && frame.payload[1] === 0x24,
  );
}

async function assertSnapToneUpload(): Promise<void> {
  const file = new Uint8Array(SNAP_FILE_BYTES);
  file.set([0x56, 0x54, 0x53, 0x49], 0);
  let refused = false;
  try {
    encodeSnapImportFrames(49, "NewAmp", file);
  } catch {
    refused = true;
  }
  if (!refused) {
    throw new Error("Factory slot 49 must be refused before any byte");
  }
  const preview = encodeSnapImportFrames(52, "New Amp!", file);
  if (preview.length !== 146) {
    throw new Error("A SnapTone file must use 146 frames");
  }
  const first = parseSnapSysex(preview[0] ?? new Uint8Array());
  const last = parseSnapSysex(preview[145] ?? new Uint8Array());
  if (
    !first?.crcOk ||
    first.payload.length !== 19 ||
    first.payload[0] !== 0x11 ||
    first.payload[1] !== 0x25 ||
    first.payload[6] !== 0x34 ||
    !last?.crcOk ||
    last.payload.length !== 15 ||
    preview.some((frame) => {
      const parsed = parseSnapSysex(frame);
      return !parsed?.crcOk || parsed.payload.length > 19 || (parsed.payload[0] === 0xb0 && parsed.payload[1] === 0x00);
    }) ||
    preview.some((frame) => frame[0] === 0xb0 && frame[1] === 0x00)
  ) {
    throw new Error("SnapTone frames must be checksummed 19-byte chunks without patch recall");
  }

  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  try {
    await connectBluetoothReady(bleSession, bluetooth, 0);
    const bleSnap = bleSession.getSnapshot();
    const sentBefore = bluetooth.sent.length;
    if (bleSnap.status !== "connected" || bleSnap.snapFileLink) {
      throw new Error("Bluetooth must report that it cannot accept a SnapTone file");
    }
    const blocked = await bleSession.uploadUserSnapTone(52, "NewAmp", file);
    if (blocked.ok || blocked.reason !== "link" || bluetooth.sent.length !== sentBefore) {
      throw new Error("Bluetooth must not send a SnapTone file");
    }
  } finally {
    await bleSession.disconnect();
  }

  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  let releaseAcks = false;
  let held = false;
  const usb = {
    sent,
    release() {
      releaseAcks = true;
      if (held) {
        held = false;
        handler?.(snapAckFrame());
      }
    },
    push(bytes: Uint8Array) {
      handler?.(bytes);
    },
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes: Uint8Array) => {
        sent.push(Uint8Array.from(bytes));
        const frame = parseSnapSysex(bytes);
        if (!frame?.crcOk) {
          return;
        }
        if (isSnapTableRequest(bytes)) {
          for (const part of snapUserTable(52, "NewAmp")) {
            handler?.(part);
          }
          return;
        }
        if (frame.total > 1) {
          if (releaseAcks) {
            handler?.(snapAckFrame());
          } else {
            held = true;
          }
        }
      },
      subscribe: (next: (bytes: Uint8Array) => void) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => true,
    },
  };
  const session = new DeviceSession(usb.transport, stubBluetooth());
  session.setSnapPaceForTests(0, 0, 40);
  try {
    const connecting = session.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
    await untilReady("SnapTone fixture did not ask for names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await connecting;
    await untilReady("SnapTone fixture did not ask for current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(0));
    await untilReady("SnapTone fixture did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      usb.push(packet);
    }
    await untilReady("SnapTone fixture chain did not go idle", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    const before = usb.sent.length;
    const patchBefore = session.getSnapshot();
    const factory = await session.uploadUserSnapTone(10, "NewAmp", file);
    if (factory.ok || factory.reason !== "factory" || usb.sent.length !== before) {
      throw new Error("A factory slot must be refused before any byte");
    }
    const pending = session.uploadUserSnapTone(52, "New Amp!", file);
    const during = session.getSnapshot();
    if (
      during.status !== "connected" ||
      !during.snapFileSend ||
      during.chainSync === "syncing" ||
      during.patch !== (patchBefore.status === "connected" ? patchBefore.patch : -1)
    ) {
      throw new Error("A SnapTone send must not look like a chain refresh or change the patch");
    }
    const saved = await session.savePatch();
    if (saved !== "busy") {
      throw new Error("Save during a SnapTone send must return busy");
    }
    usb.release();
    const result = await pending;
    if (!result.ok || result.name !== "NewAmp") {
      throw new Error("The refreshed slot name must match the submitted name");
    }
    const after = session.getSnapshot();
    const importFrames = usb.sent.slice(before).filter((bytes) => {
      const frame = parseSnapSysex(bytes);
      return Boolean(frame?.crcOk && frame.total > 1);
    });
    const tables = usb.sent.slice(before).filter(isSnapTableRequest);
    if (
      after.status !== "connected" ||
      after.chainSync === "syncing" ||
      after.userSnapSlots[2]?.name !== "NewAmp" ||
      after.userSnapSlots[2]?.flag !== 0 ||
      after.patch !== (patchBefore.status === "connected" ? patchBefore.patch : -1) ||
      importFrames.length !== 146 ||
      tables.length !== 1 ||
      importFrames.some((frame) => frame[0] === 0xb0 && frame[1] === 0x00)
    ) {
      throw new Error("A finished SnapTone write must checksum 146 frames and read the slot table once");
    }
    const tablesAfterWrite = tables.length;
    void session.setPatch(1).catch(() => undefined);
    await tick();
    await tick();
    if (usb.sent.filter(isSnapTableRequest).length !== tablesAfterWrite) {
      throw new Error("A patch change must not request the SnapTone table again");
    }
  } finally {
    await session.disconnect();
  }
}

void assertSnapToneUpload().catch((error) => {
  console.error(error);
  throw error;
});

function userIrTable(slot: number | null, name: string): Uint8Array[] {
  const flags = new Uint8Array(20).fill(1);
  const names = new Uint8Array(20 * 16);
  for (let index = 0; index < 20; index += 1) {
    const label = new TextEncoder().encode(`User IR ${index + 1}`);
    names.set(label, index * 16);
  }
  if (slot !== null) {
    flags[slot - 1] = 0;
    names.fill(0, (slot - 1) * 16, slot * 16);
    names.set(new TextEncoder().encode(name).subarray(0, 16), (slot - 1) * 16);
  }
  const payload = new Uint8Array(2 + flags.length + names.length);
  payload[0] = 0x12;
  payload[1] = 0x20;
  payload.set(flags, 2);
  payload.set(names, 2 + flags.length);
  return encodeSnapPayload(payload);
}

function isUserIrTableRequest(bytes: Uint8Array): boolean {
  const frame = parseSnapSysex(bytes);
  return Boolean(
    frame?.crcOk && frame.total === 1 && frame.payload[0] === 0x12 && frame.payload[1] === 0x20,
  );
}

function assertUserIrWires(): void {
  if (sanitizeUserIrName("Greenback 412.wav") !== "Greenback " || sanitizeUserIrName("$$$") !== "X") {
    throw new Error("User IR names keep Suite's printable set, cut to 10, and blank becomes X");
  }
  const data = new Uint8Array(USER_IR_DATA_BYTES);
  for (const slot of [0, 21, 2.5]) {
    let refused = false;
    try {
      encodeUserIrImportFrames(slot, "Cab", data);
    } catch {
      refused = true;
    }
    if (!refused) {
      throw new Error(`User IR import must refuse slot ${slot}`);
    }
  }
  const frames = encodeUserIrImportFrames(3, "Greenback", data);
  if (frames.length !== 112) {
    throw new Error("A User IR import must use 112 frames");
  }
  const first = parseSnapSysex(frames[0] ?? new Uint8Array());
  const last = parseSnapSysex(frames[111] ?? new Uint8Array());
  // fxId of User IR 03 is the CAB wire 02 00 10 0a.
  if (
    !first?.crcOk ||
    first.total !== 112 ||
    first.payload[0] !== 0x11 ||
    first.payload[1] !== 0x21 ||
    first.payload[6] !== 0x02 ||
    first.payload[7] !== 0x00 ||
    first.payload[8] !== 0x10 ||
    first.payload[9] !== 0x0a ||
    !last?.crcOk ||
    last.payload.length !== 2122 - 111 * 19
  ) {
    throw new Error("User IR 03 import must be 11 21 with fxId 0x0A100002 in 19-byte frames");
  }
  const request = parseSnapSysex(encodeUserIrTableRequest());
  if (
    !request?.crcOk ||
    request.payload[0] !== 0x12 ||
    request.payload[1] !== 0x20 ||
    !packetsEqual(encodeUserIrTableRequest(), encodeIrNames("usb"))
  ) {
    throw new Error("User IR table request must be 12 20, the same bytes as the USB IR-name ask");
  }
  const parts = userIrTable(3, "Greenback");
  const merged = parts.flatMap((part) => [...(parseSnapSysex(part)?.payload ?? [])]);
  const table = decodeUserIrTable(Uint8Array.from(merged));
  if (
    !table ||
    table.length !== 20 ||
    table[2]?.flag !== 0 ||
    table[2]?.name !== "Greenback" ||
    table[0]?.flag !== 1 ||
    table[0]?.name !== "User IR 1"
  ) {
    throw new Error("User IR table must decode 20 flags and names");
  }
}

assertUserIrWires();

async function assertUserIrWav(): Promise<void> {
  // 24-bit 44.1 kHz goes through untouched; longer than 512 samples is truncated.
  const long = Array.from({ length: 600 }, (_, index) => (index === 0 ? 0x7fffff : index === 1 ? -0x800000 : index));
  const direct = await prepareUserIr(encodeTestWav(long, 44_100, 24));
  const view = new DataView(direct.data.buffer);
  if (
    direct.data.length !== 2048 ||
    !direct.truncated ||
    view.getInt32(0, true) !== 0x7fffff ||
    view.getInt32(4, true) !== -0x800000 ||
    view.getInt32(511 * 4, true) !== 511
  ) {
    throw new Error("A 24-bit 44.1 kHz IR must reach the pedal untouched and cut at 512 samples");
  }
  // Longer file whose tail is silence: cut, but nothing worth mentioning.
  const quietTail = Array.from({ length: 2048 }, (_, index) => (index < 64 ? 0x400000 >> (index >> 3) : 0));
  const quiet = await prepareUserIr(encodeTestWav(quietTail, 44_100, 24));
  if (!quiet.truncated || quiet.audibleCut || quiet.cutDb !== -Infinity) {
    throw new Error("A silent tail past 512 samples must not count as an audible cut");
  }
  // A loud tail is worth mentioning.
  const loud = Array.from({ length: 2048 }, (_, index) => (index % 100 === 0 ? 0x400000 : 0));
  const loudIr = await prepareUserIr(encodeTestWav(loud, 44_100, 24));
  if (!loudIr.audibleCut || loudIr.cutDb === null || loudIr.cutDb < -6) {
    throw new Error("A loud tail past 512 samples must count as an audible cut");
  }
  // A faint tail (about -70 dB) is not worth mentioning.
  const faint = Array.from({ length: 2048 }, (_, index) => (index === 0 ? 0x7fffff : index === 1000 ? 0x0a00 : 0));
  const faintIr = await prepareUserIr(encodeTestWav(faint, 44_100, 24));
  if (faintIr.audibleCut || faintIr.cutDb === null || faintIr.cutDb > -60) {
    throw new Error("A tail below -60 dB must not count as an audible cut");
  }
  // 16-bit shorter IR: scaled to 24-bit, zero-padded.
  const short = await prepareUserIr(encodeTestWav([0x4000, -0x4000], 44_100, 16));
  const shortView = new DataView(short.data.buffer);
  if (
    short.truncated ||
    short.audibleCut ||
    short.cutDb !== null ||
    shortView.getInt32(0, true) !== 0x400000 ||
    shortView.getInt32(4, true) !== -0x400000 ||
    shortView.getInt32(8, true) !== 0
  ) {
    throw new Error("A 16-bit IR must scale to 24-bit and pad with silence");
  }
  // 48 kHz goes through the resampler and keeps 512 samples.
  const impulse = Array.from({ length: 1024 }, (_, index) => (index === 0 ? 0x7fffff : 0));
  const resampled = await prepareUserIr(encodeTestWav(impulse, 48_000, 24));
  if (resampled.data.length !== 2048 || resampled.sourceRate !== 48_000 || !resampled.truncated) {
    throw new Error("A 48 kHz IR must resample to 512 samples at 44.1 kHz");
  }
  let rejected = false;
  try {
    await prepareUserIr(new TextEncoder().encode("not a wav file at all"));
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("A non-WAV file must be rejected");
  }
}

void assertUserIrWav().catch((error) => {
  console.error(error);
  throw error;
});

async function assertUserIrUpload(): Promise<void> {
  const data = new Uint8Array(USER_IR_DATA_BYTES);
  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  try {
    await connectBluetoothReady(bleSession, bluetooth, 0);
    const sentBefore = bluetooth.sent.length;
    const blocked = await bleSession.uploadUserIr(3, "Cab", data);
    if (blocked.ok || blocked.reason !== "link" || bluetooth.sent.length !== sentBefore) {
      throw new Error("Bluetooth must not send a User IR file");
    }
  } finally {
    await bleSession.disconnect();
  }

  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  let stored: string | null = null;
  const usb = {
    sent,
    push(bytes: Uint8Array) {
      handler?.(bytes);
    },
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes: Uint8Array) => {
        sent.push(Uint8Array.from(bytes));
        const frame = parseSnapSysex(bytes);
        if (!frame?.crcOk) {
          return;
        }
        if (isUserIrTableRequest(bytes)) {
          for (const part of userIrTable(stored === null ? null : 3, stored ?? "")) {
            handler?.(part);
          }
          return;
        }
        if (frame.total > 1) {
          if (frame.index === frame.total - 1) {
            stored = "Greenback";
          }
          handler?.(snapAckFrame());
        }
      },
      subscribe: (next: (bytes: Uint8Array) => void) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => true,
    },
  };
  const session = new DeviceSession(usb.transport, stubBluetooth());
  session.setSnapPaceForTests(0, 0, 40);
  try {
    const connecting = session.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
    await untilReady("User IR fixture did not ask for names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await connecting;
    await untilReady("User IR fixture did not ask for current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(0));
    await untilReady("User IR fixture did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x02, 0x00, 0x10, 0x0a]), 50)) {
      usb.push(packet);
    }
    await untilReady("User IR fixture chain did not go idle", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    await untilReady("User IR fixture did not apply the connect-time IR table", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.userIrSlots[2]?.flag === 1;
    });
    const read = await session.refreshUserIrSlots();
    if (!read || read[2]?.flag !== 1) {
      throw new Error("Reading the User IR table must report slot 3 empty before the upload");
    }
    const before = usb.sent.length;
    const patchBefore = session.getSnapshot();
    const refused = await session.uploadUserIr(21, "Cab", data);
    if (refused.ok || refused.reason !== "slot" || usb.sent.length !== before) {
      throw new Error("User IR slot 21 must be refused before any byte");
    }
    const pending = session.uploadUserIr(3, "Greenback.wav", data);
    const during = session.getSnapshot();
    if (during.status !== "connected" || !during.snapFileSend || during.chainSync === "syncing") {
      throw new Error("A User IR send must block writes without looking like a chain refresh");
    }
    if ((await session.savePatch()) !== "busy") {
      throw new Error("Save during a User IR send must return busy");
    }
    const result = await pending;
    if (!result.ok || result.name !== "Greenback") {
      throw new Error("A finished User IR write must verify the stored name");
    }
    const after = session.getSnapshot();
    const importFrames = usb.sent.slice(before).filter((bytes) => {
      const frame = parseSnapSysex(bytes);
      return Boolean(frame?.crcOk && frame.total > 1);
    });
    if (
      after.status !== "connected" ||
      after.snapFileSend ||
      after.userIrSlots[2]?.flag !== 0 ||
      after.userIrNames[2] !== "Greenback" ||
      after.patch !== (patchBefore.status === "connected" ? patchBefore.patch : -1) ||
      importFrames.length !== 112 ||
      usb.sent.slice(before).filter(isUserIrTableRequest).length !== 1 ||
      usb.sent.slice(before).some((bytes) => bytes[0] === 0xb0 && bytes[1] === 0x00)
    ) {
      throw new Error("A User IR write must send 112 frames, read the table once, and refresh the IR name");
    }
  } finally {
    await session.disconnect();
  }
}

void assertUserIrUpload().catch((error) => {
  console.error(error);
  throw error;
});

const SNAP_DELETE_NOTIFY = bytesFromHex("F00C0E0001000000060102010B0003000000000000F7");

function packedBody(wire: Uint8Array): number[] {
  const body: number[] = [];
  for (let index = 1; index + 1 < wire.length; index += 2) {
    body.push((((wire[index] ?? 0) & 0x0f) << 4) | ((wire[index + 1] ?? 0) & 0x0f));
  }
  return body;
}

function packedHas(body: number[], first: number, second: number): boolean {
  for (let index = 0; index < body.length - 1; index += 1) {
    if (body[index] === first && body[index + 1] === second) {
      return true;
    }
  }
  return false;
}

function assertSnapDeleteWires(): void {
  const captured: Record<number, string> = {
    77: "f0000700010000000601010207040d00000000000ff7",
    78: "f0030d00010000000601010207040e00000000000ff7",
    79: "f0020b00010000000601010207040f00000000000ff7",
  };
  for (const slot of [49, 80, 49.5]) {
    let refused = false;
    try {
      encodeUserSnapDelete(slot);
    } catch {
      refused = true;
    }
    if (!refused) {
      throw new Error(`SnapTone delete must refuse slot ${slot} before any byte`);
    }
  }
  for (let slot = 50; slot <= 79; slot += 1) {
    const wire = encodeUserSnapDelete(slot);
    const body = packedBody(wire);
    const frame = parseSnapSysex(wire);
    const fxId = 0x0f000000 + slot;
    const hex = [...wire].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (
      !frame?.crcOk ||
      frame.payload.length !== 6 ||
      frame.payload[0] !== 0x11 ||
      frame.payload[1] !== 0x27 ||
      frame.payload[2] !== (fxId & 0xff) ||
      frame.payload[3] !== 0x00 ||
      frame.payload[4] !== 0x00 ||
      frame.payload[5] !== 0x0f ||
      packedHas(body, 0x11, 0x26) ||
      packedHas(body, 0x12, 0x1b) ||
      packetsEqual(wire, SNAP_DELETE_NOTIFY) ||
      (captured[slot] !== undefined && hex !== captured[slot])
    ) {
      throw new Error(`SnapTone delete for slot ${slot} must be the captured 11 27 SET`);
    }
  }
}

assertSnapDeleteWires();

async function assertSnapToneDelete(): Promise<void> {
  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  try {
    await connectBluetoothReady(bleSession, bluetooth, 0);
    const sentBefore = bluetooth.sent.length;
    const blocked = await bleSession.deleteUserSnapTone(77);
    if (blocked.ok || blocked.reason !== "link" || bluetooth.sent.length !== sentBefore) {
      throw new Error("Bluetooth must not send a SnapTone delete");
    }
  } finally {
    await bleSession.disconnect();
  }

  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  let ackDeletes = false;
  let tableHolds = true;
  let deleteNotified = false;
  let tablesBeforeDeleteNotify = 0;
  const usb = {
    sent,
    push(bytes: Uint8Array) {
      handler?.(bytes);
    },
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes: Uint8Array) => {
        sent.push(Uint8Array.from(bytes));
        if (isSnapTableRequest(bytes)) {
          if (ackDeletes && !deleteNotified) {
            tablesBeforeDeleteNotify += 1;
          }
          const cleared = deleteNotified && !tableHolds;
          const parts = cleared ? snapUserTable(77, "Empty 28", false) : snapUserTable(77, "Keep");
          for (const part of parts) {
            handler?.(part);
          }
          return;
        }
        if (ackDeletes && packetsEqual(bytes, encodeUserSnapDelete(77))) {
          handler?.(commandReceivedAckFixture());
          setTimeout(() => {
            deleteNotified = true;
            handler?.(SNAP_DELETE_NOTIFY);
          }, 20);
        }
      },
      subscribe: (next: (bytes: Uint8Array) => void) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => true,
    },
  };
  const session = new DeviceSession(usb.transport, stubBluetooth());
  session.setSnapPaceForTests(0, 0, 40);
  try {
    const connecting = session.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
    await untilReady("SnapTone delete fixture did not ask for names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await connecting;
    await untilReady("SnapTone delete fixture did not ask for current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(0));
    await untilReady("SnapTone delete fixture did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      usb.push(packet);
    }
    await untilReady("SnapTone delete fixture chain did not go idle", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    for (const part of snapUserTable(77, "Keep")) {
      usb.push(part);
    }
    const seeded = session.getSnapshot();
    if (
      seeded.status !== "connected" ||
      seeded.userSnapSlots[27]?.name !== "Keep" ||
      seeded.userSnapSlots[27]?.flag !== 0
    ) {
      throw new Error("SnapTone delete fixture did not keep the seeded capture");
    }
    const notify = parseSnapSysex(SNAP_DELETE_NOTIFY);
    usb.push(SNAP_DELETE_NOTIFY);
    const afterNotify = session.getSnapshot();
    if (
      !notify?.crcOk ||
      notify.payload[0] !== 0x12 ||
      notify.payload[1] !== 0x1b ||
      afterNotify.status !== "connected" ||
      afterNotify.userSnapSlots[27]?.name !== "Keep" ||
      afterNotify.userSnapSlots[27]?.flag !== 0
    ) {
      throw new Error("The pedal 12 1B notify must not clear a SnapTone slot");
    }
    const patchBefore = seeded.patch;
    const beforeFactory = usb.sent.length;
    const factory = await session.deleteUserSnapTone(10);
    if (factory.ok || factory.reason !== "factory" || usb.sent.length !== beforeFactory) {
      throw new Error("A factory slot must be refused before any delete byte");
    }

    const beforeMiss = usb.sent.length;
    const missed = session.deleteUserSnapTone(77);
    const during = session.getSnapshot();
    const nested = await session.deleteUserSnapTone(78);
    const saved = await session.savePatch();
    if (
      during.status !== "connected" ||
      !during.snapFileSend ||
      during.chainSync !== "idle" ||
      during.patch !== patchBefore ||
      nested.ok ||
      nested.reason !== "busy" ||
      saved !== "busy"
    ) {
      throw new Error("A SnapTone delete must busy other writes without a chain refresh");
    }
    const missedResult = await missed;
    const unknown = session.getSnapshot();
    const missSent = usb.sent.slice(beforeMiss);
    const missDeletes = missSent.filter((bytes) => packetsEqual(bytes, encodeUserSnapDelete(77)));
    if (
      missedResult.ok ||
      missedResult.reason !== "verify" ||
      unknown.status !== "connected" ||
      unknown.userSnapSlots[27]?.name !== null ||
      unknown.userSnapSlots[27]?.flag !== null ||
      unknown.chainSync !== "idle" ||
      missDeletes.length !== 1 ||
      missSent.some(isSnapTableRequest) ||
      missSent.some((bytes) => packedHas(packedBody(bytes), 0x11, 0x26)) ||
      missSent.some((bytes) => packetsEqual(bytes, SNAP_DELETE_NOTIFY))
    ) {
      throw new Error("A missing delete ACK must leave the slot unknown and send only the SET");
    }

    ackDeletes = true;
    tableHolds = false;
    deleteNotified = false;
    tablesBeforeDeleteNotify = 0;
    const beforeHit = usb.sent.length;
    const cleared = await session.deleteUserSnapTone(77);
    const after = session.getSnapshot();
    const hitSent = usb.sent.slice(beforeHit);
    const hitDeletes = hitSent.filter((bytes) => packetsEqual(bytes, encodeUserSnapDelete(77)));
    const hitTables = hitSent.filter(isSnapTableRequest);
    if (
      !cleared.ok ||
      after.status !== "connected" ||
      after.chainSync !== "idle" ||
      after.patch !== patchBefore ||
      after.userSnapSlots[27]?.name !== "Empty 28" ||
      after.userSnapSlots[27]?.flag === 0 ||
      after.userSnapSlots[27]?.flag == null ||
      hitDeletes.length !== 1 ||
      tablesBeforeDeleteNotify !== 0 ||
      hitTables.length !== 1 ||
      hitSent.some((bytes) => packedHas(packedBody(bytes), 0x11, 0x26)) ||
      hitSent.some((bytes) => packetsEqual(bytes, SNAP_DELETE_NOTIFY))
    ) {
      throw new Error("A deleted SnapTone must refresh from the slot table");
    }
  } finally {
    await session.disconnect();
  }
}

void assertSnapToneDelete().catch((error) => {
  console.error(error);
  throw error;
});

const SNAP_RENAME_79 = bytesFromHex(
  "f00b0f00020000010301010206040f00000000000f0504060507030704030703090000000000000000000000000000f7",
);

function assertSnapRenameWires(): void {
  for (const slot of [49, 80, 49.5]) {
    let refused = false;
    try {
      encodeUserSnapRename(slot, "Test79");
    } catch {
      refused = true;
    }
    if (!refused) {
      throw new Error(`SnapTone rename must refuse slot ${slot} before any byte`);
    }
  }
  const captured = encodeUserSnapRename(79, "Test79");
  const lead = encodeUserSnapRename(79, "Lead Ch$");
  const empty = encodeUserSnapRename(52, "$$$");
  const leadFrame = parseSnapSysex(lead);
  const emptyFrame = parseSnapSysex(empty);
  const leadName = leadFrame?.payload.subarray(6, 19);
  const emptyName = emptyFrame?.payload.subarray(6, 19);
  if (
    !packetsEqual(captured, SNAP_RENAME_79) ||
    !leadFrame?.crcOk ||
    leadFrame.payload.length !== 19 ||
    leadFrame.payload[0] !== 0x11 ||
    leadFrame.payload[1] !== 0x26 ||
    leadFrame.payload[2] !== 0x4f ||
    leadName?.[0] !== 0x4c ||
    leadName?.[1] !== 0x65 ||
    leadName?.[2] !== 0x61 ||
    leadName?.[3] !== 0x64 ||
    leadName?.[4] !== 0x43 ||
    leadName?.[5] !== 0x68 ||
    leadName?.[6] !== 0x00 ||
    !emptyFrame?.crcOk ||
    emptyName?.[0] !== 0x58 ||
    emptyName?.[1] !== 0x00 ||
    packedHas(packedBody(captured), 0x11, 0x27) ||
    packedHas(packedBody(captured), 0x12, 0x1b) ||
    captured.length > 80 ||
    !packetsEqual(encodeUserSnapRenameCommit(), bytesFromHex("f0000a000200010003000000000000f7"))
  ) {
    throw new Error("SnapTone rename must be the captured 11 26 SET with a 13-byte name");
  }
}

assertSnapRenameWires();

function snapRenameTable(slot79: string): Uint8Array[] {
  const flags = new Uint8Array(80);
  flags.fill(1);
  flags[79] = 0;
  const names = new Uint8Array(80 * 16);
  const encoder = new TextEncoder();
  names.set(encoder.encode("Empty"), 50 * 16);
  names.set(encoder.encode(slot79), 79 * 16);
  const payload = new Uint8Array(2 + flags.length + names.length);
  payload[0] = 0x12;
  payload[1] = 0x24;
  payload.set(flags, 2);
  payload.set(names, 2 + flags.length);
  return encodeSnapPayload(payload);
}

async function assertSnapToneRename(): Promise<void> {
  const bluetooth = scriptedBluetooth();
  const bleSession = new DeviceSession(recordingUsb().transport, bluetooth.link);
  try {
    await connectBluetoothReady(bleSession, bluetooth, 0);
    const sentBefore = bluetooth.sent.length;
    const blocked = await bleSession.renameUserSnapTone(79, "Test79");
    if (blocked.ok || blocked.reason !== "link" || bluetooth.sent.length !== sentBefore) {
      throw new Error("Bluetooth must not send a SnapTone rename");
    }
  } finally {
    await bleSession.disconnect();
  }

  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  let ackRenames = false;
  let notified = false;
  let tablesBeforeNotify = 0;
  let tableName = "JVMOD1Gree";
  const renamed = () => encodeUserSnapRename(79, "Lead Ch$");
  const commit = encodeUserSnapRenameCommit();
  const usb = {
    sent,
    push(bytes: Uint8Array) {
      handler?.(bytes);
    },
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes: Uint8Array) => {
        sent.push(Uint8Array.from(bytes));
        if (isSnapTableRequest(bytes)) {
          if (!notified) {
            tablesBeforeNotify += 1;
          }
          for (const part of snapRenameTable(notified ? tableName : "JVMOD1Gree")) {
            handler?.(part);
          }
          return;
        }
        if (ackRenames && packetsEqual(bytes, renamed())) {
          handler?.(commandReceivedAckFixture());
          return;
        }
        if (ackRenames && packetsEqual(bytes, commit)) {
          handler?.(commandReceivedAckFixture());
          notified = true;
          handler?.(SNAP_DELETE_NOTIFY);
        }
      },
      subscribe: (next: (bytes: Uint8Array) => void) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => true,
    },
  };
  const session = new DeviceSession(usb.transport, stubBluetooth());
  session.setSnapPaceForTests(0, 0, 40);
  try {
    const connecting = session.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
    await untilReady("SnapTone rename fixture did not ask for names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await connecting;
    await untilReady("SnapTone rename fixture did not ask for current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(0));
    await untilReady("SnapTone rename fixture did not become ready", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready";
    });
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      usb.push(packet);
    }
    await untilReady("SnapTone rename fixture chain did not go idle", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.chainSync === "idle";
    });
    for (const part of snapRenameTable("JVMOD1Gree")) {
      usb.push(part);
    }
    const seeded = session.getSnapshot();
    if (
      seeded.status !== "connected" ||
      seeded.userSnapSlots[29]?.name !== "JVMOD1Gree" ||
      seeded.userSnapSlots[29]?.flag !== 0 ||
      seeded.userSnapSlots[0]?.name !== "Empty" ||
      seeded.userSnapSlots[0]?.flag === 0
    ) {
      throw new Error("SnapTone rename fixture did not seed slot 79");
    }
    const patchBefore = seeded.patch;
    const beforeFactory = usb.sent.length;
    const factory = await session.renameUserSnapTone(10, "LeadCh");
    const beforeEmpty = usb.sent.length;
    const emptySlot = await session.renameUserSnapTone(50, "LeadCh");
    if (
      factory.ok ||
      factory.reason !== "factory" ||
      emptySlot.ok ||
      emptySlot.reason !== "empty" ||
      usb.sent.length !== beforeFactory ||
      usb.sent.length !== beforeEmpty
    ) {
      throw new Error("Factory and empty SnapTone slots must be refused before any rename byte");
    }

    const beforeMiss = usb.sent.length;
    const missed = session.renameUserSnapTone(79, "Lead Ch$");
    const during = session.getSnapshot();
    const nested = await session.renameUserSnapTone(79, "Other");
    const saved = await session.savePatch();
    if (
      during.status !== "connected" ||
      !during.snapFileSend ||
      during.chainSync !== "idle" ||
      during.patch !== patchBefore ||
      nested.ok ||
      nested.reason !== "busy" ||
      saved !== "busy"
    ) {
      throw new Error("A SnapTone rename must busy other writes without a chain refresh");
    }
    const missedResult = await missed;
    const unknown = session.getSnapshot();
    const missSent = usb.sent.slice(beforeMiss);
    const missRenames = missSent.filter((bytes) => packetsEqual(bytes, renamed()));
    if (
      missedResult.ok ||
      missedResult.reason !== "verify" ||
      unknown.status !== "connected" ||
      unknown.userSnapSlots[29]?.name !== null ||
      unknown.userSnapSlots[29]?.flag !== null ||
      unknown.chainSync !== "idle" ||
      missRenames.length !== 1 ||
      missSent.some(isSnapTableRequest) ||
      missSent.some((bytes) => packedHas(packedBody(bytes), 0x11, 0x27)) ||
      missSent.some((bytes) => packedHas(packedBody(bytes), 0x12, 0x1b)) ||
      missSent.some((bytes) => packedHas(packedBody(bytes), 0x12, 0x1c)) ||
      missSent.some((bytes) => packedHas(packedBody(bytes), 0x02, 0x01)) ||
      missSent.some((bytes) => bytes[0] === 0xb0 && bytes[1] === 0x00)
    ) {
      throw new Error("A missing rename ACK must leave the slot unknown and send only the SET");
    }
    for (const part of snapRenameTable("JVMOD1Gree")) {
      usb.push(part);
    }

    ackRenames = true;
    tableName = "LeadCh";
    notified = false;
    tablesBeforeNotify = 0;
    const beforeHit = usb.sent.length;
    const renamedSlot = await session.renameUserSnapTone(79, "Lead Ch$");
    const after = session.getSnapshot();
    const hitSent = usb.sent.slice(beforeHit);
    const hitRenames = hitSent.filter((bytes) => packetsEqual(bytes, renamed()));
    const hitTables = hitSent.filter(isSnapTableRequest);
    if (
      !renamedSlot.ok ||
      renamedSlot.name !== "LeadCh" ||
      after.status !== "connected" ||
      after.chainSync !== "idle" ||
      after.patch !== patchBefore ||
      after.userSnapSlots[29]?.name !== "LeadCh" ||
      after.userSnapSlots[29]?.flag !== 0 ||
      hitRenames.length !== 1 ||
      hitSent.filter((bytes) => packetsEqual(bytes, commit)).length !== 1 ||
      tablesBeforeNotify !== 0 ||
      hitTables.length !== 1 ||
      hitSent.some((bytes) => packedHas(packedBody(bytes), 0x11, 0x27)) ||
      hitSent.some((bytes) => packedHas(packedBody(bytes), 0x12, 0x1b)) ||
      hitSent.some((bytes) => packedHas(packedBody(bytes), 0x12, 0x1c)) ||
      hitSent.some((bytes) => bytes[0] === 0xb0 && bytes[1] === 0x00)
    ) {
      throw new Error("A renamed SnapTone must refresh to the sanitized name from the slot table");
    }
  } finally {
    await session.disconnect();
  }
}

void assertSnapToneRename().catch((error) => {
  console.error(error);
  throw error;
});


