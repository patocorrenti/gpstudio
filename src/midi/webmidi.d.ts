interface Navigator {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<unknown>;
}
