/**
 * CRC-8 ATM / CCITT (poly 0x07, init 0) over packed bytes.
 * Verified against the accepted Bluetooth chain-order SET (PRE before NR).
 */
export function crc8Atm(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

/** Each packed byte becomes two MIDI bytes `0x0n` (high nibble, then low). */
export function nibbleExpand(packed: Uint8Array): Uint8Array {
  const out = new Uint8Array(packed.length * 2);
  for (let i = 0; i < packed.length; i += 1) {
    out[i * 2] = (packed[i] >> 4) & 0x0f;
    out[i * 2 + 1] = packed[i] & 0x0f;
  }
  return out;
}
