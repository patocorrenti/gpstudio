## 1. Baseline and parity check

- [ ] 1.1 Add `scripts/snaptone-parity.ts`. It converts `src/snaptone/fixtures/nam_core_a2.nam` with the current path and prints per-stage times (excitation, render, clone) and the SHA-256 of the 8840-byte clone and the 2696-byte file. It reads the signal from `public/snaptone/nam_input_wav.wav` and exits with an English message when the file is missing. Record the baseline times and hashes in `RESEARCH.md`. Verify the clone hash is `d9d01a054605d048cee55461209d434587bd8bcc263f83c218dc7d0154b356e2` on Node 22, or record the hash you get and why.
- [ ] 1.2 Extend the script so it also runs the fixture forced to 44.1 kHz (no resample) and records that hash. Verify both runs print hashes and times.

## 2. Warm converter (point 1)

- [ ] 2.1 In `convert.ts`, keep one converter per page that loads `a2kernel.wasm` and the test signal on first use and keeps the 24-bit-rounded excitation per model rate (at most 44.1, 48, 96 kHz). Move the excitation build from `pipeline.ts` into a function the converter calls once per rate. `worker.ts` receives the excitation and wasm bytes instead of fetching them. Verify in the dev server's network panel that a second conversion does not request `nam_input_wav.wav`, and that the parity hashes are unchanged.
- [ ] 2.2 Cancel terminates the conversion's workers and rejects with `AbortError`. The cached signal and excitations survive the cancel. Verify cancel during `Converting…` in the SnapTone modal sends nothing, and the next conversion still skips the fetch.

## 3. Parallel render (point 2a)

- [ ] 3.1 In `pipeline.ts` add a chunked render: chunk i gets the `prewarm` frames before it (zeros before frame 0) and keeps only its own outputs. Unit-check in the parity script: 1, 2, and 4 chunks give 0 differing samples against `renderA2` on the whole input (`Object.is`).
- [ ] 3.2 In `convert.ts` run the chunks in `min(4, max(1, hardwareConcurrency − 1))` workers. Each parses the `.nam` text itself. Render progress is the minimum across workers. Verify the parity script's file hash with 4 workers matches 1.1, and record the render time.

## 4. Clone kernel (point 2b)

- [ ] 4.1 Add `src/snaptone/htkpakernel.c` with the GPL-3.0 header, exporting `amp_chain` (shaper chain plus the low-cut biquad, with fdlibm `exp` for `expf`) and `convolve_blocks` (partitioned convolver with `cjjFft128`). Add `npm run build:wasm` that builds only this kernel with `clang --target=wasm32 -O3 -msimd128 -ffp-contract=off -nostdlib -Wl,--no-entry -Wl,--import-memory` and the needed `--export` flags. Commit `htkpakernel.wasm`. Do not rebuild `a2kernel.wasm`. Verify the build exits 0 and the README lists the new file and its upstream.
- [ ] 4.2 In `htkpa.ts`, let `ampModelChain` and `convolveBlocks` call the kernel when one is provided, and keep the TypeScript versions as the fallback. `cloneSnapTone` takes the kernel as an optional argument. Verify the parity script: wasm clone and TypeScript clone give the same 8840-byte hash at 48 kHz and at 44.1 kHz. If any byte differs, stop and report the first differing offset; do not loosen the check.
- [ ] 4.3 The worker loads `htkpakernel.wasm` with the converter. If it fails to load, the conversion uses the TypeScript clone and logs once. Verify by pointing the kernel URL at a missing file in dev: conversion still succeeds with the same hash.

## 5. Docs and build

- [ ] 5.1 Update `src/snaptone/README.md` and `RESEARCH.md` with the new kernel, the chunked render, and the before/after times from the parity script. Run `scripts/snaptone-golden.ts` and verify it reports the same diff `RESEARCH.md` already records.
- [ ] 5.2 Run `npm run build` and verify it exits 0 and the build output contains both wasm files.
- [ ] 5.3 Add to `src/snaptone/HARDWARE_TEST.md`: convert and upload one TONE3000 model and one local `.nam` on GP-5 and on GP-50, then a second model in the same session, and note the conversion time shown. Pato runs it.
