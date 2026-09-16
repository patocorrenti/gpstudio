import type { BluetoothEndpoint } from "@/bluetooth/types";
import type { MidiEndpoint } from "@/midi/types";

export type LinkEndpoint = MidiEndpoint | BluetoothEndpoint;
