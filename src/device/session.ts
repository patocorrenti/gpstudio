import { gp5Cc } from "@/device/cc";
import { describeMidi, type InboundMidiEvent } from "@/device/midi-log";
import type { DeviceModel } from "@/device/models";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

export type { InboundMidiEvent } from "@/device/midi-log";

const EMPTY_INBOUND: InboundMidiEvent[] = [];
const INBOUND_LIMIT = 40;

export const PATCH_COUNT = 100;

export type SessionSnapshot =
  | { status: "disconnected" }
  | {
      status: "connected";
      endpoint: MidiEndpoint;
      model: DeviceModel;
      patch: number;
    };

function clampPatch(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(PATCH_COUNT - 1, Math.max(0, Math.trunc(value)));
}

function wrapPatch(value: number): number {
  return ((value % PATCH_COUNT) + PATCH_COUNT) % PATCH_COUNT;
}

function patchControlChange(patch: number): Uint8Array {
  return new Uint8Array([0xb0, gp5Cc.patch, patch]);
}

export function formatPatch(patch: number): string {
  return String(clampPatch(patch)).padStart(2, "0");
}

export class DeviceSession {
  private readonly transport: MidiTransport;
  private snapshot: SessionSnapshot = { status: "disconnected" };
  private inboundLog: InboundMidiEvent[] = EMPTY_INBOUND;
  private inboundSeq = 0;
  private readonly listeners = new Set<() => void>();

  constructor(transport: MidiTransport = createMidiTransport()) {
    this.transport = transport;
    this.transport.subscribe((bytes) => this.handleInbound(bytes));
  }

  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  getInboundLog(): InboundMidiEvent[] {
    return this.inboundLog;
  }

  clearInboundLog(): void {
    this.inboundLog = EMPTY_INBOUND;
    this.emit();
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
    this.inboundLog = EMPTY_INBOUND;
    this.snapshot = { status: "connected", endpoint, model, patch: 0 };
    this.emit();
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
    this.snapshot = { status: "disconnected" };
    this.inboundLog = EMPTY_INBOUND;
    this.emit();
  }

  async setPatch(patch: number): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    const next = clampPatch(patch);
    this.snapshot = { ...this.snapshot, patch: next };
    this.emit();
    await this.transport.send(patchControlChange(next));
  }

  async stepPatch(delta: -1 | 1): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    await this.setPatch(wrapPatch(this.snapshot.patch + delta));
  }

  private handleInbound(bytes: Uint8Array): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const described = describeMidi(bytes);
    this.inboundSeq += 1;
    const next: InboundMidiEvent = {
      id: this.inboundSeq,
      at: Date.now(),
      hex: described.hex,
      summary: described.summary,
    };
    this.inboundLog = [...this.inboundLog.slice(1 - INBOUND_LIMIT), next];
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
