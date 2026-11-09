# Notices

The SnapTone conversion in this folder contains work from the projects below. Each notice is kept as its license requires.

## VLTN Tone Studio

- Source: https://github.com/grzmol/VLTN-Tone-Studio, commit `9591679ea3c41ec56938ff5af937af6c3ba2bdef`.
- License: GNU General Public License v3.0 only (GPL-3.0-only). The full text is in the repository's [`LICENSE`](../../LICENSE).
- Copyright (c) 2026 VLTN Tone Studio contributors.
- Used in: the files listed in [`README.md`](README.md). GP Studio modified them; each file header gives the date.

## NeuralAmpModelerCore

- Source: https://github.com/sdatkinson/NeuralAmpModelerCore.
- Used in: `fixtures/nam_core_a2.nam` (`example_models/A2.nam` at commit `b5a68c3`, unchanged). `a2kernel.c` follows the operation order of `NAM/wavenet/a2_fast.cpp` at commit `baf1bf8`.

```
MIT License

Copyright (c) 2023 Steven Atkinson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## r8brain-free-src

- Source: https://github.com/avaneev/r8brain-free-src, commit `7f1980e` (after the version-1.6 tag).
- Used in: `htkpa.ts`, the sample-rate conversion (`r8b::CDSPResampler24`).
- Sample rate converter designed by Aleksey Vaneev of Voxengo.

```
The MIT License (MIT)

r8brain-free-src Copyright (c) 2013-2014 Aleksey Vaneev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Ooura FFT (fft4g)

- Source: General Purpose FFT Package, http://www.kurims.kyoto-u.ac.jp/~ooura/fft.html.
- Used in: `htkpa.ts`, the real FFT shared by the resampler and the clone (`RealFft`, `OouraFft`). GP Studio modified it (a TypeScript port).

```
Copyright Takuya OOURA, 1996-2001

You may use, copy, modify and distribute this code for any purpose (include commercial use) and without fee. Please refer to this package when you modify this code.
```

## AudioFFT

- Source: https://github.com/HiFi-LoFi/AudioFFT.
- Used in: `htkpa.ts`, the `OouraFft` wrapper (bin layout and scaling of `audiofft::OouraFFT`).

```
Copyright (c) 2017 HiFi-LoFi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## fdlibm

- Source: FreeBSD `lib/msun/src/e_exp.c`.
- Used in: `htkpakernel.c` and `htkpakernel.wasm`, the `exp()` function.

```
Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.

Permission to use, copy, modify, and distribute this
software is freely granted, provided that this notice
is preserved.
```
