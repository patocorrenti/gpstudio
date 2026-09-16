import type { DeviceModel } from "@/device/models";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

export type SessionSnapshot =
  | { status: "disconnected" }
  | { status: "connected"; endpoint: MidiEndpoint; model: DeviceModel };

export class DeviceSession {
  private readonly transport: MidiTransport;
  private snapshot: SessionSnapshot = { status: "disconnected" };
  private readonly listeners = new Set<() => void>();

  constructor(transport: MidiTransport = createMidiTransport()) {
    this.transport = transport;
  }

  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  discover(): Promise<MidiEndpoint[]> {
    return this.transport.discover();
  }

  async connect(endpoint: MidiEndpoint, model: DeviceModel): Promise<void> {
    await this.transport.open(endpoint.id);
    this.snapshot = { status: "connected", endpoint, model };
    this.emit();
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
    this.snapshot = { status: "disconnected" };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
