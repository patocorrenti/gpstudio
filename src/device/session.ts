import { createBluetoothLink } from "@/bluetooth/detect";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";
import { effectIdForModuleCc, gp50Cc, moduleEnabledFromCc } from "@/device/cc";
import {
  defaultValuesFor,
  modelById,
  modelByWire,
  modelsForKind,
  snapControlValue,
  type WireIdentity,
} from "@/device/catalog";
import {
  defaultChain,
  reorderChain,
  type AudioChain,
  type ChainSlotId,
  type EffectId,
} from "@/device/chain";
import {
  ChainDecoder,
  decodeLiveChainOrder,
  decodeLiveOnOffChanges,
  decodeLiveSlotControl,
  decodeLiveSlotModel,
  type ChainDumpResult,
} from "@/device/chain-codec";
import {
  encodeChainOrder,
  encodeChainRequest,
  encodeIdentity,
  encodeModule,
  encodePatch,
  encodePatchStore,
  encodeSlotControl,
  encodeSlotModel,
} from "@/device/encode";
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
import {
  currentPatchFilename,
  encodePrstFile,
  sanitizePatchName,
} from "@/device/patch-store";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

export type { LinkMode, LinkCapabilities } from "@/device/link";
export { capabilitiesForLink } from "@/device/link";
export type { InboundMidiEvent } from "@/device/midi-log";
export type { LinkEndpoint } from "@/device/endpoint";
export { formatPatch, formatPatchOption, PATCH_COUNT } from "@/device/identity";
export {
  chainSlotBypassed,
  chainSlotLabel,
  defaultChain,
  isEffectSlot,
  isMovableEffect,
  type AudioChain,
  type AudioChainSlot,
  type ChainSlotId,
  type EffectId,
} from "@/device/chain";

const EMPTY_INBOUND: InboundMidiEvent[] = [];
const INBOUND_LIMIT = 40;
/** Coalesce slider SETs so BLE-MIDI is not flooded. Toggles flush immediately. */
const CONTROL_WRITE_THROTTLE_MS = 80;

function controlWriteKey(kind: EffectId, index: number): string {
  return `${kind}:${index}`;
}

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
      canExportPatch: boolean;
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

