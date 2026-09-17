import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { BleMidiDecoder } from "@/bluetooth/ble-midi";
import type {
  BluetoothDiscoverOptions,
  BluetoothEndpoint,
  BluetoothLink,
  MidiMessageHandler,
} from "@/bluetooth/types";
import { looksLikePedalName, suggestModelFromLabel } from "@/device/models";

type EndpointDto = {
  id: string;
  label: string;
  kind: string;
  suggestedModel?: string | null;
};

export class TauriBluetoothLink implements BluetoothLink {
  private sessionOpen = false;
  private readonly decoder = new BleMidiDecoder();
  private readonly handlers = new Set<MidiMessageHandler>();
  private unlisten: UnlistenFn | null = null;

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
    await this.ensureInbound();
    await invoke("ble_open", { id });
    this.sessionOpen = true;
  }

  async send(bytes: Uint8Array): Promise<void> {
    if (!this.sessionOpen) {
      throw new Error("No Bluetooth pedal is connected.");
    }
    try {
      await invoke("ble_send", { bytes: Array.from(bytes) });
    } catch {
      throw new Error("Could not send over Bluetooth.");
    }
  }

  subscribe(handler: MidiMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  resetInbound(): void {
    this.decoder.reset();
  }

  async close(): Promise<void> {
    this.sessionOpen = false;
    this.decoder.reset();
    await invoke("ble_close");
  }

  private async ensureInbound(): Promise<void> {
    if (this.unlisten) {
      return;
    }
    this.unlisten = await listen<number[]>("ble-inbound", (event) => {
      const bytes = Uint8Array.from(event.payload);
      for (const message of this.decoder.push(bytes)) {
        for (const handler of this.handlers) {
          handler(message);
        }
      }
    });
  }
}
