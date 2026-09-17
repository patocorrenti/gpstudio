import type { DeviceModel } from "@/device/models";

export type BluetoothEndpoint = {
  id: string;
  label: string;
  kind: "bluetooth";
  suggestedModel?: DeviceModel;
};

export type BluetoothDiscoverOptions = {
  interactive?: boolean;
};

export type MidiMessageHandler = (bytes: Uint8Array) => void;

export interface BluetoothLink {
  discover(options?: BluetoothDiscoverOptions): Promise<BluetoothEndpoint[]>;
  open(id: string): Promise<void>;
  send(bytes: Uint8Array): Promise<void>;
  subscribe(handler: MidiMessageHandler): () => void;
  resetInbound(): void;
  close(): Promise<void>;
}
