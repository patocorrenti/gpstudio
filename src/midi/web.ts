import { suggestModelFromLabel } from "@/device/models";
import type { MidiEndpoint, MidiMessageHandler, MidiTransport } from "@/midi/types";

type MidiInputPort = {
  id: string;
  name: string | null;
  state: string;
  onmidimessage: ((event: { data: Uint8Array | null }) => void) | null;
  open: () => Promise<unknown>;
  close: () => Promise<unknown>;
};

type MidiOutputPort = {
  id: string;
  name: string | null;
  state: string;
  send: (data: Uint8Array) => void;
  open: () => Promise<unknown>;
  close: () => Promise<unknown>;
};

type MidiAccessLike = {
  inputs: { forEach: (cb: (port: MidiInputPort) => void) => void };
  outputs: { forEach: (cb: (port: MidiOutputPort) => void) => void };
};

type OpenPorts = {
  input?: MidiInputPort;
  output: MidiOutputPort;
};

function missingWebMidiError(): Error {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return new Error(
      `USB is blocked on ${window.location.origin}. Open http://localhost:1420 in Chrome or Edge (not a LAN IP).`,
    );
  }
  return new Error(
    "This browser cannot connect to the pedal over USB. Use Chrome or Edge, or the desktop app.",
  );
}

function webMidiError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return new Error("USB access was denied.");
    }
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error("Could not access USB devices.");
}

export class WebMidiTransport implements MidiTransport {
  private access: MidiAccessLike | null = null;
  private sysex = false;
  private portsById = new Map<string, { input?: MidiInputPort; output: MidiOutputPort }>();
  private openPorts: OpenPorts | null = null;
  private handlers = new Set<MidiMessageHandler>();

  async discover(): Promise<MidiEndpoint[]> {
    const access = await this.ensureAccess();
    this.portsById.clear();
    const inputs: MidiInputPort[] = [];
    const outputs: MidiOutputPort[] = [];
    access.inputs.forEach((port) => inputs.push(port));
    access.outputs.forEach((port) => outputs.push(port));

    const endpoints: MidiEndpoint[] = [];
    for (const output of outputs) {
      const label = output.name?.trim() || "USB device";
      const input = inputs.find((candidate) => (candidate.name ?? "") === (output.name ?? ""));
      this.portsById.set(output.id, { input, output });
      const suggestedModel = suggestModelFromLabel(label);
      endpoints.push({
        id: output.id,
        label,
        kind: "usb-midi",
        ...(suggestedModel ? { suggestedModel } : {}),
      });
    }
    return endpoints;
  }

  async open(id: string): Promise<void> {
    await this.close();
    const ports = this.portsById.get(id);
    if (!ports) {
      await this.discover();
    }
    const resolved = this.portsById.get(id);
    if (!resolved) {
      throw new Error("The pedal is no longer available.");
    }
    await resolved.output.open();
    if (resolved.input) {
      await resolved.input.open();
      resolved.input.onmidimessage = (event) => {
        if (!event.data) {
          return;
        }
        const bytes = event.data instanceof Uint8Array ? event.data : Uint8Array.from(event.data);
        for (const handler of this.handlers) {
          handler(bytes);
        }
      };
    }
    this.openPorts = resolved;
  }

  async send(bytes: Uint8Array): Promise<void> {
    if (!this.openPorts) {
      throw new Error("No pedal is connected.");
    }
    this.openPorts.output.send(bytes);
  }

  subscribe(handler: MidiMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async close(): Promise<void> {
    const openPorts = this.openPorts;
    this.openPorts = null;
    if (openPorts?.input) {
      openPorts.input.onmidimessage = null;
      await openPorts.input.close();
    }
    if (openPorts) {
      await openPorts.output.close();
    }
  }

  private async ensureAccess(): Promise<MidiAccessLike> {
    if (this.access) {
      return this.access;
    }
    if (typeof navigator.requestMIDIAccess !== "function") {
      throw missingWebMidiError();
    }
    try {
      this.access = (await navigator.requestMIDIAccess({
        sysex: true,
      })) as unknown as MidiAccessLike;
      this.sysex = true;
      return this.access;
    } catch (sysexError) {
      try {
        this.access = (await navigator.requestMIDIAccess({
          sysex: false,
        })) as unknown as MidiAccessLike;
        this.sysex = false;
        return this.access;
      } catch {
        throw webMidiError(sysexError);
      }
    }
  }

  sysexEnabled(): boolean {
    return this.sysex;
  }
}
