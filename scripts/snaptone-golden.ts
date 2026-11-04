import { readFileSync } from "node:fs";
import { namTextToCloneBlob } from "../src/snaptone/pipeline.ts";
import { readSignalWav } from "../src/snaptone/signal.ts";
import { assertGoldenBlob } from "../src/snaptone/golden.ts";

const nam = readFileSync(new URL("../src/snaptone/fixtures/nam_core_a2.nam", import.meta.url), "utf8");
const wav = readFileSync(new URL("../src/snaptone/fixtures/nam_input_wav.wav", import.meta.url));
const wasm = readFileSync(new URL("../src/snaptone/a2kernel.wasm", import.meta.url));
const expected = readFileSync("/tmp/VLTN-Tone-Studio/app/src/renderer/src/gp5/fixtures/snaptone-a2.clo");
const started = Date.now();
const actual = await namTextToCloneBlob(nam, readSignalWav(wav), wasm);
try {
  assertGoldenBlob(actual, expected);
  console.log(`golden ok ${actual.length} bytes in ${Date.now() - started}ms`);
} catch (error) {
  const limit = Math.max(actual.length, expected.length);
  const diffs: number[] = [];
  for (let cursor = 0; cursor < limit; cursor += 1) {
    if (actual[cursor] !== expected[cursor]) {
      diffs.push(cursor);
    }
  }
  const payload = diffs.filter((index) => index !== 8 && index !== 9);
  console.error(
    `golden mismatch length actual=${actual.length} expected=${expected.length} diffs=${diffs.length} payloadDiffs=${payload.length} first=${diffs[0] ?? -1} firstPayload=${payload[0] ?? -1} after ${Date.now() - started}ms`,
  );
  console.error(
    `crc actual=${actual[8]?.toString(16)} ${actual[9]?.toString(16)} expected=${expected[8]?.toString(16)} ${expected[9]?.toString(16)}`,
  );
  const viewA = new DataView(actual.buffer, actual.byteOffset, actual.byteLength);
  const viewE = new DataView(expected.buffer, expected.byteOffset, expected.byteLength);
  const floats = payload.filter((index) => index % 4 === 0).slice(0, 6);
  for (const index of floats) {
    if (index + 4 > actual.length || index + 4 > expected.length) {
      continue;
    }
    console.error(
      `f32 @${index} actual=${viewA.getFloat32(index, true)} expected=${viewE.getFloat32(index, true)}`,
    );
  }
  console.error(`payload offsets ${payload.slice(0, 24).join(",")}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
