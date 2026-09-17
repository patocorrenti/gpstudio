import { TauriBluetoothLink } from "@/bluetooth/tauri";
import type { BluetoothLink } from "@/bluetooth/types";
import { WebBluetoothLink } from "@/bluetooth/web";
import { isTauriRuntime } from "@/midi/detect";

export function createBluetoothLink(): BluetoothLink {
  if (isTauriRuntime()) {
    return new TauriBluetoothLink();
  }
  return new WebBluetoothLink();
}
