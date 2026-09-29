import type { BluetoothLink } from "@/bluetooth/types";
import { decodePresetDump } from "@/device/chain-codec";
import { commandReceivedAckFixture, RECALL_ACK_TIMEOUT_MS } from "@/device/command-ack";
import {
  encodeChainOrder,
  encodeIdentity,
  encodeIrNames,
  encodeChainRequest,
  encodePatch,
  encodePatchStore,
  encodeSlotModel,
} from "@/device/encode";
import { emptyUserIrNames, encodeIrNameDump, USER_IR_COUNT } from "@/device/ir-names";
import { decodePrstFile } from "@/device/patch-store";
import { GP5_TOB_PRST_HEX, GP50_TOB_PRST_HEX } from "@/device/prst-tob-fixtures";
import { DeviceSession } from "./device-session";
import type { MidiTransport } from "@/midi/types";

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
  };
}

async function assertUploadRejectsWithoutMidi(): Promise<void> {
  const usb = recordingUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  await session.connect(
    { id: "usb-1", label: "GP-50", kind: "usb-midi" },
    "gp50",
  );
  const sentAfterConnect = usb.sent.length;
  const invalid = await session.uploadCurrentPatch(new Uint8Array([0x00, 0x01, 0x02]));
  const wrong = await session.uploadCurrentPatch(bytesFromHex(GP5_TOB_PRST_HEX));
  const disconnected = await new DeviceSession(
    recordingUsb().transport,
    stubBluetooth(),
  ).uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (invalid.ok || invalid.reason !== "invalid") {
    throw new Error("Invalid bytes must return without sending MIDI");
  }
  if (wrong.ok || wrong.reason !== "wrong-model") {
    throw new Error("Wrong-model bytes must return without sending MIDI");
  }
  if (disconnected.ok || disconnected.reason !== "disconnected") {
    throw new Error("Disconnected upload must no-op");
  }
  if (usb.sent.length !== sentAfterConnect) {
    throw new Error("Rejected upload must not send MIDI");
  }
}

void assertUploadRejectsWithoutMidi();

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
    await session.connect({ id: "ble-1", label: "GP-50", kind: "bluetooth" }, "gp50");
    await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
    await tick();
    bluetooth.push(bluetoothNameList());
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
    for (const packet of encodeIrNameDump(named)) {
      bluetooth.push(packet);
    }
    const namedSnapshot = session.getSnapshot();
    if (
      namedSnapshot.status !== "connected" ||
      namedSnapshot.userIrNames[2] !== "Greenback 412" ||
      namedSnapshot.userIrNames[6] !== null ||
      namedSnapshot.userIrNames.length !== USER_IR_COUNT ||
      namedSnapshot.sync !== "ready" ||
      bluetooth.sent.length !== sentBeforeDump
    ) {
      throw new Error("IR-name dump must fill slot 03 without another request or patch recall");
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
  await session.connect({ id: "ble-1", label: "GP-50", kind: "bluetooth" }, "gp50");
  await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
  await tick();
  bluetooth.push(bluetoothNameList());
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

async function assertUsbPatchConfirmHoldsSyncing(): Promise<void> {
  const usb = scriptedUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  try {
    await session.connect({ id: "usb-1", label: "GP-50", kind: "usb-midi" }, "gp50");
    await untilReady("USB identity did not request names", () => usb.sent.length > 0);
    await tick();
    usb.push(usbNameList());
    await untilReady("USB identity did not request current patch", () => usb.sent.length > 1);
    await tick();
    usb.push(currentPatchAt(5));
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
    const chainsBefore = chainRequestCount(usb.sent, "usb");
    const recallsBefore = usb.sent.filter(isPatchRecall).length;
    await session.setPatch(6);
    const afterRecall = session.getSnapshot();
    if (
      afterRecall.status !== "connected" ||
      afterRecall.patch !== 6 ||
      chainRequestCount(usb.sent, "usb") !== chainsBefore + 1 ||
      usb.sent.filter(isPatchRecall).length !== recallsBefore + 1
    ) {
      throw new Error("USB setPatch must send CC 0 and request the dump immediately when idle");
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


