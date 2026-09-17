import { TauriBluetoothLink } from "@/bluetooth/tauri";
import type { BluetoothLink } from "@/bluetooth/types";
import { WebBluetoothLink } from "@/bluetooth/web";
import { isTauriRuntime } from "@/midi/detect";

export function createBluetoothLink(): BluetoothLink {
  if (isTauriRuntime()) {
    console.info("[patone][gatt] backend: tauri");
    return new TauriBluetoothLink();
  }
  console.info("[patone][gatt] backend: web");
  return new WebBluetoothLink();
}
