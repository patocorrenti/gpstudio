import { createBluetoothLink } from "@/bluetooth/detect";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";
import {
  defaultChain,
  type AudioChain,
} from "@/device/chain";
import { ChainDecoder } from "@/device/chain-codec";
import { encodeChainRequest, encodeIdentity, encodePatch } from "@/device/encode";
import type { LinkEndpoint } from "@/device/endpoint";
import {
  emptyPatchNames,
  IdentityDecoder,
  PATCH_COUNT,
  SysexAssembler,
  type IdentityEvent,
} from "@/device/identity";
import { capabilitiesForLink, type LinkMode } from "@/device/link";
import { describeMidi, type InboundMidiEvent } from "@/device/midi-log";
import type { DeviceModel } from "@/device/models";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

export type { LinkMode, LinkCapabilities } from "@/device/link";
export { capabilitiesForLink } from "@/device/link";
export type { InboundMidiEvent } from "@/device/midi-log";
export type { LinkEndpoint } from "@/device/endpoint";
export { formatPatch, formatPatchOption, PATCH_COUNT } from "@/device/identity";
export {
  chainSlotLabel,
  defaultChain,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
} from "@/device/chain";

const EMPTY_INBOUND: InboundMidiEvent[] = [];
const INBOUND_LIMIT = 40;

export type SessionSync = "syncing" | "ready";
export type ChainSync = "idle" | "syncing";

