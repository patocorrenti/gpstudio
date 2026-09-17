import {
  CONTROL_CHARACTERISTIC_UUID,
  CONTROL_SERVICE_UUID,
} from "@/bluetooth/uuids";
import { looksLikePedalName, suggestModelFromLabel } from "@/device/models";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";

type BluetoothRemoteGattCharacteristicLike = {
  uuid: string;
  properties: {
    read?: boolean;
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
    indicate?: boolean;
  };
  startNotifications: () => Promise<BluetoothRemoteGattCharacteristicLike>;
  writeValueWithoutResponse: (data: Uint8Array) => Promise<void>;
  writeValue: (data: Uint8Array) => Promise<void>;
  addEventListener: (
    type: "characteristicvaluechanged",
    listener: (event: { target: { value?: DataView } }) => void,
  ) => void;
};

type BluetoothRemoteGattServiceLike = {
  uuid: string;
  getCharacteristic: (
    uuid: string,
  ) => Promise<BluetoothRemoteGattCharacteristicLike>;
  getCharacteristics: () => Promise<BluetoothRemoteGattCharacteristicLike[]>;
};

type BluetoothRemoteGattServerLike = {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGattServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGattServiceLike>;
  getPrimaryServices: () => Promise<BluetoothRemoteGattServiceLike[]>;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string | null;
  gatt?: BluetoothRemoteGattServerLike | null;
};

type BluetoothApi = {
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
  requestDevice: (options: {
    filters: Array<{ namePrefix?: string; services?: string[] }>;
    optionalServices?: string[];
  }) => Promise<BluetoothDeviceLike>;
};

const NAME_PREFIXES = ["GP-5", "GP-50", "GP5", "GP50", "Valeton", "valeton"];

/** Advertised on GP-5/GP-50 BLE (Patone capture). Required for Web Bluetooth getPrimaryService. */
const ADVERTISED_SERVICES = [
  CONTROL_SERVICE_UUID,
  "00001800-0000-1000-8000-00805f9b34fb",
  "0000080b-0000-1000-8000-00805f9b34fb",
];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function characteristicProps(
  properties: BluetoothRemoteGattCharacteristicLike["properties"],
): string {
  const names: string[] = [];
  if (properties.read) names.push("read");
  if (properties.write) names.push("write");
  if (properties.writeWithoutResponse) names.push("write-without-response");
  if (properties.notify) names.push("notify");
  if (properties.indicate) names.push("indicate");
  return names.length > 0 ? names.join(", ") : "none";
}

async function logService(
  label: string,
  service: BluetoothRemoteGattServiceLike,
): Promise<void> {
  console.info(`[patone][gatt] ${label} ${service.uuid}`);
  const characteristics = await service.getCharacteristics();
  if (characteristics.length === 0) {
    console.info(`[patone][gatt] ${service.uuid} 0 characteristic(s)`);
    return;
  }
  for (const characteristic of characteristics) {
    console.info(
      `[patone][gatt] characteristic ${characteristic.uuid} [${characteristicProps(characteristic.properties)}]`,
    );
  }
}

async function logGattMap(server: BluetoothRemoteGattServerLike): Promise<void> {
  try {
    const services = await server.getPrimaryServices();
    console.info(`[patone][gatt] getPrimaryServices: ${services.length} service(s)`);
    for (const service of services) {
      await logService("service", service);
    }
  } catch (error) {
    console.info("[patone][gatt] getPrimaryServices failed", error);
  }

  // Chrome on Linux often throws "No Services found" for getPrimaryServices()
  // even when a UUID listed at chooser time is reachable via getPrimaryService.
  for (const uuid of ADVERTISED_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      await logService("getPrimaryService", service);
    } catch (error) {
      console.info(`[patone][gatt] getPrimaryService ${uuid} failed`, error);
    }
  }
}

function bluetoothApi(): BluetoothApi | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  const candidate = (navigator as Navigator & { bluetooth?: BluetoothApi })
    .bluetooth;
  return candidate;
}

function missingBluetoothError(): Error {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return new Error(
      `Bluetooth is blocked on ${window.location.origin}. Open http://localhost:1420 in Chrome or Edge.`,
    );
  }
  return new Error(
    "This browser cannot connect over Bluetooth. Use Chrome or Edge, or the desktop app.",
  );
}

function bluetoothError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return new Error("Bluetooth access was denied.");
    }
    if (error.name === "NotFoundError" || error.name === "AbortError") {
      return new Error("No Bluetooth pedals found.");
    }
    if (error.name === "NetworkError") {
      return new Error("Could not open the Bluetooth connection.");
    }
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error("Could not access Bluetooth devices.");
}

