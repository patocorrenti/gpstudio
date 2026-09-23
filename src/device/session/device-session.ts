import { createBluetoothLink } from "@/bluetooth/detect";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";
import {
  controlByIndex,
  defaultValuesFor,
  modelById,
  modelsForKind,
  snapControlValue,
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
  decodePresetDump,
  type ChainDumpResult,
} from "@/device/chain-codec";
import { emptyUserIrNames, IrNameDecoder } from "@/device/ir-names";
import {
  emptyGp50Globals,
  isGlobalsDump,
  type DeviceGlobals,
  type FootswitchMode,
  type GlobalSysexKey,
  type RecMode,
} from "@/device/globals";
import {
  emptyPatchNames,
  IdentityDecoder,
  SysexAssembler,
  type IdentityEvent,
} from "@/device/identity";
import { capabilitiesForLink, type LinkMode } from "@/device/link";
import { describeMidi, type InboundMidiEvent } from "@/device/midi-log";
import type { DeviceModel } from "@/device/models";
import {
  currentPatchFilename,
  decodePrstFile,
  encodePrstFile,
  readDumpPatchBpm,
  readDumpPatchVolume,
  sanitizePatchName,
  writeDumpPatchBpm,
  writeDumpPatchVolume,
} from "@/device/patch-store";
import {
  applyGlobalsDump,
  applyLiveGlobal,
  mergeGlobalField,
  type GlobalsHost,
} from "@/device/session/globals";
import {
  applyLiveChainOrder,
  applyLiveModule,
  applyLivePatchVolume,
  applyLiveSlot,
  type ConnectedSnapshot,
  type LiveFollowHost,
} from "@/device/session/inbound";
import {
  encodeUploadedPatchWrites,
  overlayDumpPatchGlobals,
  UPLOAD_COMMIT_GAP_MS,
  UPLOAD_MODEL_GAP_MS,
  UPLOAD_WRITE_GAP_MS,
} from "@/device/session/patch-io";
import {
  clampPatch,
  cloneChain,
  chainSlotsEqual,
  isWorkingModified as workingPatchIsModified,
  patchDiffersFromBaseline,
  preserveExpEnabled,
  wrapPatch,
  type WorkingBaseline,
} from "@/device/session/working-patch";
import {
  controlWriteKey,
  FOOTSWITCH_MODE_WRITE_KEY,
  globalSysexWriteKey,
  MASTER_VOLUME_WRITE_KEY,
  PATCH_BPM_WRITE_KEY,
  PATCH_VOLUME_WRITE_KEY,
  SessionWriteQueue,
} from "@/device/session/writes";
import {
  encodeChainOrder,
  encodeChainRequest,
  encodeGlobals,
  encodeIdentity,
  encodeIrNames,
  encodeModule,
  encodePatch,
  encodePatchStore,
  encodeSlotModel,
} from "@/device/encode";
import type { LinkEndpoint } from "@/device/endpoint";
import { createMidiTransport } from "@/midi/detect";
import type { MidiEndpoint, MidiTransport } from "@/midi/types";

const EMPTY_INBOUND: InboundMidiEvent[] = [];
const INBOUND_LIMIT = 40;
const PATCH_VOLUME_MAX = 100;
const PATCH_BPM_MIN = 40;
const PATCH_BPM_MAX = 260;

export type SessionSync = "syncing" | "ready";
export type ChainSync = "idle" | "syncing";
export type UploadPatchResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "wrong-model" | "busy" | "disconnected" };

