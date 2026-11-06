# SnapTone conversion

Portions adapted from [VLTN Tone Studio](https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0, commit `9591679ea3c41ec56938ff5af937af6c3ba2bdef`.

Copyright (c) 2026 VLTN Tone Studio contributors. Each ported file says in its header that GP Studio modified it, and when.

| File | Upstream |
| --- | --- |
| `nam.ts` | `app/src/shared/nam.ts` |
| `a2.ts` | `app/src/renderer/src/snaptone/a2.ts` |
| `a2kernel.c`, `a2kernel.wasm` | `app/src/renderer/src/snaptone/a2kernel.c` (wasm rebuilt by their `npm run build:wasm`; binary committed here, 9379 bytes) |
| `kernel.ts` | `app/src/renderer/src/snaptone/kernel.ts` |
| `htkpa.ts` | `app/src/renderer/src/snaptone/htkpa.ts` (optional wasm kernel hook added) |
| `htkpakernel.c`, `htkpakernel.wasm` | GP Studio port of the `htkpa.ts` hot loops (biquad, 4x shaper, partitioned convolver) plus fdlibm `exp`; built by `npm run build:wasm`, binary committed |
| `htkpa-kernel.ts` | GP Studio host side of `htkpakernel.wasm` |
| `pipeline.ts` | `app/src/renderer/src/snaptone/pipeline.ts` (cab-IR convolution omitted) |
| `signal.ts` | `app/src/shared/host/snaptone.ts` |
| `file.ts` | `app/src/renderer/src/gp5/lib/snaptone.mjs` `cloneToSnapToneFile` |
| `worker.ts`, `convert.ts` | `app/src/renderer/src/snaptone/worker.ts`, `convert.ts` (rewritten here: warm assets, parallel render, wasm clone) |
| `inspect.ts` | `app/src/shared/nam.ts` plus `LocalNamDialog` metadata name |

The module exports `inspectNam` and `convertNamToSnapTone` only. It does not import the session, React, or a MIDI transport. GP-5 and GP-50 share one blob, so convert has no `device` option.

`nam_input_wav.wav` is Valeton's test signal (from a Valeton Suite install). It is not committed and not part of the build: `convert.ts` fetches it once per page at `/snaptone/nam_input_wav.wav`. Locally it sits in `public/snaptone/` (gitignored); on the server nginx serves one shared copy to staging and live. `fixtures/nam_core_a2.nam` is NeuralAmpModelerCore's A2 example (MIT). `scripts/snaptone-golden.ts` compares that fixture's 8840-byte clone to VLTN's `snaptone-a2.clo`. The current diff is recorded in `RESEARCH.md`.

## Speed

`convert.ts` keeps the wasm bytes, the decoded test signal, and the excitation per model rate for the page, so only the first conversion fetches and resamples. Each conversion renders in `min(4, hardwareConcurrency − 1)` workers: A2 is feed-forward, so a chunk rendered after `prewarm` frames of real history gives the same floats as one pass. One of those workers then runs the clone with `htkpakernel.wasm`; if that file cannot be loaded the clone runs in TypeScript and logs once. Workers end with each conversion, so cancel is immediate.

The bytes do not change. `npx tsx scripts/snaptone-parity.ts` checks, at 48 kHz and 44.1 kHz, that the wasm clone matches the TypeScript clone and that 1, 2 and 4 render chunks match the one-pass render. Times and hashes are in `RESEARCH.md`.