function toEndpoint(device: BluetoothDeviceLike): BluetoothEndpoint | null {
  const label = device.name?.trim();
  if (!label || !looksLikePedalName(label)) {
    return null;
  }
  const suggestedModel = suggestModelFromLabel(label);
  return {
    id: device.id,
    label,
    kind: "bluetooth",
    ...(suggestedModel ? { suggestedModel } : {}),
  };
}

export class WebBluetoothLink implements BluetoothLink {
  private devicesById = new Map<string, BluetoothDeviceLike>();
  private openDevice: BluetoothDeviceLike | null = null;
  private control: BluetoothRemoteGattCharacteristicLike | null = null;

  async discover(
    options: BluetoothDiscoverOptions = {},
  ): Promise<BluetoothEndpoint[]> {
    const bluetooth = bluetoothApi();
    if (!bluetooth) {
      throw missingBluetoothError();
    }

    try {
      if (typeof bluetooth.getDevices === "function") {
        const granted = await bluetooth.getDevices();
        for (const device of granted) {
          this.remember(device);
        }
      }
      if (options.interactive !== false) {
        const picked = await bluetooth.requestDevice({
          // Require the advertised BLE-MIDI service so Chrome connects LE/GATT,
          // not the dual-mode audio identity. Name prefix keeps the chooser on pedals.
          filters: NAME_PREFIXES.map((namePrefix) => ({
            namePrefix,
            services: [CONTROL_SERVICE_UUID],
          })),
          optionalServices: ADVERTISED_SERVICES,
        });
        this.remember(picked);
      }
    } catch (error) {
      const cancelled =
        error instanceof DOMException &&
        (error.name === "NotFoundError" || error.name === "AbortError");
      if (!cancelled && this.devicesById.size === 0) {
        throw bluetoothError(error);
      }
    }

    const endpoints: BluetoothEndpoint[] = [];
    for (const device of this.devicesById.values()) {
      const endpoint = toEndpoint(device);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
    return endpoints;
  }

  async open(id: string): Promise<void> {
    await this.close();
    let device = this.devicesById.get(id);
    if (!device) {
      await this.discover({ interactive: false });
      device = this.devicesById.get(id);
    }
    if (!device?.gatt) {
      throw new Error("The pedal is no longer available.");
    }
    console.info(
      `[patone][gatt] connecting ${device.name ?? device.id} via ${CONTROL_SERVICE_UUID}`,
    );
    const server = await device.gatt.connect();
    console.info(
      `[patone][gatt] connected ${device.name ?? device.id} gatt.connected=${String(server.connected)}`,
    );
    await logGattMap(server);
    const characteristic = await this.bindControl(server);
    this.openDevice = device;
    this.control = characteristic;
  }

  async send(bytes: Uint8Array): Promise<void> {
    const characteristic = this.control;
    if (!characteristic || !this.openDevice?.gatt?.connected) {
      throw new Error("No Bluetooth pedal is connected.");
    }
    try {
      console.info(`[patone][gatt] write ${toHex(bytes)}`);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(bytes);
        return;
      }
      await characteristic.writeValue(bytes);
    } catch {
      throw new Error("Could not send over Bluetooth.");
    }
  }

  async close(): Promise<void> {
    const device = this.openDevice;
    this.openDevice = null;
    this.control = null;
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
  }

  private async bindControl(
    server: BluetoothRemoteGattServerLike,
  ): Promise<BluetoothRemoteGattCharacteristicLike> {
    let characteristic: BluetoothRemoteGattCharacteristicLike;
    try {
      const service = await server.getPrimaryService(CONTROL_SERVICE_UUID);
      characteristic = await service.getCharacteristic(
        CONTROL_CHARACTERISTIC_UUID,
      );
    } catch {
      throw new Error("Could not find the Bluetooth control characteristic.");
    }
    console.info(
      `[patone][gatt] bound ${characteristic.uuid} [${characteristicProps(characteristic.properties)}]`,
    );
    if (characteristic.properties.notify) {
      try {
        await characteristic.startNotifications();
        characteristic.addEventListener(
          "characteristicvaluechanged",
          (event) => {
            const value = event.target.value;
            if (!value) {
              return;
            }
            const bytes = new Uint8Array(
              value.buffer,
              value.byteOffset,
              value.byteLength,
            );
            console.info(`[patone][gatt] notify ${toHex(bytes)}`);
          },
        );
      } catch (error) {
        console.info("[patone][gatt] startNotifications failed", error);
      }
    }
    return characteristic;
  }

  private remember(device: BluetoothDeviceLike): void {
    this.devicesById.set(device.id, device);
  }
}
