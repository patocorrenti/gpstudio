import { BleMidiDecoder } from "@/bluetooth/ble-midi";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
  MidiMessageHandler,
} from "@/bluetooth/types";
import {
  CONTROL_CHARACTERISTIC_UUID,
  CONTROL_SERVICE_UUID,
} from "@/bluetooth/uuids";
import { looksLikePedalName, suggestModelFromLabel } from "@/device/models";

type NotifyEvent = {
  target?: { value?: DataView | null };
};

type BluetoothRemoteGattCharacteristicLike = {
  uuid: string;
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
  };
  startNotifications: () => Promise<BluetoothRemoteGattCharacteristicLike>;
  writeValueWithoutResponse: (data: Uint8Array) => Promise<void>;
  writeValue: (data: Uint8Array) => Promise<void>;
  addEventListener: (
    type: "characteristicvaluechanged",
    listener: (event: NotifyEvent) => void,
  ) => void;
  removeEventListener: (
    type: "characteristicvaluechanged",
    listener: (event: NotifyEvent) => void,
  ) => void;
};

type BluetoothRemoteGattServiceLike = {
  getCharacteristic: (
    uuid: string,
  ) => Promise<BluetoothRemoteGattCharacteristicLike>;
};

type BluetoothRemoteGattServerLike = {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGattServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGattServiceLike>;
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
  private readonly decoder = new BleMidiDecoder();
  private readonly handlers = new Set<MidiMessageHandler>();
  private readonly onNotify = (event: NotifyEvent): void => {
    const value = event.target?.value;
    if (!value) {
      return;
    }
    const bytes = new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
    for (const message of this.decoder.push(bytes)) {
      for (const handler of this.handlers) {
        handler(message);
      }
    }
  };

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
          // Require BLE-MIDI so Chrome opens the LE/GATT identity, not dual-mode audio.
          filters: NAME_PREFIXES.map((namePrefix) => ({
            namePrefix,
            services: [CONTROL_SERVICE_UUID],
          })),
          optionalServices: [CONTROL_SERVICE_UUID],
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
    const server = await device.gatt.connect();
    this.control = await this.bindControl(server);
    this.control.addEventListener("characteristicvaluechanged", this.onNotify);
    this.openDevice = device;
  }

  async send(bytes: Uint8Array): Promise<void> {
    const characteristic = this.control;
    if (!characteristic || !this.openDevice?.gatt?.connected) {
      throw new Error("No Bluetooth pedal is connected.");
    }
    try {
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(bytes);
        return;
      }
      await characteristic.writeValue(bytes);
    } catch {
      throw new Error("Could not send over Bluetooth.");
    }
  }

  subscribe(handler: MidiMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  resetInbound(): void {
    this.decoder.reset();
  }

  async close(): Promise<void> {
    const device = this.openDevice;
    const control = this.control;
    this.openDevice = null;
    this.control = null;
    this.decoder.reset();
    if (control) {
      control.removeEventListener("characteristicvaluechanged", this.onNotify);
    }
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
    if (characteristic.properties.notify) {
      try {
        await characteristic.startNotifications();
      } catch {
        // Writes still work if the CCCD enable is rejected.
      }
    }
    return characteristic;
  }

  private remember(device: BluetoothDeviceLike): void {
    this.devicesById.set(device.id, device);
  }
}
