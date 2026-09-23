import type { BluetoothLink } from "@/bluetooth/types";
import { decodePresetDump } from "@/device/chain-codec";
import {
  encodeChainOrder,
  encodeIrNames,
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
    discover: async () => [],
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
  return midi[0] === 0xb0 && midi[1] === 0x00;
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
    await untilReady("Ready state waited for the IR-name dump", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready" && irCount() === 1;
    });
    const beforeNames = session.getSnapshot();
    if (beforeNames.status !== "connected" || beforeNames.userIrNames.some((name) => name !== null)) {
      throw new Error("IR names must stay empty until the dump arrives");
    }
    if (bluetooth.sent.some(isPatchRecall)) {
      throw new Error("Connect must not send patch recall to load IR names");
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
    const afterChain = session.getSnapshot();
    const cab = afterChain.status === "connected" ? afterChain.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      afterChain.status !== "connected" ||
      afterChain.userIrNames[2] !== "Greenback 412" ||
      afterChain.chainSync !== "idle" ||
      cab?.modelId !== "cab-twd-cp-1x8" ||
      cab.values?.[0] !== 50
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


