import type { EffectId } from "@/device/chain";
import { encodePatchTempoCc, encodePatchVolumeCc, encodeSlotControl } from "@/device/encode";
import type { LinkMode } from "@/device/link";
import type { DeviceModel } from "@/device/models";

/** Coalesce slider SETs so BLE-MIDI is not flooded. Toggles flush immediately. */
export const CONTROL_WRITE_THROTTLE_MS = 80;
export const PATCH_VOLUME_WRITE_KEY = "patch-volume";
export const PATCH_BPM_WRITE_KEY = "patch-bpm";

export function controlWriteKey(kind: EffectId, index: number): string {
  return `${kind}:${index}`;
}

type ConnectedLink = {
  linkMode: LinkMode;
  model: DeviceModel;
};

export class SessionWriteQueue {
  private readonly pendingControlWrites = new Map<
    string,
    { kind: EffectId; index: number; value: number }
  >();
  private readonly pendingPatchWrites = new Map<string, number>();
  private readonly controlWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastControlWriteAt = new Map<string, number>();
  private readonly lastControlSentValue = new Map<string, number>();
  private controlSendTail: Promise<void> = Promise.resolve();

  private readonly sendBytes: (bytes: Uint8Array) => Promise<void>;
  private readonly connected: () => ConnectedLink | null;

  constructor(
    sendBytes: (bytes: Uint8Array) => Promise<void>,
    connected: () => ConnectedLink | null,
  ) {
    this.sendBytes = sendBytes;
    this.connected = connected;
  }

  hasPending(): boolean {
    return this.pendingControlWrites.size > 0 || this.pendingPatchWrites.size > 0;
  }

  queueControlWrite(kind: EffectId, index: number, value: number, flush: boolean): void {
    const key = controlWriteKey(kind, index);
    this.pendingControlWrites.set(key, { kind, index, value });
    this.schedule(key, flush);
  }

  queuePatchWrite(key: string, value: number, flush: boolean): void {
    this.pendingPatchWrites.set(key, value);
    this.schedule(key, flush);
  }

  flush(key: string): void {
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

  dropControlWrite(key: string, sentValue: number): void {
    this.clearTimer(key);
    this.pendingControlWrites.delete(key);
    this.lastControlWriteAt.delete(key);
    this.lastControlSentValue.set(key, sentValue);
  }

  dropPatchWrite(key: string, sentValue: number): void {
    this.clearTimer(key);
    this.pendingPatchWrites.delete(key);
    this.lastControlWriteAt.delete(key);
    this.lastControlSentValue.set(key, sentValue);
  }

  clearForKind(kind: EffectId): void {
    const prefix = `${kind}:`;
    for (const key of [...this.pendingControlWrites.keys()]) {
      if (key.startsWith(prefix)) {
        this.clearTimer(key);
        this.pendingControlWrites.delete(key);
        this.lastControlWriteAt.delete(key);
        this.lastControlSentValue.delete(key);
      }
    }
  }

  clear(): void {
    for (const timer of this.controlWriteTimers.values()) {
      clearTimeout(timer);
    }
    this.controlWriteTimers.clear();
    this.pendingControlWrites.clear();
    this.pendingPatchWrites.clear();
    this.lastControlWriteAt.clear();
    this.lastControlSentValue.clear();
  }

  private schedule(key: string, flush: boolean): void {
    if (flush) {
      this.flush(key);
      return;
    }
    const elapsed = Date.now() - (this.lastControlWriteAt.get(key) ?? 0);
    const wait = CONTROL_WRITE_THROTTLE_MS - elapsed;
    if (wait <= 0) {
      this.flush(key);
      return;
    }
    if (this.controlWriteTimers.has(key)) {
      return;
    }
    const timer = setTimeout(() => {
      this.controlWriteTimers.delete(key);
      this.flush(key);
    }, wait);
    this.controlWriteTimers.set(key, timer);
  }

  private clearTimer(key: string): void {
    const timer = this.controlWriteTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.controlWriteTimers.delete(key);
    }
  }

  private async sendPendingControl(key: string): Promise<void> {
    const pending = this.pendingControlWrites.get(key);
    const link = this.connected();
    if (!pending || !link) {
      return;
    }
    this.pendingControlWrites.delete(key);
    if (this.lastControlSentValue.get(key) === pending.value) {
      return;
    }
    const packets = encodeSlotControl(link.linkMode, pending.kind, pending.index, pending.value);
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
    const link = this.connected();
    if (value === undefined || !link) {
      return;
    }
    this.pendingPatchWrites.delete(key);
    if (this.lastControlSentValue.get(key) === value) {
      return;
    }
    if (key === PATCH_BPM_WRITE_KEY && link.model !== "gp50") {
      return;
    }
    const packets =
      key === PATCH_VOLUME_WRITE_KEY
        ? encodePatchVolumeCc(link.linkMode, value)
        : encodePatchTempoCc(link.linkMode, value);
    if (!packets) {
      return;
    }
    this.lastControlSentValue.set(key, value);
    for (const packet of packets) {
      await this.sendBytes(packet);
    }
  }
}
