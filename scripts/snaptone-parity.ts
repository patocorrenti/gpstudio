// Byte parity of the fast SnapTone path against the one-thread TypeScript path, plus stage timings.
// Run: npx tsx scripts/snaptone-parity.ts
// Needs Valeton's test signal at public/snaptone/nam_input_wav.wav (gitignored, see src/snaptone/README.md).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseA2, renderA2 } from "../src/snaptone/a2.ts";
import { cloneToSnapToneFile } from "../src/snaptone/file.ts";
import { loadHtkpaKernel } from "../src/snaptone/htkpa-kernel.ts";
import { buildExcitation, cloneRendered, planRenderChunks, prepareA2, renderChunk } from "../src/snaptone/pipeline.ts";
import { readSignalWav } from "../src/snaptone/signal.ts";

const signalUrl = new URL("../public/snaptone/nam_input_wav.wav", import.meta.url);
if (!existsSync(signalUrl)) {
  console.error("Missing public/snaptone/nam_input_wav.wav (Valeton's test signal). Copy it there and run again.");
  process.exit(1);
}
const fixture = readFileSync(new URL("../src/snaptone/fixtures/nam_core_a2.nam", import.meta.url), "utf8");
const a2Wasm = readFileSync(new URL("../src/snaptone/a2kernel.wasm", import.meta.url));
const kernelWasm = readFileSync(new URL("../src/snaptone/htkpakernel.wasm", import.meta.url));
const signal = readSignalWav(readFileSync(signalUrl));
const kernel = await loadHtkpaKernel(kernelWasm);

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const time = async <T>(run: () => T | Promise<T>): Promise<[T, number]> => {
  const started = performance.now();
  const value = await run();
  return [value, Math.round(performance.now() - started)];
};

let failed = false;
const fail = (message: string) => {
  failed = true;
  console.error(`FAIL ${message}`);
};

function firstDiff(a: Uint8Array, b: Uint8Array): number {
  const limit = Math.max(a.length, b.length);
  for (let index = 0; index < limit; index += 1) {
    if (a[index] !== b[index]) return index;
  }
  return -1;
}

async function check(label: string, namText: string): Promise<void> {
  const { json, rate, prewarm } = prepareA2(namText);
  const [input, excitationMs] = await time(() => buildExcitation(signal, rate));

  const [whole, renderMs] = await time(() => renderA2(a2Wasm, parseA2(json), input));
  const [reference, cloneTsMs] = await time(() => cloneRendered(input, whole.slice(), rate));
  const [fast, cloneWasmMs] = await time(() => cloneRendered(input, whole.slice(), rate, kernel));
  console.log(
    `${label}: rate ${rate}, excitation ${excitationMs} ms, render ${renderMs} ms, clone ts ${cloneTsMs} ms, clone wasm ${cloneWasmMs} ms`,
  );
  console.log(`${label}: clone ${sha(reference)}  file ${sha(cloneToSnapToneFile(reference))}`);
  if (sha(fast) !== sha(reference)) {
    fail(`${label}: wasm clone differs from the TypeScript clone at byte ${firstDiff(fast, reference)}`);
  }

  for (const parts of [1, 2, 4]) {
    const chunks = planRenderChunks(input.length, prewarm, parts);
    const joined = new Float32Array(input.length);
    let slowest = 0;
    for (const chunk of chunks) {
      const [out, ms] = await time(() => renderChunk(json, a2Wasm, input, chunk, 0));
      joined.set(out, chunk.start);
      slowest = Math.max(slowest, ms);
    }
    let differing = 0;
    for (let index = 0; index < whole.length; index += 1) {
      if (!Object.is(whole[index], joined[index])) differing += 1;
    }
    const file = cloneToSnapToneFile(cloneRendered(input, joined, rate, kernel));
    console.log(`${label}: ${parts} chunk(s), slowest ${slowest} ms, ${differing} differing samples`);
    if (differing !== 0) fail(`${label}: ${parts} chunk(s) render differs in ${differing} samples`);
    if (sha(file) !== sha(cloneToSnapToneFile(reference))) fail(`${label}: ${parts} chunk(s) file differs`);
  }
}

await check("48k", fixture);
await check("44.1k", fixture.replace(/"sample_rate": 48000(\.0)?/g, '"sample_rate": 44100'));

if (failed) {
  process.exitCode = 1;
} else {
  console.log("parity ok");
}
