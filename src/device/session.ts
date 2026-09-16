import { createBluetoothLink } from "@/bluetooth/detect";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";
import { encodePatch } from "@/device/encode";
import type { LinkEndpoint } from "@/device/endpoint";
import { capabilitiesForLink, type LinkMode } from "@/device/link";
import { describeMidi, type InboundMidiEvent } from "@/device/midi-log";
import type { DeviceModel } from "@/device/models";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

export type { LinkMode, LinkCapabilities } from "@/device/link";
export { capabilitiesForLink } from "@/device/link";
export type { InboundMidiEvent } from "@/device/midi-log";
export type { LinkEndpoint } from "@/device/endpoint";

const EMPTY_INBOUND: InboundMidiEvent[] = [];
const INBOUND_LIMIT = 40;

export const PATCH_COUNT = 100;

export type SessionSnapshot =
  | { status: "disconnected" }
  | {
      status: "connected";
      endpoint: LinkEndpoint;
      model: DeviceModel;
      patch: number;
      linkMode: LinkMode;
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

export function formatPatch(patch: number): string {
  return String(clampPatch(patch)).padStart(2, "0");
}

export class DeviceSession {
  private readonly transport: MidiTransport;
  private readonly bluetooth: BluetoothLink;
  private snapshot: SessionSnapshot = { status: "disconnected" };
  private inboundLog: InboundMidiEvent[] = EMPTY_INBOUND;
  private inboundSeq = 0;
  private readonly listeners = new Set<() => void>();

  constructor(
    transport: MidiTransport = createMidiTransport(),
    bluetooth: BluetoothLink = createBluetoothLink(),
  ) {
    this.transport = transport;
    this.bluetooth = bluetooth;
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

  discoverBluetooth(
    options?: BluetoothDiscoverOptions,
  ): Promise<BluetoothEndpoint[]> {
    return this.bluetooth.discover(options);
  }

  async connect(endpoint: LinkEndpoint, model: DeviceModel): Promise<void> {
    await Promise.all([this.transport.close(), this.bluetooth.close()]);
    this.inboundLog = EMPTY_INBOUND;
    if (endpoint.kind === "bluetooth") {
      await this.bluetooth.open(endpoint.id);
      this.snapshot = {
        status: "connected",
        endpoint,
        model,
        patch: 0,
        linkMode: "bluetooth",
      };
    } else {
      await this.transport.open(endpoint.id);
      this.snapshot = {
        status: "connected",
        endpoint,
        model,
        patch: 0,
        linkMode: "usb",
      };
    }
    this.emit();
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.transport.close(), this.bluetooth.close()]);
    this.snapshot = { status: "disconnected" };
    this.inboundLog = EMPTY_INBOUND;
    this.emit();
  }

  async setPatch(patch: number): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Patch control is not available on this link.");
    }
    const next = clampPatch(patch);
    this.snapshot = { ...this.snapshot, patch: next };
    this.emit();
    const bytes = encodePatch(this.snapshot.linkMode, next);
    if (this.snapshot.linkMode === "bluetooth") {
      await this.bluetooth.send(bytes);
    } else {
      await this.transport.send(bytes);
    }
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
