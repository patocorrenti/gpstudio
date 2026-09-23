import {
  decodeLiveGlobal,
  decodeLiveGlobalCc,
  type DeviceGlobals,
  type FootswitchMode,
  type GlobalSysexKey,
  type Gp50Globals,
  type Gp5Globals,
  type Gp5FootswitchMode,
  type Gp5GlobalSysexKey,
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

/** Apply a finished globals decode (Bluetooth packet or assembled USB dump). */
export function applyDecodedGlobals(host: GlobalsHost, decoded: DeviceGlobals | null): void {
  if (!decoded || !host.snapshot.globals || host.snapshot.globals.model !== decoded.model) {
    return;
  }
  host.assignSnapshot({ ...host.snapshot, globals: decoded });
  host.emitSnapshot();
}

export function applyLiveGlobal(host: GlobalsHost, message: Uint8Array): boolean {
  const model = host.snapshot.model;
  const change =
    decodeLiveGlobal(message, model) ?? (model === "gp50" ? decodeLiveGlobalCc(message) : null);
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
  if (!globals || globals.model !== change.model) {
    return;
  }
  dropPendingForChange(host, change);
  if (globals.model === "gp50" && change.model === "gp50") {
    if (globals[change.key] === change.value) {
      return;
    }
    host.assignSnapshot({
      ...host.snapshot,
      globals: { ...globals, [change.key]: change.value },
    });
    host.emitSnapshot();
    return;
  }
  if (globals.model === "gp5" && change.model === "gp5") {
    if (globals[change.key] === change.value) {
      return;
    }
    host.assignSnapshot({
      ...host.snapshot,
      globals: { ...globals, [change.key]: change.value },
    });
    host.emitSnapshot();
  }
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

export function gp50SysexUpdate(
  globals: Gp50Globals,
  key: GlobalSysexKey,
  value: number | boolean | RecMode,
): { globals: Gp50Globals; sent: number | boolean | RecMode } | null {
  if (key === "noCab") {
    if (typeof value !== "boolean") {
      return null;
    }
    return { globals: mergeGlobalField(globals, key, value), sent: value };
  }
  if (key === "recModeLeft" || key === "recModeRight") {
    if (value !== "dry" && value !== "wet") {
      return null;
    }
    return { globals: mergeGlobalField(globals, key, value), sent: value };
  }
  if (typeof value !== "number") {
    return null;
  }
  return { globals: mergeGlobalField(globals, key, value), sent: value };
}

export function gp5SysexUpdate(
  globals: Gp5Globals,
  key: Gp5GlobalSysexKey,
  value: number | boolean,
): { globals: Gp5Globals; sent: number | boolean } | null {
  if (key === "noCab") {
    if (typeof value !== "boolean") {
      return null;
    }
    return { globals: mergeGlobalField(globals, key, value), sent: value };
  }
  if (typeof value !== "number") {
    return null;
  }
  return { globals: mergeGlobalField(globals, key, value), sent: value };
}

export function mergeGlobalField<G extends DeviceGlobals, K extends keyof G>(
  globals: G,
  key: K,
  value: G[K],
): G {
  return { ...globals, [key]: value };
}

export type { FootswitchMode, GlobalSysexKey, Gp5FootswitchMode, Gp5GlobalSysexKey, RecMode };
