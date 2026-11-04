/** Byte-for-byte compare against a VLTN SnapTone clone. A shorter buffer fails. */
export function assertGoldenBlob(actual: Uint8Array, expected: Uint8Array): void {
  if (actual.length !== expected.length) {
    throw new Error(`SnapTone blob length ${actual.length} does not match VLTN (${expected.length}).`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(`SnapTone blob differs from VLTN at byte ${index}.`);
    }
  }
}

function assertTruncationFails(): void {
  const expected = Uint8Array.from([0x56, 0x54, 0x53, 0x49, 0x01]);
  assertGoldenBlob(expected, expected);
  let failed = false;
  try {
    assertGoldenBlob(expected.subarray(0, expected.length - 1), expected);
  } catch {
    failed = true;
  }
  if (!failed) {
    throw new Error("A truncated SnapTone blob must fail the golden check.");
  }
}

assertTruncationFails();
