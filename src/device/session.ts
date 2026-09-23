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
  isEffectSlot,
  reorderChain,
  type AudioChain,
  type ChainSlotId,
  type EffectId,
} from "@/device/chain";
import {
  ChainDecoder,
  decodeLiveChainOrder,
  decodeLiveOnOffChanges,
  decodeLivePatchVolume,
  decodeLiveSlotControl,
  decodeLiveSlotModel,
  decodePresetDump,
  type ChainDumpResult,
} from "@/device/chain-codec";
import {
  encodeChainOrder,
  encodeChainRequest,
  encodeIdentity,
  encodeIrNames,
  encodeModule,
  encodePatch,
  encodePatchBpm,
  encodePatchStore,
  encodePatchTempoCc,
  encodePatchVolume,
  encodePatchVolumeCc,
  encodeSlotControl,
  encodeSlotModel,
} from "@/device/encode";
import type { LinkEndpoint } from "@/device/endpoint";
import {
  emptyUserIrNames,
  encodeIrNameDump,
  IrNameDecoder,
  USER_IR_COUNT,
} from "@/device/ir-names";
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
  decodePrstFile,
  encodePrstFile,
  readDumpPatchBpm,
  readDumpPatchVolume,
  sanitizePatchName,
  writeDumpPatchBpm,
  writeDumpPatchVolume,
} from "@/device/patch-store";
import { GP5_TOB_PRST_HEX, GP50_TOB_PRST_HEX } from "@/device/prst-tob-fixtures";
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
/**
 * Upload paces SETs. USB `output.send` and BLE `writeValueWithoutResponse`
 * both return before the pedal has applied the previous SysEx; a burst drops
 * trailing writes (often store `114a`). Gaps are apply-only, not the slider throttle.
 */
const UPLOAD_WRITE_GAP_MS = { usb: 20, bluetooth: 40 } as const;
const UPLOAD_MODEL_GAP_MS = { usb: 50, bluetooth: 80 } as const;
const UPLOAD_COMMIT_GAP_MS = { usb: 80, bluetooth: 120 } as const;

type UploadApplyStep = {
  kind: "model" | "control" | "order" | "module" | "global";
  bytes: Uint8Array;
};

function controlWriteKey(kind: EffectId, index: number): string {
  return `${kind}:${index}`;
}

const PATCH_VOLUME_WRITE_KEY = "patch-volume";
const PATCH_BPM_WRITE_KEY = "patch-bpm";
const PATCH_VOLUME_MAX = 100;
const PATCH_BPM_MIN = 40;
const PATCH_BPM_MAX = 260;

type WorkingBaseline = {
  chain: AudioChain;
  patchVolume: number | null;
  patchBpm: number | null;
};

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
      chain: AudioChain;
      chainSync: ChainSync;
      patchVolume: number | null;
      patchBpm: number | null;
      canExportPatch: boolean;
      modified: boolean;
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

function chainSlotsEqual(left: AudioChain, right: AudioChain): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a.id !== b.id || a.enabled !== b.enabled || a.modelId !== b.modelId) {
      return false;
    }
    const aValues = a.values;
    const bValues = b.values;
    if (aValues === undefined || bValues === undefined) {
      if (aValues !== bValues) {
        return false;
      }
      continue;
    }
    if (aValues.length !== bValues.length) {
      return false;
    }
    for (let valueIndex = 0; valueIndex < aValues.length; valueIndex += 1) {
      if (aValues[valueIndex] !== bValues[valueIndex]) {
        return false;
      }
    }
  }
  return true;
}

