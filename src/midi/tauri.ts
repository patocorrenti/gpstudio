import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { suggestModelFromLabel, type DeviceModel } from "@/device/models";
import type { MidiEndpoint, MidiMessageHandler, MidiTransport } from "@/midi/types";

type EndpointDto = {
  id: string;
  label: string;
  kind: string;
  suggestedModel?: DeviceModel | null;
};

export class TauriMidiTransport implements MidiTransport {
  private handlers = new Set<MidiMessageHandler>();
  private unlisten: UnlistenFn | null = null;

  async discover(): Promise<MidiEndpoint[]> {
    const rows = await invoke<EndpointDto[]>("midi_list_ports");
    return rows.map((row) => {
      const suggestedModel =
        row.suggestedModel ?? suggestModelFromLabel(row.label);
      return {
        id: row.id,
        label: row.label,
        kind: "usb-midi" as const,
        ...(suggestedModel ? { suggestedModel } : {}),
      };
    });
  }

  async open(id: string): Promise<void> {
    await this.ensureInbound();
    await invoke("midi_open", { id });
  }

  async send(bytes: Uint8Array): Promise<void> {
    await invoke("midi_send", { bytes: Array.from(bytes) });
  }

  subscribe(handler: MidiMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    await invoke("midi_close");
  }

  private async ensureInbound(): Promise<void> {
    if (this.unlisten) {
      return;
    }
    this.unlisten = await listen<number[]>("midi-inbound", (event) => {
      const bytes = Uint8Array.from(event.payload);
      for (const handler of this.handlers) {
        handler(bytes);
      }
    });
  }
}