function preserveExpEnabled(previous: AudioChain, next: AudioChain): AudioChain {
  const previousExp = previous.find((slot) => slot.id === "exp");
  if (!previousExp) {
    return next;
  }
  return next.map((slot) =>
    slot.id === "exp" ? { ...slot, enabled: previousExp.enabled } : slot,
  );
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
  private currentPatchDump: Uint8Array | null = null;
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
  private readonly pendingControlWrites = new Map<
    string,
    { kind: EffectId; index: number; value: number }
  >();
  private readonly controlWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastControlWriteAt = new Map<string, number>();
  private readonly lastControlSentValue = new Map<string, number>();
  private controlSendTail: Promise<void> = Promise.resolve();

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
    this.clearControlWrites();
    this.dropPatchDump();
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
        canExportPatch: false,
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
        canExportPatch: false,
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
      this.dropPatchDump();
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
    const chainSync =
      this.snapshot.sync === "ready" ? "syncing" : this.snapshot.chainSync;
    this.snapshot = { ...this.snapshot, patch: next, chainSync };
    this.emitSnapshot();
    const bytes = encodePatch(this.snapshot.linkMode, next);
    await this.sendBytes(bytes);
    this.refreshChain();
  }

  async stepPatch(delta: -1 | 1): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    await this.setPatch(wrapPatch(this.snapshot.patch + delta));
  }

  async savePatch(): Promise<void> {
    if (this.snapshot.status !== "connected") {
      return;
    }
    await this.storePatch(this.snapshot.patch, this.snapshot.patchNames[this.snapshot.patch] ?? "");
  }

  async renamePatch(name: string): Promise<void> {
    if (this.snapshot.status !== "connected") {
      return;
    }
    await this.storePatch(this.snapshot.patch, name);
  }

  async duplicatePatch(dest: number): Promise<void> {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const slot = clampPatch(dest);
    if (slot !== dest || slot === this.snapshot.patch) {
      return;
    }
    await this.storePatch(slot, this.snapshot.patchNames[this.snapshot.patch] ?? "");
  }

  async downloadCurrentPatch(): Promise<{ filename: string; bytes: Uint8Array } | null> {
    if (this.snapshot.status !== "connected") {
      return null;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return null;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      return null;
    }
    const generation = this.syncGeneration;
    this.clearControlWrites();
    this.chainDump.reset();
    this.beginChainRefresh();
    await this.sendChainRequest(generation);
    await this.waitFor(this.chainWaiters, CHAIN_TIMEOUT_MS[this.snapshot.linkMode], generation);
    if (
      !this.isCurrentGeneration(generation) ||
      this.snapshot.status !== "connected" ||
      !this.currentPatchDump
    ) {
      return null;
    }
    const name = this.snapshot.patchNames[this.snapshot.patch] ?? "";
    const bytes = encodePrstFile({
      model: this.snapshot.model,
      name,
      dump: this.currentPatchDump,
    });
    if (!bytes) {
      return null;
    }
    return {
      filename: currentPatchFilename(this.snapshot.model, this.snapshot.patch, name),
      bytes,
    };
  }

  async toggleChainSlot(id: ChainSlotId): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (id === "exp" && this.snapshot.model !== "gp50") {
      return;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Module control is not available on this link.");
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === id);
    if (index < 0) {
      return;
    }
    const enabled = !this.snapshot.chain[index].enabled;
    const chain = this.snapshot.chain.map((slot, slotIndex) =>
      slotIndex === index ? { ...slot, enabled } : slot,
    );
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
    await this.sendBytes(encodeModule(this.snapshot.linkMode, id, enabled));
  }

  async reorderChain(fromIndex: number, toIndex: number): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Module control is not available on this link.");
    }
    const chain = reorderChain(this.snapshot.chain, fromIndex, toIndex);
    if (chain === this.snapshot.chain) {
      return;
    }
    const packets = encodeChainOrder(this.snapshot.linkMode, chain);
    if (!packets) {
      return;
    }
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }

  async setSlotModel(kind: EffectId, modelId: string): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Module control is not available on this link.");
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === kind);
    if (index < 0) {
      return;
    }
    const slot = this.snapshot.chain[index];
    if (slot.modelId === undefined || slot.values === undefined) {
      return;
    }
    const model = modelById(modelId);
    if (!model || model.kind !== kind || !model.devices.has(this.snapshot.model)) {
      return;
    }
    if (!modelsForKind(kind, this.snapshot.model).some((entry) => entry.id === model.id)) {
      return;
    }
    const packets = encodeSlotModel(this.snapshot.linkMode, kind, model.wire);
    if (!packets) {
      return;
    }
    this.clearControlWritesForKind(kind);
    const values = defaultValuesFor(model);
    const chain = this.snapshot.chain.map((entry, slotIndex) =>
      slotIndex === index ? { ...entry, modelId: model.id, values } : entry,
    );
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }

  async setSlotControl(
    kind: EffectId,
    controlIndex: number,
    value: number,
    options: { flush?: boolean } = {},
  ): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Module control is not available on this link.");
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === kind);
    if (index < 0) {
      return;
    }
    const slot = this.snapshot.chain[index];
    if (slot.modelId === undefined || slot.values === undefined) {
      return;
    }
    const model = modelById(slot.modelId);
    if (!model || model.kind !== kind || !model.devices.has(this.snapshot.model)) {
      return;
    }
    const control = model.controls.find((entry) => entry.index === controlIndex);
    if (!control) {
      return;
    }
    const nextValue = snapControlValue(control, value);
    if (controlIndex >= slot.values.length) {
      return;
    }
    const unchanged = slot.values[controlIndex] === nextValue;
    if (!unchanged) {
      const values = slot.values.slice();
      values[controlIndex] = nextValue;
      const chain = this.snapshot.chain.map((entry, slotIndex) =>
        slotIndex === index ? { ...entry, values } : entry,
      );
      this.snapshot = { ...this.snapshot, chain };
      this.emitSnapshot();
    }
    if (unchanged && !options.flush) {
      return;
    }
    this.queueControlWrite(kind, controlIndex, nextValue, options.flush === true);
  }

  /** Send the latest queued value for this control now (slider pointer up). */
  flushSlotControl(kind: EffectId, controlIndex: number): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    this.flushControlWrite(controlWriteKey(kind, controlIndex));
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
      const liveOnOff = this.applyLiveModule(message);
      const liveOrder = this.applyLiveChainOrder(message);
      const liveSlot = this.applyLiveSlot(message);
      if (
        !liveOnOff &&
        !liveOrder &&
        !liveSlot &&
        this.snapshot.status === "connected"
      ) {
        this.applyIdentity(this.identity.push(message));
      }
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
    this.clearControlWrites();
    this.chainDump.reset();
    this.beginChainRefresh();
    void this.sendChainRequest(this.syncGeneration);
  }

  private applyChain(result: ChainDumpResult | null): void {
    if (!result || this.snapshot.status !== "connected") {
      return;
    }
    this.clearChainRefreshTimer();
    this.currentPatchDump = result.dump;
    this.snapshot = {
      ...this.snapshot,
      chain: preserveExpEnabled(this.snapshot.chain, result.chain),
      chainSync: "idle",
      canExportPatch: true,
    };
    this.emitSnapshot();
    this.releaseWaiters(this.chainWaiters);
  }

  private applyLiveModule(message: Uint8Array): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    const fromCc = this.decodeLiveOnOffCc(message);
    const reports = fromCc ? [fromCc] : decodeLiveOnOffChanges(message);
    if (reports.length === 0) {
      return false;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).liveFromPedal) {
      return true;
    }
    for (const report of reports) {
      this.setChainSlotEnabled(report.id, report.enabled);
    }
    return true;
  }

  private applyLiveChainOrder(message: Uint8Array): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    const order = decodeLiveChainOrder(message);
    if (!order) {
      return false;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).liveFromPedal) {
      return true;
    }
    const previousById = new Map(this.snapshot.chain.map((slot) => [slot.id, slot] as const));
    const exp = this.snapshot.chain.find((slot) => slot.id === "exp");
    const chain: AudioChain = order.map((id) => {
      const previous = previousById.get(id);
      return {
        id,
        enabled: previous?.enabled ?? false,
        modelId: previous?.modelId,
        values: previous?.values,
      };
    });
    if (exp) {
      chain.push({ id: "exp", enabled: exp.enabled });
    }
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
    return true;
  }

  private applyLiveSlot(message: Uint8Array): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    const modelChange = decodeLiveSlotModel(message);
    if (modelChange) {
      if (!capabilitiesForLink(this.snapshot.linkMode).liveFromPedal) {
        return true;
      }
      this.applyLiveSlotModel(modelChange.kind, modelChange.wire);
      return true;
    }
    const controlChange = decodeLiveSlotControl(message);
    if (!controlChange) {
      return false;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).liveFromPedal) {
      return true;
    }
    this.applyLiveSlotControl(controlChange.kind, controlChange.index, controlChange.value);
    return true;
  }

  private applyLiveSlotModel(kind: EffectId, wire: WireIdentity): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === kind);
    if (index < 0) {
      return;
    }
    let model = modelByWire(kind, wire);
    if (!model) {
      const sole = modelsForKind(kind, this.snapshot.model);
      if (sole.length !== 1) {
        return;
      }
      model = sole[0];
    }
    if (!model.devices.has(this.snapshot.model)) {
      return;
    }
    this.clearControlWritesForKind(kind);
    const values = defaultValuesFor(model);
    const chain = this.snapshot.chain.map((entry, slotIndex) =>
      slotIndex === index ? { ...entry, modelId: model.id, values } : entry,
    );
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
  }

  private applyLiveSlotControl(kind: EffectId, controlIndex: number, value: number): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === kind);
    if (index < 0) {
      return;
    }
    const slot = this.snapshot.chain[index];
    if (slot.modelId === undefined || slot.values === undefined) {
      return;
    }
    const model = modelById(slot.modelId);
    if (!model || model.kind !== kind) {
      return;
    }
    const control = model.controls.find((entry) => entry.index === controlIndex);
    if (!control || controlIndex >= slot.values.length) {
      return;
    }
    const nextValue = snapControlValue(control, value);
    this.dropControlWrite(controlWriteKey(kind, controlIndex), nextValue);
    if (slot.values[controlIndex] === nextValue) {
      return;
    }
    const values = slot.values.slice();
    values[controlIndex] = nextValue;
    const chain = this.snapshot.chain.map((entry, slotIndex) =>
      slotIndex === index ? { ...entry, values } : entry,
    );
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
  }

  private decodeLiveOnOffCc(message: Uint8Array): { id: ChainSlotId; enabled: boolean } | null {
    if ((message[0] & 0xf0) !== 0xb0 || message.length < 3) {
      return null;
    }
    if (message[1] === gp50Cc.expOnOff) {
      return { id: "exp", enabled: moduleEnabledFromCc(message[2]) };
    }
    const id = effectIdForModuleCc(message[1]);
    if (!id) {
      return null;
    }
    return { id, enabled: moduleEnabledFromCc(message[2]) };
  }

  private setChainSlotEnabled(id: ChainSlotId, enabled: boolean): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const index = this.snapshot.chain.findIndex((slot) => slot.id === id);
    if (index < 0 || this.snapshot.chain[index].enabled === enabled) {
      return;
    }
    const chain = this.snapshot.chain.map((slot, slotIndex) =>
      slotIndex === index ? { ...slot, enabled } : slot,
    );
    this.snapshot = { ...this.snapshot, chain };
    this.emitSnapshot();
  }

  private beginChainRefresh(): void {
    if (this.snapshot.status !== "connected" || this.snapshot.sync !== "ready") {
      return;
    }
    this.dropPatchDump();
    this.snapshot = { ...this.snapshot, chainSync: "syncing", canExportPatch: false };
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
    this.clearControlWrites();
    this.dropPatchDump();
    this.releaseWaiters(this.namesWaiters);
    this.releaseWaiters(this.patchWaiters);
    this.releaseWaiters(this.chainWaiters);
  }

  private dropPatchDump(): void {
    this.currentPatchDump = null;
  }

  private async storePatch(dest: number, name: string): Promise<void> {
    if (this.snapshot.status !== "connected") {
      return;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      return;
    }
    const sanitized = sanitizePatchName(name);
    if (!sanitized) {
      return;
    }
    const packets = encodePatchStore(this.snapshot.linkMode, dest, sanitized);
    if (!packets) {
      return;
    }
    const patchNames = this.snapshot.patchNames.slice();
    patchNames[dest] = sanitized;
    this.snapshot = { ...this.snapshot, patchNames };
    this.emitSnapshot();
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }

  private queueControlWrite(
    kind: EffectId,
    index: number,
    value: number,
    flush: boolean,
  ): void {
    const key = controlWriteKey(kind, index);
    this.pendingControlWrites.set(key, { kind, index, value });
    if (flush) {
      this.flushControlWrite(key);
      return;
    }
    const elapsed = Date.now() - (this.lastControlWriteAt.get(key) ?? 0);
    const wait = CONTROL_WRITE_THROTTLE_MS - elapsed;
    if (wait <= 0) {
      this.flushControlWrite(key);
      return;
    }
    if (this.controlWriteTimers.has(key)) {
      return;
    }
    const timer = setTimeout(() => {
      this.controlWriteTimers.delete(key);
      this.flushControlWrite(key);
    }, wait);
    this.controlWriteTimers.set(key, timer);
  }

  private flushControlWrite(key: string): void {
    const timer = this.controlWriteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.controlWriteTimers.delete(key);
    }
    this.lastControlWriteAt.set(key, Date.now());
    this.controlSendTail = this.controlSendTail
      .then(() => this.sendPendingControl(key))
      .catch(() => undefined);
  }

  private async sendPendingControl(key: string): Promise<void> {
    const pending = this.pendingControlWrites.get(key);
    if (!pending || this.snapshot.status !== "connected") {
      return;
    }
    this.pendingControlWrites.delete(key);
    if (this.lastControlSentValue.get(key) === pending.value) {
      return;
    }
    const packets = encodeSlotControl(
      this.snapshot.linkMode,
      pending.kind,
      pending.index,
      pending.value,
    );
    if (!packets) {
      return;
    }
    this.lastControlSentValue.set(key, pending.value);
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }

  private dropControlWrite(key: string, sentValue: number): void {
    const timer = this.controlWriteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.controlWriteTimers.delete(key);
    }
    this.pendingControlWrites.delete(key);
    this.lastControlWriteAt.delete(key);
    this.lastControlSentValue.set(key, sentValue);
  }

  private clearControlWritesForKind(kind: EffectId): void {
    const prefix = `${kind}:`;
    for (const key of [...this.pendingControlWrites.keys()]) {
      if (key.startsWith(prefix)) {
        const timer = this.controlWriteTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.controlWriteTimers.delete(key);
        }
        this.pendingControlWrites.delete(key);
        this.lastControlWriteAt.delete(key);
        this.lastControlSentValue.delete(key);
      }
    }
  }

  private clearControlWrites(): void {
    for (const timer of this.controlWriteTimers.values()) {
      clearTimeout(timer);
    }
    this.controlWriteTimers.clear();
    this.pendingControlWrites.clear();
    this.lastControlWriteAt.clear();
    this.lastControlSentValue.clear();
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
