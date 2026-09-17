import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { suggestModelFromLabel, type DeviceModel } from "@/device/models";
import type {
  DisconnectHandler,
  MidiEndpoint,
  MidiMessageHandler,
  MidiTransport,
} from "@/midi/types";

type EndpointDto = {
  id: string;
  label: string;
  kind: string;
  suggestedModel?: DeviceModel | null;
};

export class TauriMidiTransport implements MidiTransport {
  private handlers = new Set<MidiMessageHandler>();
  private disconnectHandlers = new Set<DisconnectHandler>();
  private unlisten: UnlistenFn | null = null;
  private sessionOpen = false;

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
    this.sessionOpen = true;
  }

  async send(bytes: Uint8Array): Promise<void> {
    if (!this.sessionOpen) {
      throw new Error("No pedal is connected.");
    }
    try {
      await invoke("midi_send", { bytes: Array.from(bytes) });
    } catch {
      throw new Error("No pedal is connected.");
    }
  }

  subscribe(handler: MidiMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  subscribeDisconnect(handler: DisconnectHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  isOpen(): boolean {
    return this.sessionOpen;
  }

  async close(): Promise<void> {
    this.sessionOpen = false;
    await invoke("midi_close");
  }

  sysexEnabled(): boolean {
    return true;
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
