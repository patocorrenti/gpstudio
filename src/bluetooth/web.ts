import { looksLikePedalName, suggestModelFromLabel } from "@/device/models";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";

type BluetoothRemoteGattServerLike = {
  connected: boolean;
  connect: () => Promise<unknown>;
  disconnect: () => void;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string | null;
  gatt?: BluetoothRemoteGattServerLike | null;
};

type BluetoothApi = {
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
  requestDevice: (options: {
    filters: Array<{ namePrefix: string }>;
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
          filters: NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
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
    await device.gatt.connect();
    this.openDevice = device;
  }

  async send(_bytes: Uint8Array): Promise<void> {
    if (!this.openDevice?.gatt?.connected) {
      throw new Error("No Bluetooth pedal is connected.");
    }
    throw new Error("Could not send over Bluetooth.");
  }

  async close(): Promise<void> {
    const device = this.openDevice;
    this.openDevice = null;
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
  }

  private remember(device: BluetoothDeviceLike): void {
    this.devicesById.set(device.id, device);
  }
}
