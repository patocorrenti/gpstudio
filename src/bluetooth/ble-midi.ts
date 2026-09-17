/**
 * MMA BLE-MIDI 1.0 unwrap (public packet format).
 * Header 10xxxxxx, timestamps 1xxxxxxx, MIDI data 0xxxxxxx.
 * Not copied from a third-party editor.
 */

function isHeader(byte: number): boolean {
  return (byte & 0xc0) === 0x80;
}

function isRealtime(byte: number): boolean {
  return byte >= 0xf8;
}

function channelDataBytes(status: number): number {
  const type = status & 0xf0;
  if (type === 0xc0 || type === 0xd0) {
    return 1;
  }
  return 2;
}

function systemCommonDataBytes(status: number): number | null {
  switch (status) {
    case 0xf1:
    case 0xf3:
      return 1;
    case 0xf2:
      return 2;
    case 0xf6:
      return 0;
    default:
      return null;
  }
}

export class BleMidiDecoder {
  private runningStatus = 0;
  private sysex: number[] | null = null;
  private current: number[] = [];
  private needed = 0;

  reset(): void {
    this.runningStatus = 0;
    this.sysex = null;
    this.current = [];
    this.needed = 0;
  }

  push(packet: Uint8Array): Uint8Array[] {
    const messages: Uint8Array[] = [];
    if (packet.length === 0) {
      return messages;
    }

    let index = isHeader(packet[0]) ? 1 : 0;
    while (index < packet.length) {
      const byte = packet[index];

      if (this.sysex) {
        index += 1;
        if (byte === 0xf7) {
          this.sysex.push(0xf7);
          messages.push(Uint8Array.from(this.sysex));
          this.sysex = null;
          continue;
        }
        if (isRealtime(byte)) {
          messages.push(new Uint8Array([byte]));
          continue;
        }
        if (byte & 0x80) {
          continue;
        }
        this.sysex.push(byte);
        continue;
      }

      if (this.needed > 0) {
        index += 1;
        if (isRealtime(byte)) {
          messages.push(new Uint8Array([byte]));
          continue;
        }
        if (byte & 0x80) {
          continue;
        }
        this.current.push(byte);
        this.needed -= 1;
        if (this.needed === 0) {
          messages.push(Uint8Array.from(this.current));
          this.current = [];
        }
        continue;
      }

      if (isRealtime(byte)) {
        messages.push(new Uint8Array([byte]));
        index += 1;
        continue;
      }

      if (byte & 0x80) {
        const nextIndex = index + 1;
        if (nextIndex >= packet.length) {
          break;
        }
        const next = packet[nextIndex];
        index = nextIndex + 1;
        if (isRealtime(next)) {
          messages.push(new Uint8Array([next]));
          continue;
        }
        if (next & 0x80) {
          this.startStatus(next, messages);
          continue;
        }
        this.appendRunning(next, messages);
        continue;
      }

      this.appendRunning(byte, messages);
      index += 1;
    }

    return messages;
  }

  private startStatus(status: number, messages: Uint8Array[]): void {
    if (status === 0xf0) {
      this.sysex = [0xf0];
      this.runningStatus = 0;
      this.current = [];
      this.needed = 0;
      return;
    }
    if (status === 0xf7) {
      return;
    }
    const common = systemCommonDataBytes(status);
    if (common !== null) {
      this.runningStatus = 0;
      if (common === 0) {
        messages.push(new Uint8Array([status]));
        return;
      }
      this.current = [status];
      this.needed = common;
      return;
    }
    if (status < 0x80 || status >= 0xf0) {
      return;
    }
    this.runningStatus = status;
    this.current = [status];
    this.needed = channelDataBytes(status);
  }

  private appendRunning(data: number, messages: Uint8Array[]): void {
    if (!this.runningStatus) {
      return;
    }
    this.current = [this.runningStatus, data];
    this.needed = channelDataBytes(this.runningStatus) - 1;
    if (this.needed === 0) {
      messages.push(Uint8Array.from(this.current));
      this.current = [];
    }
  }
}
