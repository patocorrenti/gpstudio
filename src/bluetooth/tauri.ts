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
  }

  async close(): Promise<void> {
    await invoke("ble_close");
  }
}
