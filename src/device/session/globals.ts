import {
  decodeGlobalsDump,
  decodeLiveGlobal,
  decodeLiveGlobalCc,
  isGlobalsDump,
  type DeviceGlobals,
  type FootswitchMode,
  type GlobalSysexKey,
  type LiveGlobalChange,
  type RecMode,
} from "@/device/globals";
import { capabilitiesForLink } from "@/device/link";
import type { ConnectedSnapshot } from "@/device/session/inbound";
import {
  FOOTSWITCH_MODE_WRITE_KEY,
  globalSysexWriteKey,
  MASTER_VOLUME_WRITE_KEY,
} from "@/device/session/writes";

export type GlobalsHost = {
  snapshot: ConnectedSnapshot;
  dropGlobalWrite: (key: string, sentValue: number | string) => void;
  assignSnapshot: (next: ConnectedSnapshot) => void;
  emitSnapshot: () => void;
};

/** True when the message is a globals dump (even if field offsets are still unlocked). */
export function applyGlobalsDump(host: GlobalsHost, message: Uint8Array): boolean {
  if (!isGlobalsDump(message)) {
    return false;
  }
  const decoded = decodeGlobalsDump(message);
  if (decoded && host.snapshot.globals) {
    host.assignSnapshot({ ...host.snapshot, globals: decoded });
    host.emitSnapshot();
  }
  return true;
}

export function applyLiveGlobal(host: GlobalsHost, message: Uint8Array): boolean {
  const change = decodeLiveGlobal(message) ?? decodeLiveGlobalCc(message);
  if (!change) {
    return false;
  }
  if (!capabilitiesForLink(host.snapshot.linkMode).liveFromPedal) {
    return true;
  }
  applyGlobalChange(host, change);
  return true;
}

function applyGlobalChange(host: GlobalsHost, change: LiveGlobalChange): void {
  const globals = host.snapshot.globals;
  if (!globals) {
    return;
  }
  dropPendingForChange(host, change);
  if (globals[change.key] === change.value) {
    return;
  }
  host.assignSnapshot({
    ...host.snapshot,
    globals: { ...globals, [change.key]: change.value },
  });
  host.emitSnapshot();
}

function dropPendingForChange(host: GlobalsHost, change: LiveGlobalChange): void {
  if (change.key === "masterVolume") {
    host.dropGlobalWrite(MASTER_VOLUME_WRITE_KEY, change.value);
    return;
  }
  if (change.key === "footswitchMode") {
    host.dropGlobalWrite(FOOTSWITCH_MODE_WRITE_KEY, change.value);
    return;
  }
  host.dropGlobalWrite(globalSysexWriteKey(change.key), `${change.key}:${String(change.value)}`);
}

export function mergeGlobalField(
  globals: DeviceGlobals,
  key: keyof DeviceGlobals,
  value: number | boolean | RecMode | FootswitchMode,
): DeviceGlobals {
  return { ...globals, [key]: value };
}

export type { GlobalSysexKey };
