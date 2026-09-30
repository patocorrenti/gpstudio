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

export type BluetoothDiscoverResult = {
  endpoints: BluetoothEndpoint[];
  /** Device just chosen in the Web Bluetooth picker, if any. */
  selectedId?: string;
};

export type MidiMessageHandler = (bytes: Uint8Array) => void;
export type DisconnectHandler = () => void;

export interface BluetoothLink {
  discover(options?: BluetoothDiscoverOptions): Promise<BluetoothDiscoverResult>;
  open(id: string): Promise<void>;
  send(bytes: Uint8Array): Promise<void>;
  subscribe(handler: MidiMessageHandler): () => void;
  subscribeDisconnect(handler: DisconnectHandler): () => void;
  isOpen(): boolean;
  resetInbound(): void;
  close(): Promise<void>;
  forget(id: string): Promise<void>;
}
