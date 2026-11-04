/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/snaptone/worker.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 */

import wasmUrl from "./a2kernel.wasm?url";
import signalUrl from "./fixtures/nam_input_wav.wav?url";
import { namTextToSnapToneFile, type ClonePhase } from "./pipeline";
import { readSignalWav } from "./signal";

export type WorkerRequest = { namText: string };
export type WorkerReply =
  | { type: "progress"; phase: ClonePhase; fraction: number }
  | { type: "done"; file: ArrayBuffer }
  | { type: "error"; message: string };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply, transfer?: Transferable[]): void;
};

const post = (message: WorkerReply, transfer: Transferable[] = []) => {
  scope.postMessage(message, transfer);
};

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    try {
      const [wasmResponse, signalResponse] = await Promise.all([fetch(wasmUrl), fetch(signalUrl)]);
      if (!wasmResponse.ok || !signalResponse.ok) {
        throw new Error("The SnapTone converter is missing its test signal.");
      }
      const wasm = await wasmResponse.arrayBuffer();
      const signal = new Uint8Array(await signalResponse.arrayBuffer());
      const file = await namTextToSnapToneFile(event.data.namText, readSignalWav(signal), wasm, (phase, fraction) => {
        post({ type: "progress", phase, fraction });
      });
      const copy = new ArrayBuffer(file.byteLength);
      new Uint8Array(copy).set(file);
      post({ type: "done", file: copy }, [copy]);
    } catch (error) {
      post({ type: "error", message: error instanceof Error ? error.message : "The SnapTone converter stopped." });
    }
  })();
};
