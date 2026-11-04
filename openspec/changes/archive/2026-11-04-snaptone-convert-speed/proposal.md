## Why

Converting a NAM A2 capture to a SnapTone takes about 20 s before the upload even starts, and the TONE3000 flow pays it on every pick. TONE3000's API terms rule out converting ahead of time or sharing conversions from a server ("Only download models when a user requests them", "Do not preload catalog content onto devices", no "hosting tones on your own servers"). So the conversion itself has to get faster, on the user's machine, after the user asks for a model.

Measured in Node on the committed fixture (`src/snaptone/fixtures/nam_core_a2.nam`, 48 kHz) with the served test signal, 4 cores:

| Step | Time | What runs |
| --- | --- | --- |
| Test signal | ~0.03 s parse + one 12.3 MB fetch per conversion | `worker.ts` fetches `nam_input_wav.wav` and `a2kernel.wasm` in every new worker |
| Excitation | ~1.5 s | `convertSampleRate` 44.1 → 48 kHz of the same signal, every conversion |
| Render | ~8.2 s | `a2_process` (wasm SIMD), one thread |
| Clone | ~12.8 s | `cloneSnapTone` in TypeScript; `iterAmpCoeff` is 11.2 s of it (4x shaper ~7.1 s, partitioned convolver + `cjjFft128` ~6.1 s, inclusive) |

`convertNamToSnapTone` creates a new Worker per call, and nginx serves the signal with no `Cache-Control`.

## What Changes

- **Warm converter (point 1).** One converter stays alive for the session. It loads the wasm and the test signal once and keeps the resampled excitation per model rate (44.1, 48, 96 kHz) in memory. A second conversion does not fetch the signal again or resample it again. Cancel still stops the work immediately.
- **Parallel render (point 2a).** The A2 render is feed-forward: each output sample depends only on the previous `prewarm` input samples. The converter splits the excitation into chunks, renders each chunk in its own worker after `prewarm` frames of real history, and joins the outputs. Checked on the fixture: 2 and 4 chunks give 0 differing samples against the one-thread render, and the slowest of 4 chunks takes 2.3 s instead of 8.2 s.
- **Clone hot path in wasm (point 2b).** The two hot loops of `iterAmpCoeff` move to a second freestanding kernel, `htkpakernel.c`, built like `a2kernel.c`: the 4x oversampled amp shaper (`OversampledShaper`, `allpassChain`, `expf`) and the partitioned convolver (`PartitionedConvolver`, `cjjFft128`). The rest of `htkpa.ts` stays TypeScript.
- **The bytes do not change.** The SnapTone file for a given `.nam` must be byte-identical to today's TypeScript output in V8 (Chrome, Edge, WebView2, Node). A dev check compares the fast path to the current path on the fixture. A difference is a failure and is not loosened.
- Progress stages, cancel, the A1 rejection, and the session API (`inspectNam`, `convertNamToSnapTone`) stay the same, so the SnapTone modal and the TONE3000 catalog do not change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `device-connection`: The SnapTone conversion keeps its output byte-identical, reuses the loaded converter and excitation within a session, and keeps cancel immediate. No change to the upload, slot table, or link rules.

## Non-goals

- Caching SnapTone files across sessions, converting favorites or downloads ahead of time, or a GP Studio conversion server. Those wait for written permission from TONE3000.
- Changing the upload to the pedal (146 frames with ACK). That is protocol time, not conversion time.
- Changing the clone algorithm, its constants, or its result. This change is about speed only.
- Rebuilding `a2kernel.wasm`. It stays the committed binary.
- NAM A1, GP-200, and Bluetooth upload.

## Impact

- `src/snaptone/`: `convert.ts` (warm converter, worker pool, cancel), `worker.ts` (render-chunk and clone requests), `pipeline.ts` (chunked render, excitation cache), `htkpa.ts` (calls into the new kernel), new `htkpakernel.c` and committed `htkpakernel.wasm`, `README.md`, `RESEARCH.md` (measured times before and after).
- `scripts/`: a parity check that compares the fast path to the current one byte for byte, and a timing script.
- `package.json`: `build:wasm` for `htkpakernel.c` (clang `--target=wasm32 -O3 -msimd128 -nostdlib`, no Emscripten).
- Session and UI: no change beyond what `convertNamToSnapTone` already exposes.
- Server: optional `Cache-Control` for `/snaptone/nam_input_wav.wav` in nginx (Pato applies it; the app does not depend on it).
