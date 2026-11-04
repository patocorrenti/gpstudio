/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/snaptone/convert.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 * GP-5 and GP-50 use the same blob, so there is no device option.
 */

import type { ClonePhase } from "./pipeline";
import type { WorkerReply, WorkerRequest } from "./worker";

const PHASE_SPAN: Record<ClonePhase, [number, number]> = {
  excitation: [0, 0.07],
  render: [0.07, 0.4],
  clone: [0.4, 1],
};

/** Convert a NAM A2 file off the UI thread. The worker posts the SnapTone bytes back. */
export function convertNamToSnapTone(
  file: ArrayBuffer,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const namText = new TextDecoder().decode(file);
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Conversion cancelled", "AbortError"));
  }
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return new Promise<Uint8Array>((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("Conversion cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort);
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const message = event.data;
      if (message.type === "progress") {
        const [from, to] = PHASE_SPAN[message.phase];
        onProgress?.(from + (to - from) * message.fraction);
        return;
      }
      finish();
      if (message.type === "done") {
        resolve(new Uint8Array(message.file));
        return;
      }
      reject(new Error(message.message));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("The SnapTone converter stopped."));
    };
    const request: WorkerRequest = { namText };
    worker.postMessage(request);
  });
}
