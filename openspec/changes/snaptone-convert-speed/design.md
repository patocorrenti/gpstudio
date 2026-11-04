## Context

`src/snaptone/` converts a NAM A2 file to the 2696-byte SnapTone file in a Web Worker (`convert.ts` → `worker.ts` → `pipeline.ts`): resample Valeton's 70 s test signal to the model rate, render it through the last A2 submodel in `a2kernel.wasm`, then fit the clone in `htkpa.ts` (`cloneSnapTone`). The port is careful about float32 rounding and operation order so the blob matches Valeton Suite's dylib (see the `htkpa.ts` header and `RESEARCH.md`). The SnapTone modal and the TONE3000 catalog both call `session.convertNamToSnapTone(file, onProgress, signal)`.

Profile (Node 22, fixture at 48 kHz, 4 cores; `node --cpu-prof`), total ~24 s:

- `a2_process` self 8.3 s (render).
- `iterAmpCoeff` 11.2 s inclusive, run 3 + 2 + 5 = 10 times over 5 s, 15 s and the third window. Inside: `ampModelChain` 7.1 s (`OversampledShaper.process`, `upsample`, `downsample`, `allpassChain`, `expf`), `convolveBlocks` 6.1 s (`processBlock`, `cjjFft128`). The windows overlap in the inclusive totals.
- `convertSampleRate` 1.1–1.5 s, same input every time.
- `finalizeIr2` 2.3 s, `minPhaseIR` 0.9 s, `tfestimate` 0.8 s.

Output of the current path on the fixture: SHA-256 `d9d01a054605d048cee55461209d434587bd8bcc263f83c218dc7d0154b356e2` for the 8840-byte clone (Node 22.23).

## Goals / Non-Goals

**Goals:**

- Cut conversion time for a typical A2 capture from ~20 s to under 10 s on a 4-core machine, without changing a single output byte in V8.
- Pay the signal fetch and the resample once per session, not once per conversion.
- Keep cancel immediate and the session API unchanged.

**Non-Goals:**

- Ahead-of-time or cross-session caching of SnapTone files (TONE3000 terms).
- Changing what the clone computes.
- Faster upload to the pedal.

## Decisions

### 1. One warm converter per session

`convert.ts` keeps a module-level converter that is created on the first conversion and lives until the page unloads. It holds the `a2kernel.wasm` and `htkpakernel.wasm` bytes, the decoded test signal, and a map from model rate to the 24-bit-rounded excitation that `pipeline.ts` builds today (`pcmRoundTrip(convertSampleRate(...), 24)`). The map has at most three entries (44.1, 48, 96 kHz). At 96 kHz that is about 27 MB of float32, which is acceptable for a desktop USB session.

Cancel terminates every worker of the running conversion and rejects with `AbortError`, as today. The cached signal and excitations are kept on the main side of the converter (transferred to workers as copies), so a cancel does not throw them away. The next conversion starts new workers.

Alternative considered: keep workers alive between conversions and cancel cooperatively. Rejected for now: the wasm render loop does not yield, so a cooperative cancel would wait for the current chunk. Worker start-up is milliseconds once the bytes are in memory.

### 2. Parallel render by chunks with real history

A2 is a feed-forward WaveNet. Output at frame t depends on input frames t − prewarm … t, where `prewarm = Σ (K − 1)·d + 15` (`parseA2`). The kernel computes each frame with the same operation order whatever block it falls in (`a2kernel.c` header). So chunk i can be rendered alone: feed it the `prewarm` input frames before its start (zeros before frame 0, as `renderBlocks` does today), drop those outputs, keep the rest.

Checked on the fixture: 2 and 4 chunks, 0 samples differ from the one-thread render (`Object.is` on every float). The slowest of 4 chunks takes 2.3 s instead of 8.2 s.

Worker count: `min(4, max(1, navigator.hardwareConcurrency − 1))`. One worker uses the one-thread path. The parity check runs both 1 and 4.