export type SessionSnapshot =
  | { status: "disconnected" }
  | {
      status: "connected";
      endpoint: LinkEndpoint;
      model: DeviceModel;
      patch: number;
      patchNames: (string | null)[];
      userIrNames: (string | null)[];
      /** GP-50 device globals; null on GP-5 until that model locks a read. */
      globals: DeviceGlobals | null;
      chain: AudioChain;
      chainSync: ChainSync;
      patchVolume: number | null;
      patchBpm: number | null;
      canExportPatch: boolean;
      modified: boolean;
      sync: SessionSync;
      linkMode: LinkMode;
    };

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
  private readonly irNames = new IrNameDecoder();
  private readonly sysex = new SysexAssembler();
  private syncGeneration = 0;
  private namesWaiters = new Set<() => void>();
  private patchWaiters = new Set<() => void>();
  private chainWaiters = new Set<() => void>();
  private chainRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** Target slot for an in-flight patch change; stale current-patch reports must not revert it. */
  private pendingPatchLoad: number | null = null;
  /** Last loaded or stored working patch (chain, volume, GP-50 BPM) for the selected slot. */
  private baseline: WorkingBaseline | null = null;
  /**
   * Download of an already edited patch keeps on-screen volume and BPM when the
   * refreshed dump arrives. Cleared once that dump is applied.
   */
  private keepPatchGlobalsOnDump = false;
  /** Next current-preset dump of a newly selected patch becomes the baseline. */
  private captureBaselineFromDump = false;
  /**
   * Quiet second current-preset request after a user or pedal patch change.
   * Connect, Reload, download, and upload leave this off. A match is discarded;
   * a mismatch is applied once and does not arm another request.
   */
  private patchConfirm: "off" | "after-apply" | "in-flight" = "off";
  private dropping = false;
  private readonly writes: SessionWriteQueue;

  constructor(
    transport: MidiTransport = createMidiTransport(),
    bluetooth: BluetoothLink = createBluetoothLink(),
  ) {
    this.transport = transport;
    this.bluetooth = bluetooth;
    this.writes = new SessionWriteQueue(
      (bytes) => this.sendBytes(bytes),
      () =>
        this.snapshot.status === "connected"
          ? { linkMode: this.snapshot.linkMode, model: this.snapshot.model }
          : null,
    );
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
    this.irNames.reset();
    this.sysex.reset();
    this.writes.clear();
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
        userIrNames: emptyUserIrNames(),
        globals: model === "gp50" ? emptyGp50Globals() : null,
        chain: defaultChain(model),
        chainSync: "idle",
        patchVolume: null,
        patchBpm: null,
        canExportPatch: false,
        modified: false,
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
        userIrNames: emptyUserIrNames(),
        globals: model === "gp50" ? emptyGp50Globals() : null,
        chain: defaultChain(model),
        chainSync: "idle",
        patchVolume: null,
        patchBpm: null,
        canExportPatch: false,
        modified: false,
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
      this.irNames.reset();
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
    if (next === this.snapshot.patch && this.snapshot.chainSync !== "syncing") {
      return;
    }
    this.dropWorkingBaseline();
    this.pendingPatchLoad = next;
    const chainSync =
      this.snapshot.sync === "ready" ? "syncing" : this.snapshot.chainSync;
    this.snapshot = { ...this.snapshot, patch: next, chainSync, modified: false };
    this.emitSnapshot();
    const bytes = encodePatch(this.snapshot.linkMode, next);
    await this.sendBytes(bytes);
    this.refreshChain(true, true);
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
    this.patchConfirm = "off";
    this.captureBaselineFromDump = false;
    this.writes.clear();
    this.chainDump.reset();
    this.beginChainRefresh();
    this.keepPatchGlobalsOnDump = this.workingDiffersFromBaseline();
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
    let dump = this.currentPatchDump;
    if (this.snapshot.modified) {
      dump = overlayDumpPatchGlobals(
        this.snapshot.model,
        this.currentPatchDump,
        this.snapshot.patchVolume,
        this.snapshot.patchBpm,
      );
    }
    const bytes = encodePrstFile({
      model: this.snapshot.model,
      name,
      dump,
    });
    if (!bytes) {
      return null;
    }
    return {
      filename: currentPatchFilename(this.snapshot.model, this.snapshot.patch, name),
      bytes,
    };
  }

  async uploadCurrentPatch(bytes: Uint8Array): Promise<UploadPatchResult> {
    if (this.snapshot.status !== "connected") {
      return { ok: false, reason: "disconnected" };
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return { ok: false, reason: "busy" };
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      return { ok: false, reason: "disconnected" };
    }
    const parsed = decodePrstFile(bytes);
    if (!parsed) {
      return { ok: false, reason: "invalid" };
    }
    if (parsed.model !== this.snapshot.model) {
      return { ok: false, reason: "wrong-model" };
    }
    const chain = decodePresetDump(parsed.dump, parsed.model, parsed.model);
    if (!chain) {
      return { ok: false, reason: "invalid" };
    }
    const previousExport = this.snapshot.canExportPatch;
    this.patchConfirm = "off";
    this.snapshot = {
      ...this.snapshot,
      chainSync: "syncing",
      canExportPatch: false,
      modified: false,
    };
    this.emitSnapshot();
    const steps = encodeUploadedPatchWrites(
      this.snapshot.model,
      this.snapshot.linkMode,
      chain,
      parsed.volume,
      parsed.bpm,
    );
    if (!steps) {
      if (this.snapshot.status === "connected") {
        this.snapshot = {
          ...this.snapshot,
          chainSync: "idle",
          canExportPatch: previousExport,
          modified: this.isWorkingModified(this.snapshot.chain, "idle"),
        };
        this.emitSnapshot();
      }
      return { ok: false, reason: "invalid" };
    }
    this.writes.clear();
    const linkMode = this.snapshot.linkMode;
    for (let index = 0; index < steps.length; index += 1) {
      if (this.snapshot.status !== "connected") {
        return { ok: false, reason: "disconnected" };
      }
      const step = steps[index];
      await this.sendBytes(step.bytes);
      const next = steps[index + 1];
      if (!next) {
        await this.delay(UPLOAD_COMMIT_GAP_MS[linkMode]);
        break;
      }
      await this.delay(
        step.kind === "model" ? UPLOAD_MODEL_GAP_MS[linkMode] : UPLOAD_WRITE_GAP_MS[linkMode],
      );
    }
    if (this.snapshot.status !== "connected") {
      return { ok: false, reason: "disconnected" };
    }
    this.refreshChain(false);
    return { ok: true };
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
    this.setChain(chain);
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
    this.setChain(chain);
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
    this.writes.clearForKind(kind);
    const values = defaultValuesFor(model);
    const chain = this.snapshot.chain.map((entry, slotIndex) =>
      slotIndex === index ? { ...entry, modelId: model.id, values } : entry,
    );
    this.setChain(chain);
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
    const control = controlByIndex(model, controlIndex, this.snapshot.model);
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
      this.setChain(chain);
    }
    if (unchanged && !options.flush) {
      return;
    }
    this.writes.queueControlWrite(kind, controlIndex, nextValue, options.flush === true);
  }

  /** Send the latest queued value for this control now (slider pointer up). */
  flushSlotControl(kind: EffectId, controlIndex: number): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    this.writes.flush(controlWriteKey(kind, controlIndex));
  }

  async setPatchVolume(value: number, options: { flush?: boolean } = {}): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Patch control is not available on this link.");
    }
  if (!Number.isFinite(value)) {
    return;
  }
  const next = Math.round(value);
  if (next < 0 || next > PATCH_VOLUME_MAX) {
    return;
  }
  this.stagePatchGlobal(PATCH_VOLUME_WRITE_KEY, next, options.flush === true);
  }

  async setPatchBpm(value: number, options: { flush?: boolean } = {}): Promise<void> {
    if (this.snapshot.status !== "connected") {
      throw new Error("No pedal is connected.");
    }
    if (this.snapshot.model !== "gp50") {
      return;
    }
    if (this.snapshot.sync !== "ready" || this.snapshot.chainSync === "syncing") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Patch control is not available on this link.");
    }
  if (!Number.isFinite(value)) {
    return;
  }
  const next = Math.round(value);
  if (next < PATCH_BPM_MIN || next > PATCH_BPM_MAX) {
    return;
  }
  this.stagePatchGlobal(PATCH_BPM_WRITE_KEY, next, options.flush === true);
  }

  async setMasterVolume(value: number, options: { flush?: boolean } = {}): Promise<void> {
    if (this.snapshot.status !== "connected" || !this.snapshot.globals) {
      return;
    }
    if (this.snapshot.model !== "gp50") {
      return;
    }
    if (this.snapshot.sync !== "ready") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Global settings are not available on this link.");
    }
    if (!Number.isFinite(value)) {
      return;
    }
    const next = Math.round(value);
    if (next < 0 || next > PATCH_VOLUME_MAX) {
      return;
    }
    this.snapshot = {
      ...this.snapshot,
      globals: mergeGlobalField(this.snapshot.globals, "masterVolume", next),
    };
    this.emitSnapshot();
    this.writes.queueGlobalWrite(
      MASTER_VOLUME_WRITE_KEY,
      { kind: "masterVolume", value: next },
      options.flush === true,
    );
  }

  async setFootswitchMode(mode: FootswitchMode): Promise<void> {
    if (this.snapshot.status !== "connected" || !this.snapshot.globals) {
      return;
    }
    if (this.snapshot.model !== "gp50") {
      return;
    }
    if (this.snapshot.sync !== "ready") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Global settings are not available on this link.");
    }
    this.snapshot = {
      ...this.snapshot,
      globals: mergeGlobalField(this.snapshot.globals, "footswitchMode", mode),
    };
    this.emitSnapshot();
    this.writes.queueGlobalWrite(
      FOOTSWITCH_MODE_WRITE_KEY,
      { kind: "footswitchMode", value: mode },
      true,
    );
  }

  async setGlobalSysex(
    key: GlobalSysexKey,
    value: number | boolean | RecMode,
    options: { flush?: boolean } = {},
  ): Promise<void> {
    if (this.snapshot.status !== "connected" || !this.snapshot.globals) {
      return;
    }
    if (this.snapshot.model !== "gp50") {
      return;
    }
    if (this.snapshot.sync !== "ready") {
      return;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).commandToPedal) {
      throw new Error("Global settings are not available on this link.");
    }
    this.snapshot = {
      ...this.snapshot,
      globals: mergeGlobalField(this.snapshot.globals, key, value),
    };
    this.emitSnapshot();
    this.writes.queueGlobalWrite(
      globalSysexWriteKey(key),
      { kind: "sysex", key, value },
      options.flush === true,
    );
  }

  flushGlobalSetting(key: "masterVolume" | GlobalSysexKey): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const writeKey = key === "masterVolume" ? MASTER_VOLUME_WRITE_KEY : globalSysexWriteKey(key);
    this.writes.flush(writeKey);
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
    this.patchConfirm = "off";
    this.captureBaselineFromDump = true;
    this.armChainRefreshTimer();
    await this.sendChainRequest(generation);
    await this.sendIrNameRequest(generation);
    await this.sendGlobalsRequest(generation);
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

  /** Device-global IR names. Sent once per connect, after the current-preset ask, without a waiter. */
  private async sendIrNameRequest(generation: number): Promise<void> {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    await this.sendBytes(encodeIrNames(this.snapshot.linkMode));
  }

  /** GP-50 device globals. Once per connect after the current-preset ask; not on GP-5. */
  private async sendGlobalsRequest(generation: number): Promise<void> {
    if (!this.isCurrentGeneration(generation) || this.snapshot.status !== "connected") {
      return;
    }
    if (this.snapshot.model !== "gp50") {
      return;
    }
    await this.sendBytes(encodeGlobals(this.snapshot.linkMode));
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
    const host = this.liveFollowHost();
    if (!host) {
      return;
    }
    for (const message of this.sysex.push(bytes)) {
      const liveVolume = applyLivePatchVolume(host, message);
      const liveOnOff = applyLiveModule(host, message);
      const liveOrder = applyLiveChainOrder(host, message);
      const liveSlot = applyLiveSlot(host, message);
      const globalsHost = this.globalsHost();
      const liveGlobal = globalsHost ? applyLiveGlobal(globalsHost, message) : false;
      const globalsDump = globalsHost ? applyGlobalsDump(globalsHost, message) : false;
      if (
        !liveVolume &&
        !liveOnOff &&
        !liveOrder &&
        !liveSlot &&
        !liveGlobal &&
        !globalsDump &&
        this.snapshot.status === "connected"
      ) {
        this.applyIdentity(this.identity.push(message));
      }
      if (this.snapshot.status === "connected") {
        this.applyIrNames(this.irNames.push(message));
      }
      if (this.snapshot.status === "connected" && !isGlobalsDump(message)) {
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
      if (this.pendingPatchLoad !== null && next !== this.pendingPatchLoad) {
        this.releaseWaiters(this.patchWaiters);
        return;
      }
      const changed = next !== this.snapshot.patch;
      this.snapshot = {
        ...this.snapshot,
        patch: next,
        modified: changed ? false : this.snapshot.modified,
      };
      this.emitSnapshot();
      this.releaseWaiters(this.patchWaiters);
      if (changed) {
        this.dropWorkingBaseline();
        this.pendingPatchLoad = next;
        this.refreshChain(true, true);
      }
      return;
    }
    if (event.type === "patch-changed") {
      if (this.snapshot.sync === "ready") {
        void this.sendIdentity("current-patch", this.syncGeneration);
      }
    }
  }

  private refreshChain(captureBaseline = false, confirmPatch = false): void {
    if (this.snapshot.status !== "connected" || this.snapshot.sync !== "ready") {
      return;
    }
    this.keepPatchGlobalsOnDump = false;
    this.patchConfirm = confirmPatch ? "after-apply" : "off";
    this.captureBaselineFromDump = captureBaseline;
    this.writes.clear();
    this.chainDump.reset();
    this.beginChainRefresh();
    void this.sendChainRequest(this.syncGeneration);
  }

  private applyIrNames(names: (string | null)[] | null): void {
    if (!names || this.snapshot.status !== "connected") {
      return;
    }
    this.snapshot = { ...this.snapshot, userIrNames: names };
    this.emitSnapshot();
  }

  private applyChain(result: ChainDumpResult | null): void {
    if (!result || this.snapshot.status !== "connected") {
      return;
    }
    if (this.patchConfirm === "in-flight") {
      this.applyPatchConfirmation(result);
      return;
    }
    const chain = preserveExpEnabled(this.snapshot.chain, result.chain);
    const armConfirmation = this.patchConfirm === "after-apply";
    // Bluetooth often gets a stale first dump; keep the busy overlay until confirm.
    const holdBusyForConfirm =
      armConfirmation && this.snapshot.linkMode === "bluetooth";
    const patch = this.snapshot.patch;
    const generation = this.syncGeneration;
    this.pendingPatchLoad = null;
    if (!holdBusyForConfirm) {
      this.clearChainRefreshTimer();
    }
    const globals = this.patchGlobalsFromDump(result.dump);
    const keepGlobals = this.keepPatchGlobalsOnDump && !this.captureBaselineFromDump;
    this.keepPatchGlobalsOnDump = false;
    this.currentPatchDump = result.dump;
    if (this.captureBaselineFromDump) {
      this.baseline = {
        chain: cloneChain(chain),
        patchVolume: globals.patchVolume,
        patchBpm: globals.patchBpm,
      };
      this.captureBaselineFromDump = false;
    }
    if (!keepGlobals) {
      this.snapshot = {
        ...this.snapshot,
        patchVolume: globals.patchVolume,
        patchBpm: globals.patchBpm,
      };
    }
    this.setChain(chain, {
      chainSync: holdBusyForConfirm ? "syncing" : "idle",
      canExportPatch: !holdBusyForConfirm,
    });
    this.releaseWaiters(this.chainWaiters);
    if (
      armConfirmation &&
      this.patchConfirm === "after-apply" &&
      this.snapshot.status === "connected" &&
      this.snapshot.patch === patch &&
      this.syncGeneration === generation &&
      this.snapshot.chainSync === (holdBusyForConfirm ? "syncing" : "idle")
    ) {
      this.requestPatchConfirmation();
      if (holdBusyForConfirm) {
        this.armChainRefreshTimer();
      }
    }
  }

  /**
   * One current-preset request after a patch-change dump.
   * USB: no overlay. Bluetooth: overlay stays until the confirmation dump arrives.
   */
  private requestPatchConfirmation(): void {
    if (this.snapshot.status !== "connected") {
      this.patchConfirm = "off";
      return;
    }
    this.patchConfirm = "in-flight";
    this.chainDump.reset();
    void this.sendChainRequest(this.syncGeneration);
  }

  private applyPatchConfirmation(result: ChainDumpResult): void {
    this.patchConfirm = "off";
    if (this.snapshot.status !== "connected") {
      return;
    }
    const finishBusy = this.snapshot.chainSync === "syncing";
    const chain = preserveExpEnabled(this.snapshot.chain, result.chain);
    const edited =
      this.snapshot.modified || this.writes.hasPending();
    if (edited) {
      if (finishBusy) {
        this.clearChainRefreshTimer();
        this.setChain(this.snapshot.chain, { chainSync: "idle", canExportPatch: true });
      }
      return;
    }
    // First dump on Bluetooth is often stale for volume/BPM even when the chain
    // already matches. Always take those globals from the confirmation dump.
    const globals = this.patchGlobalsFromDump(result.dump);
    this.currentPatchDump = result.dump;
    this.snapshot = {
      ...this.snapshot,
      patchVolume: globals.patchVolume,
      patchBpm: globals.patchBpm,
    };
    if (chainSlotsEqual(chain, this.snapshot.chain)) {
      this.baseline = {
        chain: this.baseline?.chain ?? cloneChain(this.snapshot.chain),
        patchVolume: globals.patchVolume,
        patchBpm: globals.patchBpm,
      };
      if (finishBusy) {
        this.clearChainRefreshTimer();
        this.setChain(this.snapshot.chain, { chainSync: "idle", canExportPatch: true });
      } else {
        this.snapshot = {
          ...this.snapshot,
          modified: this.isWorkingModified(this.snapshot.chain, this.snapshot.chainSync),
        };
        this.emitSnapshot();
      }
      return;
    }
    this.baseline = {
      chain: cloneChain(chain),
      patchVolume: globals.patchVolume,
      patchBpm: globals.patchBpm,
    };
    this.clearChainRefreshTimer();
    this.setChain(chain, { chainSync: "idle", canExportPatch: true });
  }

  private liveFollowHost(): LiveFollowHost | null {
    const session = this;
    if (session.snapshot.status !== "connected") {
      return null;
    }
    return {
      get snapshot() {
        return session.snapshot as ConnectedSnapshot;
      },
      get currentPatchDump() {
        return session.currentPatchDump;
      },
      dropPatchWrite: (key, value) => session.writes.dropPatchWrite(key, value),
      dropControlWrite: (key, value) => session.writes.dropControlWrite(key, value),
      clearControlWritesForKind: (kind) => session.writes.clearForKind(kind),
      setChain: (chain) => session.setChain(chain),
      isWorkingModified: (chain, chainSync) => session.isWorkingModified(chain, chainSync),
      assignSnapshot: (next) => {
        session.snapshot = next;
      },
      emitSnapshot: () => session.emitSnapshot(),
    };
  }

  private globalsHost(): GlobalsHost | null {
    const session = this;
    if (session.snapshot.status !== "connected" || !session.snapshot.globals) {
      return null;
    }
    return {
      get snapshot() {
        return session.snapshot as ConnectedSnapshot;
      },
      dropGlobalWrite: (key, value) => session.writes.dropGlobalWrite(key, value),
      assignSnapshot: (next) => {
        session.snapshot = next;
      },
      emitSnapshot: () => session.emitSnapshot(),
    };
  }

  private beginChainRefresh(): void {
    if (this.snapshot.status !== "connected" || this.snapshot.sync !== "ready") {
      return;
    }
    this.dropPatchDump();
    this.snapshot = {
      ...this.snapshot,
      chainSync: "syncing",
      canExportPatch: false,
      modified: false,
    };
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
      this.patchConfirm = "off";
      this.snapshot = {
        ...this.snapshot,
        chainSync: "idle",
        canExportPatch: this.currentPatchDump !== null,
        modified: this.isWorkingModified(this.snapshot.chain, "idle"),
      };
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
    this.pendingPatchLoad = null;
    this.patchConfirm = "off";
    this.dropWorkingBaseline();
    this.clearChainRefreshTimer();
    this.writes.clear();
    this.dropPatchDump();
    this.releaseWaiters(this.namesWaiters);
    this.releaseWaiters(this.patchWaiters);
    this.releaseWaiters(this.chainWaiters);
  }

  private dropPatchDump(): void {
    this.currentPatchDump = null;
  }

  private dropWorkingBaseline(): void {
    this.baseline = null;
    this.captureBaselineFromDump = false;
    this.keepPatchGlobalsOnDump = false;
  }

  private patchGlobalsFromDump(dump: Uint8Array): {
    patchVolume: number | null;
    patchBpm: number | null;
  } {
    if (this.snapshot.status !== "connected") {
      return { patchVolume: null, patchBpm: null };
    }
    return {
      patchVolume: readDumpPatchVolume(this.snapshot.model, dump),
      patchBpm:
        this.snapshot.model === "gp50" ? readDumpPatchBpm(this.snapshot.model, dump) : null,
    };
  }

  private workingDiffersFromBaseline(): boolean {
    if (this.snapshot.status !== "connected" || this.baseline === null) {
      return false;
    }
    return patchDiffersFromBaseline(
      this.baseline,
      this.snapshot.chain,
      this.snapshot.patchVolume,
      this.snapshot.patchBpm,
      this.snapshot.model,
    );
  }

  private isWorkingModified(chain: AudioChain, chainSync: ChainSync): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    return workingPatchIsModified(
      this.baseline,
      chain,
      chainSync,
      this.snapshot.patchVolume,
      this.snapshot.patchBpm,
      this.snapshot.model,
    );
  }

  private setChain(
    chain: AudioChain,
    extra: { chainSync?: ChainSync; canExportPatch?: boolean } = {},
  ): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const chainSync = extra.chainSync ?? this.snapshot.chainSync;
    this.snapshot = {
      ...this.snapshot,
      ...extra,
      chain,
      chainSync,
      modified: this.isWorkingModified(chain, chainSync),
    };
    this.emitSnapshot();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
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
    if (dest === this.snapshot.patch) {
      this.baseline = {
        chain: cloneChain(this.snapshot.chain),
        patchVolume: this.snapshot.patchVolume,
        patchBpm: this.snapshot.patchBpm,
      };
      this.snapshot = { ...this.snapshot, patchNames, modified: false };
    } else {
      this.snapshot = { ...this.snapshot, patchNames };
    }
    this.emitSnapshot();
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }

  private stagePatchGlobal(key: string, value: number, flush: boolean): void {
    if (this.snapshot.status !== "connected") {
      return;
    }
    const current =
      key === PATCH_VOLUME_WRITE_KEY ? this.snapshot.patchVolume : this.snapshot.patchBpm;
    const unchanged = current === value;
    if (!unchanged) {
      this.snapshot = {
        ...this.snapshot,
        patchVolume: key === PATCH_VOLUME_WRITE_KEY ? value : this.snapshot.patchVolume,
        patchBpm: key === PATCH_BPM_WRITE_KEY ? value : this.snapshot.patchBpm,
      };
      this.snapshot = {
        ...this.snapshot,
        modified: this.isWorkingModified(this.snapshot.chain, this.snapshot.chainSync),
      };
      if (this.currentPatchDump) {
        if (key === PATCH_VOLUME_WRITE_KEY) {
          writeDumpPatchVolume(this.snapshot.model, this.currentPatchDump, value);
        } else if (key === PATCH_BPM_WRITE_KEY && this.snapshot.model === "gp50") {
          writeDumpPatchBpm(this.snapshot.model, this.currentPatchDump, value);
        }
      }
      this.emitSnapshot();
    }
    if (unchanged && !flush) {
      return;
    }
    this.writes.queuePatchWrite(key, value, flush);
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