export type SessionSnapshot =
  | { status: "disconnected" }
  | {
      status: "connected";
      endpoint: LinkEndpoint;
      model: DeviceModel;
      patch: number;
      patchNames: (string | null)[];
      chain: AudioChain;
      chainSync: ChainSync;
      sync: SessionSync;
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

const NAME_TIMEOUT_MS = { usb: 8_000, bluetooth: 15_000 } as const;
const PATCH_TIMEOUT_MS = { usb: 4_000, bluetooth: 6_000 } as const;
const CHAIN_TIMEOUT_MS = { usb: 6_000, bluetooth: 10_000 } as const;

export class DeviceSession {
  private readonly transport: MidiTransport;
  private readonly bluetooth: BluetoothLink;
  private snapshot: SessionSnapshot = { status: "disconnected" };
  private inboundLog: InboundMidiEvent[] = EMPTY_INBOUND;
  private inboundSeq = 0;
  private inboundCapture = false;
  private readonly snapshotListeners = new Set<() => void>();
  private readonly logListeners = new Set<() => void>();
  private readonly identity = new IdentityDecoder();
  private readonly chainDump = new ChainDecoder();
  private readonly sysex = new SysexAssembler();
  private syncGeneration = 0;
  private namesWaiters = new Set<() => void>();
  private patchWaiters = new Set<() => void>();
  private chainWaiters = new Set<() => void>();
  private chainRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private dropping = false;

  constructor(
    transport: MidiTransport = createMidiTransport(),
    bluetooth: BluetoothLink = createBluetoothLink(),
  ) {
    this.transport = transport;
    this.bluetooth = bluetooth;
    this.transport.subscribe((bytes) => this.handleInbound(bytes));
    this.bluetooth.subscribe((bytes) => this.handleInbound(bytes));
    this.transport.subscribeDisconnect(() => {
      void this.dropLink();
    });
    this.bluetooth.subscribeDisconnect(() => {
      void this.dropLink();
    });
  }

  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  getInboundLog(): InboundMidiEvent[] {
    return this.inboundLog;
  }

  setInboundCapture(enabled: boolean): void {
    if (this.inboundCapture === enabled) {
      return;
    }
    this.inboundCapture = enabled;
    this.bluetooth.resetInbound();
    if (!enabled) {
      this.inboundLog = EMPTY_INBOUND;
      this.emitLog();
    }
  }

  clearInboundLog(): void {
    this.inboundLog = EMPTY_INBOUND;
    this.emitLog();
  }

  subscribe(listener: () => void): () => void {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  subscribeLog(listener: () => void): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
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
    this.beginGeneration();
    await Promise.all([this.transport.close(), this.bluetooth.close()]);
    this.inboundLog = EMPTY_INBOUND;
    this.identity.reset();
    this.chainDump.reset();
    this.sysex.reset();
    const generation = this.syncGeneration;
    if (endpoint.kind === "bluetooth") {
      await this.bluetooth.open(endpoint.id);
      this.snapshot = {
        status: "connected",
        endpoint,
        model,
        patch: 0,
        patchNames: emptyPatchNames(),
        chain: defaultChain(model),
        chainSync: "idle",
        sync: "syncing",
        linkMode: "bluetooth",
      };
    } else {
      await this.transport.open(endpoint.id);
      this.snapshot = {
        status: "connected",
        endpoint,
        model,
        patch: 0,
        patchNames: emptyPatchNames(),
        chain: defaultChain(model),
        chainSync: "idle",
        sync: "syncing",
        linkMode: "usb",
      };
    }
    this.emitSnapshot();
    this.emitLog();
    void this.runIdentitySync(generation);
  }

  async disconnect(): Promise<void> {
    if (this.dropping) {
      return;
    }
    this.dropping = true;
    this.beginGeneration();
    try {
      await Promise.all([this.transport.close(), this.bluetooth.close()]);
    } finally {
      this.snapshot = { status: "disconnected" };
      this.inboundLog = EMPTY_INBOUND;
      this.identity.reset();
      this.chainDump.reset();
      this.sysex.reset();
      this.dropping = false;
      this.emitSnapshot();
      this.emitLog();
    }
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
    this.emitSnapshot();
    const bytes = encodePatch(this.snapshot.linkMode, next);
    await this.sendBytes(bytes);
    this.refreshChain();
  }

  async stepPatch(delta: -1 | 1): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    await this.setPatch(wrapPatch(this.snapshot.patch + delta));
  }

  private async runIdentitySync(generation: number): Promise<void> {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    const linkMode = this.snapshot.linkMode;
    if (linkMode === "usb" && !this.transport.sysexEnabled()) {
      this.finishSync(generation);
      return;
    }

    await this.sendIdentity("name-list", generation);
    if (!this.isCurrentGeneration(generation)) {
      return;
    }
    await this.waitFor(this.namesWaiters, NAME_TIMEOUT_MS[linkMode], generation);
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    await this.sendIdentity("current-patch", generation);
    if (!this.isCurrentGeneration(generation)) {
      return;
    }
    await this.waitFor(this.patchWaiters, PATCH_TIMEOUT_MS[linkMode], generation);
    this.finishSync(generation, "syncing");
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }

    this.chainDump.reset();
    this.armChainRefreshTimer();
    await this.sendChainRequest(generation);
  }

  private finishSync(generation: number, chainSync: ChainSync = "idle"): void {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    if (this.snapshot.sync === "ready") {
      return;
    }
    this.snapshot = { ...this.snapshot, sync: "ready", chainSync };
    this.emitSnapshot();
  }

  private async sendIdentity(
    kind: "name-list" | "current-patch",
    generation: number,
  ): Promise<void> {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    await this.sendBytes(encodeIdentity(this.snapshot.linkMode, kind));
  }

  private async sendChainRequest(generation: number): Promise<void> {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    await this.sendBytes(encodeChainRequest(this.snapshot.linkMode));
  }

  private async sendBytes(bytes: Uint8Array): Promise<void> {
    if (this.snapshot.status !== "connected") {
      return;
    }
    try {
      if (this.snapshot.linkMode === "bluetooth") {
        await this.bluetooth.send(bytes);
      } else {
        await this.transport.send(bytes);
      }
    } catch {
      await this.dropLink();
    }
  }

  private async dropLink(): Promise<void> {
    if (this.snapshot.status !== "connected" || this.dropping) {
      return;
    }
    await this.disconnect();
  }

  private linkIsOpen(): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    return this.snapshot.linkMode === "bluetooth"
      ? this.bluetooth.isOpen()
      : this.transport.isOpen();
  }

  private handleInbound(bytes: Uint8Array): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    for (const message of this.sysex.push(bytes)) {
      this.applyIdentity(this.identity.push(message));
      if (this.snapshot.status === "connected") {
        this.applyChain(this.chainDump.push(message, this.snapshot.model));
      }
      if (!this.inboundCapture) {
        continue;
      }
      const described = describeMidi(message);
      this.inboundSeq += 1;
      const next: InboundMidiEvent = {
        id: this.inboundSeq,
        at: Date.now(),
        hex: described.hex,
        summary: described.summary,
      };
      this.inboundLog = [...this.inboundLog.slice(1 - INBOUND_LIMIT), next];
      this.emitLog();
    }
  }

  private applyIdentity(event: IdentityEvent | null): void {
    if (!event || this.snapshot.status !== "connected") {
      return;
    }
    if (event.type === "name-list") {
      this.snapshot = { ...this.snapshot, patchNames: event.names };
      this.emitSnapshot();
      this.releaseWaiters(this.namesWaiters);
      return;
    }
    if (event.type === "current-patch") {
      const next = clampPatch(event.patch);
      const changed = next !== this.snapshot.patch;
      this.snapshot = { ...this.snapshot, patch: next };
      this.emitSnapshot();
      this.releaseWaiters(this.patchWaiters);
      if (changed) {
        this.refreshChain();
      }
      return;
    }
    if (event.type === "patch-changed") {
      if (this.snapshot.sync === "ready") {
        void this.sendIdentity("current-patch", this.syncGeneration);
        this.refreshChain();
      }
    }
  }

  private refreshChain(): void {
    if (this.snapshot.status !== "connected" || this.snapshot.sync !== "ready") {
      return;
    }
    this.chainDump.reset();
    this.beginChainRefresh();
    void this.sendChainRequest(this.syncGeneration);
  }

  private applyChain(chain: AudioChain | null): void {
    if (!chain || this.snapshot.status !== "connected") {
      return;
    }
    this.clearChainRefreshTimer();
    this.snapshot = { ...this.snapshot, chain, chainSync: "idle" };
    this.emitSnapshot();
    this.releaseWaiters(this.chainWaiters);
  }

  private beginChainRefresh(): void {
    if (this.snapshot.status !== "connected" || this.snapshot.sync !== "ready") {
      return;
    }
    this.snapshot = { ...this.snapshot, chainSync: "syncing" };
    this.emitSnapshot();
    this.armChainRefreshTimer();
  }

  private armChainRefreshTimer(): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    this.clearChainRefreshTimer();
    const generation = this.syncGeneration;
    const ms = CHAIN_TIMEOUT_MS[this.snapshot.linkMode];
    this.chainRefreshTimer = setTimeout(() => {
      if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
        return;
      }
      if (this.snapshot.chainSync !== "syncing") {
        return;
      }
      if (!this.linkIsOpen()) {
        void this.dropLink();
        return;
      }
      this.snapshot = { ...this.snapshot, chainSync: "idle" };
      this.emitSnapshot();
      void this.sendIdentity("current-patch", generation);
    }, ms);
  }

  private clearChainRefreshTimer(): void {
    if (this.chainRefreshTimer === null) {
      return;
    }
    clearTimeout(this.chainRefreshTimer);
    this.chainRefreshTimer = null;
  }

  private waitFor(
    waiters: Set<() => void>,
    ms: number,
    generation: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        waiters.delete(finish);
        clearTimeout(timer);
        resolve();
      };
      waiters.add(finish);
      const timer = setTimeout(finish, ms);
      if (!this.isCurrentGeneration(generation)) {
        finish();
      }
    });
  }

  private releaseWaiters(waiters: Set<() => void>): void {
    const pending = [...waiters];
    waiters.clear();
    for (const waiter of pending) {
      waiter();
    }
  }

  private beginGeneration(): void {
    this.syncGeneration += 1;
    this.clearChainRefreshTimer();
    this.releaseWaiters(this.namesWaiters);
    this.releaseWaiters(this.patchWaiters);
    this.releaseWaiters(this.chainWaiters);
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.syncGeneration && this.snapshot.status === "connected";
  }

  private emitSnapshot(): void {
    for (const listener of this.snapshotListeners) {
      listener();
    }
  }

  private emitLog(): void {
    for (const listener of this.logListeners) {
      listener();
    }
  }
}
