import { TauriMidiTransport } from "@/midi/tauri";
import type { MidiTransport } from "@/midi/types";
import { WebMidiTransport } from "@/midi/web";
import { isTauri } from "@tauri-apps/api/core";

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return isTauri() || "__TAURI_INTERNALS__" in window;
}

export function createMidiTransport(): MidiTransport {
  if (isTauriRuntime()) {
    return new TauriMidiTransport();
  }
  return new WebMidiTransport();
}