Each worker parses the model itself from the `.nam` text (12 ms) instead of receiving the parsed model.

### 3. Clone hot loops in a second wasm kernel

New `src/snaptone/htkpakernel.c`, freestanding like `a2kernel.c` (`clang --target=wasm32 -O3 -msimd128 -nostdlib -Wl,--no-entry -Wl,--import-memory`, plus `-ffp-contract=off` so no fused multiply-add changes rounding). Three exports:

- `htkpa_biquad(...)`: `biquadFilter` in double, used for the pre and low-cut biquads around the `between` hook of `ampModelChain`.
- `htkpa_shape(...)`: the per-sample `OversampledShaper` loop (up1, up2, the four shaper taps, down1, down2) with the same coefficient tables (passed from `htkpa.ts`) and state. `expf` in TypeScript is `Math.fround(Math.exp(x))` in double. V8's `Math.exp` is fdlibm's `ieee754::exp`, so the kernel carries that fdlibm `exp` in C to keep the result. This is the one place where the output could differ, and the parity check is what proves it does not.
- `htkpa_convolve(...)`: `convolveBlocks` with `PartitionedConvolver` and `cjjFft128`, keeping the Q15 twiddle table, the bit-reversal order, the partition ring, and the accumulation order of `processBlock`. The C is scalar; clang may vectorize the per-bin loops, which keeps the order per bin.

`htkpa.ts` keeps its TypeScript versions of both functions, used by the parity check and as the fallback when the kernel fails to load. Everything else in `cloneSnapTone` stays TypeScript; at under 4 s together it is not worth the risk of a port now.

Alternative considered: run `iterAmpCoeff` iterations in parallel. Rejected: each iteration uses the gain, IRs and error of the one before, and the shaper and convolver are recursive inside a window.

### 4. Byte parity is the gate

`scripts/snaptone-parity.ts` converts the fixture through the current TypeScript path and through the fast path (1 and 4 render workers, wasm clone) and requires identical bytes, both for the 8840-byte clone and for the 2696-byte file. It also checks one 44.1 kHz input (no resample) by forcing the fixture's rate to 44.1 kHz. A difference fails the script. It is not loosened, and the fallback stays the TypeScript path.

`scripts/snaptone-golden.ts` (VLTN compare) is unchanged and must report the same diff as recorded in `RESEARCH.md`.

The test signal is not in the repo. Both scripts read it from `public/snaptone/nam_input_wav.wav` (gitignored), as today.

### 5. Progress stays three stages

`PHASE_SPAN` keeps `excitation`, `render`, `clone`. With a cached excitation, the `excitation` stage completes at once. Render progress is the minimum across chunk workers, so the bar never goes back.

## Risks / Trade-offs

- [fdlibm `exp` in C differs from `Math.exp` in some browser] → V8 is what GP Studio's USB targets run (Chrome, Edge, WebView2). Firefox and Safari do not have Web MIDI with SysEx for this flow anyway. The parity check runs in Node (V8).
- [Clang reorders float operations] → `-O3` without `-ffast-math` keeps IEEE semantics, `-ffp-contract=off` blocks FMA. The parity check is the proof.
- [Four workers each hold an excitation copy] → 4 × 13 MB at 48 kHz for the render, freed when the conversion ends.
- [Low-core machines gain less] → One worker falls back to today's path plus the warm cache.
- [Two wasm binaries to keep] → `htkpakernel.wasm` is built by `npm run build:wasm` and committed, like `a2kernel.wasm`. Both stay under `src/snaptone/` with the GPL-3.0 header.

## Migration Plan

No data migration. The fast path replaces the current one behind the same `convertNamToSnapTone`. If the kernel cannot load, the converter uses the TypeScript clone and logs once. Rollback is reverting `convert.ts` and `worker.ts`.

## Open Questions

- Whether nginx should send `Cache-Control: public, max-age=31536000, immutable` for `/snaptone/nam_input_wav.wav`. It helps the first conversion after a reload. The app works without it.
