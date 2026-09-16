import { invoke } from "@tauri-apps/api/core";
import { looksLikePedalName, suggestModelFromLabel } from "@/device/models";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
} from "@/bluetooth/types";

type EndpointDto = {
  id: string;
  label: string;
  kind: string;
  suggestedModel?: string | null;
};

export class TauriBluetoothLink implements BluetoothLink {
  private sessionOpen = false;

  async discover(
    _options: BluetoothDiscoverOptions = {},
  ): Promise<BluetoothEndpoint[]> {
    const rows = await invoke<EndpointDto[]>("ble_scan");
    return rows.flatMap((row) => {
      if (row.kind !== "bluetooth" || !looksLikePedalName(row.label)) {
        return [];
      }
      const suggestedModel =
        row.suggestedModel === "gp5" || row.suggestedModel === "gp50"
          ? row.suggestedModel
          : suggestModelFromLabel(row.label);
      return [
        {
          id: row.id,
          label: row.label,
          kind: "bluetooth" as const,
          ...(suggestedModel ? { suggestedModel } : {}),
        },
      ];
    });
  }

  async open(id: string): Promise<void> {
    await invoke("ble_open", { id });
    this.sessionOpen = true;
  }

  async send(_bytes: Uint8Array): Promise<void> {
    if (!this.sessionOpen) {
      throw new Error("No Bluetooth pedal is connected.");
    }
    throw new Error("Could not send over Bluetooth.");
  }

  async close(): Promise<void> {
    this.sessionOpen = false;
    await invoke("ble_close");
  }
}
