/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Copyright (c) 2026 VLTN Tone Studio contributors. Modified for GP Studio by Patricio Correnti, 2026-11-04.
 * Upstream commit 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 */

/**
 * Host side of htkpakernel.wasm: the HtkpaKernel that cloneSnapTone takes. Each call copies its samples
 * into wasm memory, runs the kernel, and copies the result back. The tables (allpass coefficients,
 * CJJFFT twiddles) are copied once from htkpa.ts so the C file holds no second copy of them.
 */
import { HTKPA_KERNEL_TABLES, type BiquadCoeffs, type HtkpaKernel } from "./htkpa";

const PAGE = 65536;

type Biquad = (src: number, dst: number, n: number, b0: number, b1: number, b2: number, a1: number, a2: number) => void;
type Shape = (buf: number, n: number, up: number, down: number, coeffPos: number, coeffNeg: number, ampPos: number, ampNeg: number) => void;
type Convolve = (ir: number, irLen: number, buf: number, n: number, tw: number) => number;

/** Instantiate htkpakernel.wasm. Rejects when the bytes are not that kernel. */
export async function loadHtkpaKernel(wasm: BufferSource): Promise<HtkpaKernel> {
  const memory = new WebAssembly.Memory({ initial: 64 });
  const { instance } = await WebAssembly.instantiate(wasm, { env: { memory } });
  const { htkpa_biquad, htkpa_shape, htkpa_convolve, __heap_base: heapBase } = instance.exports;
  if (
    typeof htkpa_biquad !== "function" ||
    typeof htkpa_shape !== "function" ||
    typeof htkpa_convolve !== "function" ||
    !(heapBase instanceof WebAssembly.Global)
  ) {
    throw new Error("The SnapTone clone kernel is missing an export.");
  }
  const biquad = htkpa_biquad as Biquad;
  const shape = htkpa_shape as Shape;
  const convolve = htkpa_convolve as Convolve;

  let top = (Number(heapBase.value) + 15) & ~15;
  const alloc = (floats: number): number => {
    const p = top;
    top = (top + 4 * floats + 15) & ~15;
    if (top > memory.buffer.byteLength) memory.grow(Math.ceil((top - memory.buffer.byteLength) / PAGE));
    return p;
  };
  const put = (data: Float32Array): number => {
    const p = alloc(data.length);
    new Float32Array(memory.buffer, p, data.length).set(data);
    return p;
  };
  const up = put(HTKPA_KERNEL_TABLES.iirUp);
  const down = put(HTKPA_KERNEL_TABLES.iirDown);
  const twiddle = put(HTKPA_KERNEL_TABLES.twiddle);
  const base = top;

  /** Scratch for one call: the heap above the tables is reused every time. */
  const scratch = (floats: number): number => {
    top = base;
    return alloc(floats);
  };
  const view = (p: number, n: number) => new Float32Array(memory.buffer, p, n);

  return {
    biquad(src: Float32Array, srcOff: number, dst: Float32Array, n: number, c: BiquadCoeffs): void {
      const p = scratch(n);
      view(p, n).set(src.subarray(srcOff, srcOff + n));
      biquad(p, p, n, c.b0, c.b1, c.b2, c.a1, c.a2);
      dst.set(view(p, n), 0);
    },
    shape(buf: Float32Array, n: number, coeffPos: number, coeffNeg: number, ampPos: number, ampNeg: number): void {
      const p = scratch(n);
      view(p, n).set(buf.subarray(0, n));
      shape(p, n, up, down, coeffPos, coeffNeg, ampPos, ampNeg);
      buf.set(view(p, n), 0);
    },
    convolve(ir: Float32Array, irLen: number, src: Float32Array, srcOff: number, dst: Float32Array, dstOff: number, n: number): boolean {
      top = base;
      const irPtr = alloc(irLen);
      const p = alloc(n);
      view(irPtr, irLen).set(ir.subarray(0, irLen));
      view(p, n).set(src.subarray(srcOff, srcOff + n));
      if (convolve(irPtr, irLen, p, n, twiddle) !== 0) return false;
      dst.set(view(p, n), dstOff);
      return true;
    },
  };
}
