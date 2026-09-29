/**
 * Bluetooth “Command received” ACK after a parameter-write SET (e.g. patch
 * recall `1143`). Reference editors match a length-18 BLE-MIDI packet
 * (`80 80` + SysEx) at indices 5/6/10/11/12/14. Patone inbound is unwrapped,
 * so the same fields sit at F0-aligned indices 3/4/8/9/10/12 on a 16-byte
 * SysEx. Do not paste reference JavaScript.
 */
export function isCommandReceivedAck(midi: Uint8Array): boolean {
  return (
    midi.length === 16 &&
    midi[0] === 0xf0 &&
    midi[3] === 0x00 &&
    midi[4] === 0x01 &&
    midi[8] === 0x03 &&
    midi[9] === 0x01 &&
    midi[10] === 0x04 &&
    midi[12] === 0x08 &&
    midi[15] === 0xf7
  );
}

/** Fixture for session checks: only the locked ACK fields are meaningful. */
export function commandReceivedAckFixture(): Uint8Array {
  const midi = new Uint8Array(16);
  midi[0] = 0xf0;
  midi[3] = 0x00;
  midi[4] = 0x01;
  midi[8] = 0x03;
  midi[9] = 0x01;
  midi[10] = 0x04;
  midi[12] = 0x08;
  midi[15] = 0xf7;
  return midi;
}

function assertCommandReceivedAck(): void {
  const ack = commandReceivedAckFixture();
  if (!isCommandReceivedAck(ack)) {
    throw new Error("Command-received fixture must match the ACK detector");
  }
  const currentPatch = new Uint8Array(16);
  currentPatch[0] = 0xf0;
  currentPatch[3] = 0x00;
  currentPatch[4] = 0x01;
  currentPatch[9] = 0x01;
  currentPatch[10] = 0x02;
  currentPatch[11] = 0x04;
  currentPatch[12] = 0x03;
  currentPatch[15] = 0xf7;
  if (isCommandReceivedAck(currentPatch)) {
    throw new Error("Current-patch notify must not match the command-received ACK");
  }
  if (isCommandReceivedAck(ack.subarray(0, 15))) {
    throw new Error("Short SysEx must not match the command-received ACK");
  }
  const wrongTail = Uint8Array.from(ack);
  wrongTail[12] = 0x05;
  if (isCommandReceivedAck(wrongTail)) {
    throw new Error("Unrelated length-16 notify must not match the command-received ACK");
  }
}

assertCommandReceivedAck();
