/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/snaptone/convert.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 * GP-5 and GP-50 use the same blob, so there is no device option.
 */

// The converter stays warm for the page: the wasm kernels and Valeton's test signal are fetched once, and the
// excitation is built once per model rate. Each conversion renders in up to four workers (chunks with real
// history, same floats as one pass) and clones in one of them with htkpakernel.wasm. The bytes are the same
// as the one-thread TypeScript path (scripts/snaptone-parity.ts). Workers end with the conversion, so cancel
// is immediate; the cached assets stay.
import a2WasmUrl from "./a2kernel.wasm?url";
import htkpaWasmUrl from "./htkpakernel.wasm?url";
import { planRenderChunks, prepareA2, type ClonePhase } from "./pipeline";
import { readSignalWav } from "./signal";
import type { WorkerReply, WorkerRequest } from "./worker";

// Valeton's test signal is not in the repo or the build: the server serves one shared copy
// (public/snaptone/ in local dev). See README.md.
const signalUrl = `${import.meta.env.BASE_URL}snaptone/nam_input_wav.wav`;

const PHASE_SPAN: Record<ClonePhase, [number, number]> = {
  excitation: [0, 0.07],
  render: [0.07, 0.4],
  clone: [0.4, 1],
};

const MAX_RENDER_WORKERS = 4;

interface Assets {
  a2: ArrayBuffer;
  /** null when htkpakernel.wasm could not be fetched: the clone runs in TypeScript */
  htkpa: ArrayBuffer | null;
  signal: Int16Array;
}

let assets: Promise<Assets> | null = null;
const excitations = new Map<number, Float32Array>();
let warnedFallback = false;

function warnFallback(): void {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn("SnapTone clone kernel unavailable; using the TypeScript clone (same result, slower).");
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  return response.arrayBuffer();
}

function loadAssets(): Promise<Assets> {
  if (!assets) {
    assets = (async () => {
      const [a2, signalBytes] = await Promise.all([fetchBytes(a2WasmUrl), fetchBytes(signalUrl)]).catch(() => {
        throw new Error("The SnapTone converter is missing its test signal.");
      });
      const htkpa = await fetchBytes(htkpaWasmUrl).catch(() => null);
      return { a2, htkpa, signal: readSignalWav(new Uint8Array(signalBytes)) };
    })();
    // A failed load is not cached: the next conversion tries again.
    assets.catch(() => {
      assets = null;
    });
  }
  return assets;
}

function renderWorkerCount(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 1 : 1;
  return Math.min(MAX_RENDER_WORKERS, Math.max(1, cores - 1));
}

function cancelled(): DOMException {
  return new DOMException("Conversion cancelled", "AbortError");
}

/** Convert a NAM A2 file off the UI thread. The workers post the SnapTone bytes back. */
export function convertNamToSnapTone(
  file: ArrayBuffer,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) {
    return Promise.reject(cancelled());
  }
  const workers: Worker[] = [];
  let stop: ((error: unknown) => void) | null = null;
  const finish = () => {
    for (const worker of workers) worker.terminate();
    workers.length = 0;
    signal?.removeEventListener("abort", abort);
  };
  const abort = () => {
    finish();
    stop?.(cancelled());
  };
  signal?.addEventListener("abort", abort);

  const spawn = (): Worker => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workers.push(worker);
    return worker;
  };

  /** Run one job; rejects on a worker error or on cancel. */
  const run = <T extends WorkerReply["type"]>(
    worker: Worker,
    request: WorkerRequest,
    transfer: Transferable[],
    onPhase?: (phase: ClonePhase, fraction: number) => void,
  ): Promise<Extract<WorkerReply, { type: T }>> =>
    new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        const message = event.data;
        if (message.type === "progress") {
          onPhase?.(message.phase, message.fraction);
          return;
        }
        if (message.type === "error") {
          reject(new Error(message.message));
          return;
        }
        resolve(message as Extract<WorkerReply, { type: T }>);
      };
      worker.onerror = () => reject(new Error("The SnapTone converter stopped."));
      worker.postMessage(request, transfer);
    });

  let shown = 0;
  const report = (phase: ClonePhase, fraction: number) => {
    const [from, to] = PHASE_SPAN[phase];
    shown = Math.max(shown, from + (to - from) * fraction);
    onProgress?.(shown);
  };

  const work = (async (): Promise<Uint8Array> => {
    const namText = new TextDecoder().decode(file);
    const { json, rate, prewarm } = prepareA2(namText);
    report("excitation", 0);
    const loaded = await loadAssets();
    if (signal?.aborted) throw cancelled();
    const pool = Array.from({ length: renderWorkerCount() }, spawn);

    let input = excitations.get(rate);
    if (!input) {
      const reply = await run<"excitation">(pool[0], { type: "excitation", signal: loaded.signal, rate }, []);
      input = reply.input;
      excitations.set(rate, input);
    }
    const excitation = input;
    if (signal?.aborted) throw cancelled();
    report("excitation", 1);

    const chunks = planRenderChunks(excitation.length, prewarm, pool.length);
    const done = chunks.map(() => 0);
    const outputs = await Promise.all(
      chunks.map((chunk, index) =>
        run<"render">(
          pool[index],
          { type: "render", json, wasm: loaded.a2, input: excitation.slice(chunk.from, chunk.end), chunk },
          [],
          (_phase, fraction) => {
            done[index] = fraction;
            report("render", Math.min(...done));
          },
        ),
      ),
    );
    const rendered = new Float32Array(excitation.length);
    outputs.forEach((reply, index) => rendered.set(reply.output, chunks[index].start));
    report("render", 1);

    report("clone", 0);
    for (const worker of pool.slice(1)) worker.terminate();
    const cloned = await run<"clone">(
      pool[0],
      { type: "clone", input: excitation, rendered, rate, kernel: loaded.htkpa },
      [rendered.buffer],
    );
    if (!cloned.usedKernel) warnFallback();
    report("clone", 1);
    return cloned.file;
  })();

  return new Promise<Uint8Array>((resolve, reject) => {
    stop = reject;
    work.then(
      (bytes) => {
        finish();
        resolve(bytes);
      },
      (error: unknown) => {
        finish();
        reject(error);
      },
    );
  });
}