function cloneChain(chain: AudioChain): AudioChain {
  return chain.map((slot) => ({
    ...slot,
    values: slot.values ? slot.values.slice() : undefined,
  }));
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
  private readonly pendingControlWrites = new Map<
    string,
    { kind: EffectId; index: number; value: number }
  >();
  private readonly pendingPatchWrites = new Map<string, number>();
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
    this.irNames.reset();
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
        userIrNames: emptyUserIrNames(),
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
    this.clearControlWrites();
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
      dump = this.currentPatchDump.slice();
      if (this.snapshot.patchVolume !== null) {
        writeDumpPatchVolume(this.snapshot.model, dump, this.snapshot.patchVolume);
      }
      if (this.snapshot.model === "gp50" && this.snapshot.patchBpm !== null) {
        writeDumpPatchBpm(this.snapshot.model, dump, this.snapshot.patchBpm);
      }
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
    const steps = this.encodeUploadedPatchWrites(chain, parsed.volume, parsed.bpm);
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
    this.clearControlWrites();
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
    this.clearControlWritesForKind(kind);
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
      this.setChain(chain);
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
    if (!Number.isFinite(value) || value < 0 || value > PATCH_VOLUME_MAX) {
      return;
    }
    this.stagePatchGlobal(PATCH_VOLUME_WRITE_KEY, Math.round(value), options.flush === true);
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
    if (!Number.isFinite(value) || value < PATCH_BPM_MIN || value > PATCH_BPM_MAX) {
      return;
    }
    this.stagePatchGlobal(PATCH_BPM_WRITE_KEY, Math.round(value), options.flush === true);
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
      const liveVolume = this.applyLivePatchVolume(message);
      const liveOnOff = this.applyLiveModule(message);
      const liveOrder = this.applyLiveChainOrder(message);
      const liveSlot = this.applyLiveSlot(message);
      if (
        !liveVolume &&
        !liveOnOff &&
        !liveOrder &&
        !liveSlot &&
        this.snapshot.status === "connected"
      ) {
        this.applyIdentity(this.identity.push(message));
      }
      if (this.snapshot.status === "connected") {
        this.applyIrNames(this.irNames.push(message));
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
    this.clearControlWrites();
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
    if (
      chainSlotsEqual(chain, this.snapshot.chain) ||
      this.snapshot.modified ||
      this.pendingControlWrites.size > 0 ||
      this.pendingPatchWrites.size > 0
    ) {
      if (finishBusy) {
        this.clearChainRefreshTimer();
        this.setChain(this.snapshot.chain, { chainSync: "idle", canExportPatch: true });
      }
      return;
    }
    const globals = this.patchGlobalsFromDump(result.dump);
    this.currentPatchDump = result.dump;
    this.baseline = {
      chain: cloneChain(chain),
      patchVolume: globals.patchVolume,
      patchBpm: globals.patchBpm,
    };
    this.snapshot = {
      ...this.snapshot,
      patchVolume: globals.patchVolume,
      patchBpm: globals.patchBpm,
    };
    this.clearChainRefreshTimer();
    this.setChain(chain, { chainSync: "idle", canExportPatch: true });
  }

  private applyLivePatchVolume(message: Uint8Array): boolean {
    if (this.snapshot.status !== "connected") {
      return false;
    }
    const volume = decodeLivePatchVolume(message);
    if (volume === null) {
      return false;
    }
    if (!capabilitiesForLink(this.snapshot.linkMode).liveFromPedal) {
      return true;
    }
    if (this.snapshot.chainSync === "syncing") {
      return true;
    }
    this.dropPatchWrite(PATCH_VOLUME_WRITE_KEY, volume);
    if (this.snapshot.patchVolume === volume) {
      return true;
    }
    if (this.currentPatchDump) {
      writeDumpPatchVolume(this.snapshot.model, this.currentPatchDump, volume);
    }
    this.snapshot = {
      ...this.snapshot,
      patchVolume: volume,
    };
    this.snapshot = {
      ...this.snapshot,
      modified: this.isWorkingModified(this.snapshot.chain, this.snapshot.chainSync),
    };
    this.emitSnapshot();
    return true;
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
    if (this.snapshot.chainSync === "syncing") {
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
    if (this.snapshot.chainSync === "syncing") {
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
    this.setChain(chain);
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
    this.setChain(chain);
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
    this.setChain(chain);
  }

  /** Module and EXP on/off only. Inbound CC 7, CC 73, and CC 74 do not change the snapshot. */
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
    this.setChain(chain);
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
    this.clearControlWrites();
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
    return this.patchDiffers(this.snapshot.chain);
  }

  private patchDiffers(chain: AudioChain): boolean {
    if (this.baseline === null || this.snapshot.status !== "connected") {
      return false;
    }
    if (!chainSlotsEqual(chain, this.baseline.chain)) {
      return true;
    }
    if (this.snapshot.patchVolume !== this.baseline.patchVolume) {
      return true;
    }
    return (
      this.snapshot.model === "gp50" && this.snapshot.patchBpm !== this.baseline.patchBpm
    );
  }

  private isWorkingModified(chain: AudioChain, chainSync: ChainSync): boolean {
    if (chainSync === "syncing" || this.baseline === null) {
      return false;
    }
    return this.patchDiffers(chain);
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

  private encodeUploadedPatchWrites(
    chain: AudioChain,
    volume: number | null,
    bpm: number | null,
  ): UploadApplyStep[] | null {
    if (this.snapshot.status !== "connected") {
      return null;
    }
    const linkMode = this.snapshot.linkMode;
    const steps: UploadApplyStep[] = [];
    for (const slot of chain) {
      if (!isEffectSlot(slot.id) || slot.modelId === undefined || slot.values === undefined) {
        continue;
      }
      const model = modelById(slot.modelId);
      if (!model || model.kind !== slot.id || !model.devices.has(this.snapshot.model)) {
        continue;
      }
      const modelPackets = encodeSlotModel(linkMode, slot.id, model.wire);
      if (!modelPackets) {
        continue;
      }
      for (const bytes of modelPackets) {
        steps.push({ kind: "model", bytes });
      }
      for (const control of model.controls) {
        const value = slot.values[control.index];
        if (value === undefined) {
          continue;
        }
        const controlPackets = encodeSlotControl(linkMode, slot.id, control.index, value);
        if (!controlPackets) {
          continue;
        }
        for (const bytes of controlPackets) {
          steps.push({ kind: "control", bytes });
        }
      }
    }
    const orderPackets = encodeChainOrder(linkMode, chain);
    if (!orderPackets) {
      return null;
    }
    for (const bytes of orderPackets) {
      steps.push({ kind: "order", bytes });
    }
    for (const slot of chain) {
      if (!isEffectSlot(slot.id)) {
        continue;
      }
      steps.push({ kind: "module", bytes: encodeModule(linkMode, slot.id, slot.enabled) });
    }
    if (volume !== null) {
      const volumePackets = encodePatchVolume(linkMode, volume);
      if (volumePackets) {
        for (const bytes of volumePackets) {
          steps.push({ kind: "global", bytes });
        }
      }
    }
    if (bpm !== null) {
      const bpmPackets = encodePatchBpm(linkMode, bpm);
      if (bpmPackets) {
        for (const bytes of bpmPackets) {
          steps.push({ kind: "global", bytes });
        }
      }
    }
    return steps;
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
      this.emitSnapshot();
    }
    if (unchanged && !flush) {
      return;
    }
    this.queuePatchWrite(key, value, flush);
  }

  private queuePatchWrite(key: string, value: number, flush: boolean): void {
    this.pendingPatchWrites.set(key, value);
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
    const send =
      key === PATCH_VOLUME_WRITE_KEY || key === PATCH_BPM_WRITE_KEY
        ? () => this.sendPendingPatch(key)
        : () => this.sendPendingControl(key);
    this.controlSendTail = this.controlSendTail.then(send).catch(() => undefined);
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

  private async sendPendingPatch(key: string): Promise<void> {
    const value = this.pendingPatchWrites.get(key);
    if (value === undefined || this.snapshot.status !== "connected") {
      return;
    }
    this.pendingPatchWrites.delete(key);
    if (this.lastControlSentValue.get(key) === value) {
      return;
    }
    if (key === PATCH_BPM_WRITE_KEY && this.snapshot.model !== "gp50") {
      return;
    }
    const packets =
      key === PATCH_VOLUME_WRITE_KEY
        ? encodePatchVolumeCc(this.snapshot.linkMode, value)
        : encodePatchTempoCc(this.snapshot.linkMode, value);
    if (!packets) {
      return;
    }
    this.lastControlSentValue.set(key, value);
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

  private dropPatchWrite(key: string, sentValue: number): void {
    const timer = this.controlWriteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.controlWriteTimers.delete(key);
    }
    this.pendingPatchWrites.delete(key);
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
    this.pendingPatchWrites.clear();
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

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function assertUploadSessionFixtures(): void {
  const gp50 = bytesFromHex(GP50_TOB_PRST_HEX);
  const gp5 = bytesFromHex(GP5_TOB_PRST_HEX);
  const decoded = decodePrstFile(gp50);
  if (!decoded) {
    throw new Error("GP-50 TOB must decode for upload");
  }
  const chain = decodePresetDump(decoded.dump, "gp50", "gp50");
  if (!chain) {
    throw new Error("GP-50 TOB dump must decode as a chain");
  }
  const order = encodeChainOrder("usb", chain);
  const store = encodePatchStore("usb", 5, decoded.name);
  const recall = encodePatch("usb", 5);
  if (!order || !store) {
    throw new Error("Upload apply must encode chain-order and store 114a");
  }
  if (recall[0] !== 0xb0 || recall[1] !== 0x00) {
    throw new Error("Patch recall fixture must be CC 0");
  }
  for (const packet of [...order, ...store]) {
    if (packet[0] === 0xb0 && packet[1] === 0x00) {
      throw new Error("Upload writes must not include extra patch recall");
    }
  }
  if (decodePrstFile(gp5)?.model === "gp50") {
    throw new Error("A GP-5 file must not classify as GP-50");
  }
}

assertUploadSessionFixtures();

function recordingUsb(): {
  sent: Uint8Array[];
  transport: MidiTransport;
} {
  const sent: Uint8Array[] = [];
  let open = false;
  return {
    sent,
    transport: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes) => {
        sent.push(Uint8Array.from(bytes));
      },
      subscribe: () => () => undefined,
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      close: async () => {
        open = false;
      },
      sysexEnabled: () => false,
    },
  };
}

function stubBluetooth(): BluetoothLink {
  let open = false;
  return {
    discover: async () => [],
    open: async () => {
      open = true;
    },
    send: async () => undefined,
    subscribe: () => () => undefined,
    subscribeDisconnect: () => () => undefined,
    isOpen: () => open,
    resetInbound: () => undefined,
    close: async () => {
      open = false;
    },
  };
}

async function assertUploadRejectsWithoutMidi(): Promise<void> {
  const usb = recordingUsb();
  const session = new DeviceSession(usb.transport, stubBluetooth());
  await session.connect(
    { id: "usb-1", label: "GP-50", kind: "usb-midi" },
    "gp50",
  );
  const sentAfterConnect = usb.sent.length;
  const invalid = await session.uploadCurrentPatch(new Uint8Array([0x00, 0x01, 0x02]));
  const wrong = await session.uploadCurrentPatch(bytesFromHex(GP5_TOB_PRST_HEX));
  const disconnected = await new DeviceSession(
    recordingUsb().transport,
    stubBluetooth(),
  ).uploadCurrentPatch(bytesFromHex(GP50_TOB_PRST_HEX));
  if (invalid.ok || invalid.reason !== "invalid") {
    throw new Error("Invalid bytes must return without sending MIDI");
  }
  if (wrong.ok || wrong.reason !== "wrong-model") {
    throw new Error("Wrong-model bytes must return without sending MIDI");
  }
  if (disconnected.ok || disconnected.reason !== "disconnected") {
    throw new Error("Disconnected upload must no-op");
  }
  if (usb.sent.length !== sentAfterConnect) {
    throw new Error("Rejected upload must not send MIDI");
  }
}

void assertUploadRejectsWithoutMidi();

function scriptedBluetooth(): {
  sent: Uint8Array[];
  push: (bytes: Uint8Array) => void;
  link: BluetoothLink;
} {
  const sent: Uint8Array[] = [];
  let handler: ((bytes: Uint8Array) => void) | null = null;
  let open = false;
  return {
    sent,
    push(bytes) {
      handler?.(bytes);
    },
    link: {
      discover: async () => [],
      open: async () => {
        open = true;
      },
      send: async (bytes) => {
        sent.push(Uint8Array.from(bytes));
      },
      subscribe: (next) => {
        handler = next;
        return () => {
          if (handler === next) {
            handler = null;
          }
        };
      },
      subscribeDisconnect: () => () => undefined,
      isOpen: () => open,
      resetInbound: () => undefined,
      close: async () => {
        open = false;
      },
    },
  };
}

function packetsEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function isPatchRecall(bytes: Uint8Array): boolean {
  const midi = bytes[0] === 0x80 && bytes[1] === 0x80 ? bytes.subarray(2) : bytes;
  return midi[0] === 0xb0 && midi[1] === 0x00;
}

function bluetoothNameList(): Uint8Array {
  const payload = new Uint8Array(4000);
  const midi = new Uint8Array(10 + payload.length);
  midi[0] = 0xf0;
  midi[3] = 1;
  midi[4] = 5;
  midi.set(payload, 9);
  midi[midi.length - 1] = 0xf7;
  return midi;
}

function currentPatchZero(): Uint8Array {
  const midi = new Uint8Array(16);
  midi[0] = 0xf0;
  midi[3] = 0;
  midi[4] = 1;
  midi[9] = 1;
  midi[10] = 2;
  midi[11] = 4;
  midi[12] = 3;
  midi[15] = 0xf7;
  return midi;
}

function writeDumpNibbles(data: Uint8Array, start: number, packed: Uint8Array): void {
  for (let index = 0; index < packed.length; index += 1) {
    data[start + index * 2] = (packed[index] >> 4) & 0x0f;
    data[start + index * 2 + 1] = packed[index] & 0x0f;
  }
}

function gp50UsbChainWithCab(wire: Uint8Array, volume: number): Uint8Array[] {
  const merged = new Uint8Array(27 * 38);
  for (let slot = 0; slot < 10; slot += 1) {
    merged[243 + slot * 2] = slot;
  }
  merged[226] |= 1;
  writeDumpNibbles(merged, 302, wire);
  const packed = new Uint8Array(4);
  new DataView(packed.buffer).setFloat32(0, volume, true);
  writeDumpNibbles(merged, 614, packed);
  const packets: Uint8Array[] = [];
  for (let index = 0; index < 27; index += 1) {
    const midi = new Uint8Array(48);
    midi[0] = 0xf0;
    midi[3] = 1;
    midi[4] = 11;
    midi[5] = (index >> 4) & 0x0f;
    midi[6] = index & 0x0f;
    midi.set(merged.subarray(index * 38, (index + 1) * 38), 9);
    midi[47] = 0xf7;
    packets.push(midi);
  }
  return packets;
}

function liveCabUserIr(): Uint8Array {
  const live = new Uint8Array(30);
  live[0] = 0xf0;
  live[3] = 0;
  live[4] = 1;
  live[8] = 0x0a;
  live[9] = 1;
  live[10] = 2;
  live[11] = 4;
  live[12] = 0x07;
  live[14] = 4;
  writeDumpNibbles(live, 21, Uint8Array.from([0x02, 0x00, 0x10, 0x0a]));
  live[29] = 0xf7;
  return live;
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function untilReady(label: string, ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (ready()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error(label);
}

async function assertUserIrSession(): Promise<void> {
  const usb = recordingUsb();
  const bluetooth = scriptedBluetooth();
  const session = new DeviceSession(usb.transport, bluetooth.link);
  const irRequest = encodeIrNames("bluetooth");
  const irCount = () => bluetooth.sent.filter((packet) => packetsEqual(packet, irRequest)).length;
  try {
    await session.connect({ id: "ble-1", label: "GP-50", kind: "bluetooth" }, "gp50");
    await untilReady("Identity sync did not request the name list", () => bluetooth.sent.length > 0);
    await tick();
    bluetooth.push(bluetoothNameList());
    await untilReady("Identity sync did not request the current patch", () => bluetooth.sent.length > 1);
    await tick();
    bluetooth.push(currentPatchZero());
    await untilReady("Ready state waited for the IR-name dump", () => {
      const snapshot = session.getSnapshot();
      return snapshot.status === "connected" && snapshot.sync === "ready" && irCount() === 1;
    });
    const beforeNames = session.getSnapshot();
    if (beforeNames.status !== "connected" || beforeNames.userIrNames.some((name) => name !== null)) {
      throw new Error("IR names must stay empty until the dump arrives");
    }
    if (bluetooth.sent.some(isPatchRecall)) {
      throw new Error("Connect must not send patch recall to load IR names");
    }
    const named = emptyUserIrNames();
    named[2] = "Greenback 412";
    const sentBeforeDump = bluetooth.sent.length;
    for (const packet of encodeIrNameDump(named)) {
      bluetooth.push(packet);
    }
    const namedSnapshot = session.getSnapshot();
    if (
      namedSnapshot.status !== "connected" ||
      namedSnapshot.userIrNames[2] !== "Greenback 412" ||
      namedSnapshot.userIrNames[6] !== null ||
      namedSnapshot.userIrNames.length !== USER_IR_COUNT ||
      namedSnapshot.sync !== "ready" ||
      bluetooth.sent.length !== sentBeforeDump
    ) {
      throw new Error("IR-name dump must fill slot 03 without another request or patch recall");
    }
    for (const packet of gp50UsbChainWithCab(Uint8Array.from([0x01, 0x00, 0x00, 0x0a]), 50)) {
      bluetooth.push(packet);
    }
    const afterChain = session.getSnapshot();
    const cab = afterChain.status === "connected" ? afterChain.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      afterChain.status !== "connected" ||
      afterChain.userIrNames[2] !== "Greenback 412" ||
      afterChain.chainSync !== "idle" ||
      cab?.modelId !== "cab-twd-cp-1x8" ||
      cab.values?.[0] !== 50
    ) {
      throw new Error("A later current-preset dump must not clear IR names");
    }
    bluetooth.push(liveCabUserIr());
    const afterLive = session.getSnapshot();
    const liveCab = afterLive.status === "connected" ? afterLive.chain.find((slot) => slot.id === "cab") : undefined;
    if (liveCab?.modelId !== "cab-user-ir-03") {
      throw new Error("Bluetooth live user IR notify must update CAB like a factory cab");
    }
    await session.setSlotModel("cab", "cab-twd-cp-1x8");
    await session.setSlotModel("cab", "cab-user-ir-03");
    const factorySet = encodeSlotModel("bluetooth", "cab", [0x01, 0x00, 0x00, 0x0a]);
    const userSet = encodeSlotModel("bluetooth", "cab", [0x02, 0x00, 0x10, 0x0a]);
    const last = bluetooth.sent[bluetooth.sent.length - 1];
    const selected = session.getSnapshot();
    const selectedCab = selected.status === "connected" ? selected.chain.find((slot) => slot.id === "cab") : undefined;
    if (
      !factorySet ||
      !userSet ||
      !last ||
      factorySet[0].length !== userSet[0].length ||
      userSet[0].length > 80 ||
      !packetsEqual(last, userSet[0]) ||
      selectedCab?.modelId !== "cab-user-ir-03" ||
      irCount() !== 1
    ) {
      throw new Error("Selecting User IR 03 must send the existing model SET and no IR file");
    }
    await session.setPatch(1);
    const afterPatch = session.getSnapshot();
    if (irCount() !== 1 || afterPatch.status !== "connected" || afterPatch.userIrNames[2] !== "Greenback 412") {
      throw new Error("A patch change must not re-request or clear IR names");
    }
  } finally {
    await session.disconnect();
  }
  if (session.getSnapshot().status !== "disconnected") {
    throw new Error("Disconnect must drop IR names");
  }
}

void assertUserIrSession();


