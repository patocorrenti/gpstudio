/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Copyright (c) 2026 VLTN Tone Studio contributors. Modified for GP Studio by Patricio Correnti, 2026-10-30 to 2026-11-04.
 * Upstream: app/src/renderer/src/snaptone/worker.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 */

// One job per message. convert.ts owns the assets (wasm bytes, test signal, excitations) and sends what each
// job needs, so a worker never fetches anything.
import { loadHtkpaKernel } from "./htkpa-kernel";
import { cloneToSnapToneFile } from "./file";
import type { HtkpaKernel } from "./htkpa";
import { buildExcitation, cloneRendered, renderChunk, type ClonePhase, type RenderChunk } from "./pipeline";

export type WorkerRequest =
  | { type: "excitation"; signal: Int16Array; rate: number }
  | { type: "render"; json: string; wasm: ArrayBuffer; input: Float32Array; chunk: RenderChunk }
  | { type: "clone"; input: Float32Array; rendered: Float32Array; rate: number; kernel: ArrayBuffer | null };

export type WorkerReply =
  | { type: "progress"; phase: ClonePhase; fraction: number }
  | { type: "excitation"; input: Float32Array }
  | { type: "render"; output: Float32Array }
  | { type: "clone"; file: Uint8Array; usedKernel: boolean }
  | { type: "error"; message: string };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply, transfer?: Transferable[]): void;
};

const post = (message: WorkerReply, transfer: Transferable[] = []) => {
  scope.postMessage(message, transfer);
};

async function kernelFrom(bytes: ArrayBuffer | null): Promise<HtkpaKernel | null> {
  if (!bytes) return null;
  try {
    return await loadHtkpaKernel(bytes);
  } catch {
    return null;
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === "excitation") {
        const input = buildExcitation(request.signal, request.rate);
        post({ type: "excitation", input }, [input.buffer]);
        return;
      }
      if (request.type === "render") {
        const { chunk } = request;
        const output = await renderChunk(request.json, request.wasm, request.input, chunk, chunk.from, (fraction) => {
          post({ type: "progress", phase: "render", fraction });
        });
        post({ type: "render", output }, [output.buffer]);
        return;
      }
      const kernel = await kernelFrom(request.kernel);
      const file = cloneToSnapToneFile(cloneRendered(request.input, request.rendered, request.rate, kernel));
      post({ type: "clone", file, usedKernel: kernel !== null }, [file.buffer]);
    } catch (error) {
      post({ type: "error", message: error instanceof Error ? error.message : "The SnapTone converter stopped." });
    }
  })();
};
