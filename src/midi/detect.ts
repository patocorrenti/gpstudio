import { TauriMidiTransport } from "@/midi/tauri";
import type { MidiTransport } from "@/midi/types";
import { WebMidiTransport } from "@/midi/web";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function createMidiTransport(): MidiTransport {
  if (isTauriRuntime()) {
    return new TauriMidiTransport();
  }
  return new WebMidiTransport();
}
