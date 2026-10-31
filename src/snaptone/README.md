# SnapTone conversion

Portions adapted from [VLTN Tone Studio](https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0, commit `9591679ea3c41ec56938ff5af937af6c3ba2bdef`.

| File | Upstream |
| --- | --- |
| `nam.ts` | `app/src/shared/nam.ts` |
| `a2.ts` | `app/src/renderer/src/snaptone/a2.ts` |
| `a2kernel.c`, `a2kernel.wasm` | `app/src/renderer/src/snaptone/a2kernel.c` (wasm rebuilt by their `npm run build:wasm`; binary committed here, 9379 bytes) |
| `kernel.ts` | `app/src/renderer/src/snaptone/kernel.ts` |
| `htkpa.ts` | `app/src/renderer/src/snaptone/htkpa.ts` |
| `pipeline.ts` | `app/src/renderer/src/snaptone/pipeline.ts` (cab-IR convolution omitted) |
| `signal.ts` | `app/src/shared/host/snaptone.ts` |
| `file.ts` | `app/src/renderer/src/gp5/lib/snaptone.mjs` `cloneToSnapToneFile` |
| `worker.ts`, `convert.ts` | `app/src/renderer/src/snaptone/worker.ts`, `convert.ts` |
| `inspect.ts` | `app/src/shared/nam.ts` plus `LocalNamDialog` metadata name |

The module exports `inspectNam` and `convertNamToSnapTone` only. It does not import the session, React, or a MIDI transport. GP-5 and GP-50 share one blob, so convert has no `device` option.

`fixtures/nam_input_wav.wav` is Valeton's test signal. It is gitignored and must sit next to the converter for a local build. `fixtures/nam_core_a2.nam` is NeuralAmpModelerCore's A2 example (MIT). `scripts/snaptone-golden.ts` compares that fixture's 8840-byte clone to VLTN's `snaptone-a2.clo`. The current diff is recorded in `RESEARCH.md`.
