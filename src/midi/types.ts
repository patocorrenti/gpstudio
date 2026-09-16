import type { DeviceModel } from "@/device/models";

export type EndpointKind = "usb-midi";

export type MidiEndpoint = {
  id: string;
  label: string;
  kind: EndpointKind;
  suggestedModel?: DeviceModel;
};

export type MidiMessageHandler = (bytes: Uint8Array) => void;

export interface MidiTransport {
  discover(): Promise<MidiEndpoint[]>;
  open(id: string): Promise<void>;
  send(bytes: Uint8Array): Promise<void>;
  subscribe(handler: MidiMessageHandler): () => void;
  close(): Promise<void>;
}
