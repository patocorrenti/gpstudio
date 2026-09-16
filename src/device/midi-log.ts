export type InboundMidiEvent = {
  id: number;
  at: number;
  hex: string;
  summary: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(
    " ",
  );
}

export function describeMidi(bytes: Uint8Array): { hex: string; summary: string } {
  const hex = toHex(bytes);
  if (bytes.length === 0) {
    return { hex, summary: "Empty" };
  }

  const status = bytes[0];
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  if (status === 0xf0) {
    return { hex, summary: `SysEx · ${bytes.length} bytes` };
  }
  if (type === 0xb0 && bytes.length >= 3) {
    return {
      hex,
      summary: `CC ${bytes[1]} = ${bytes[2]} · ch ${channel}`,
    };
  }
  if (type === 0xc0 && bytes.length >= 2) {
    return {
      hex,
      summary: `Program Change ${bytes[1]} · ch ${channel}`,
    };
  }
  if (type === 0x80 && bytes.length >= 3) {
    return { hex, summary: `Note Off ${bytes[1]} · ch ${channel}` };
  }
  if (type === 0x90 && bytes.length >= 3) {
    return {
      hex,
      summary: `Note On ${bytes[1]} vel ${bytes[2]} · ch ${channel}`,
    };
  }

  return { hex, summary: "Raw MIDI" };
}
