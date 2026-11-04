/*
 * Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0.
 * Upstream: app/src/renderer/src/snaptone/htkpa.ts at 9591679ea3c41ec56938ff5af937af6c3ba2bdef.
 * exp() is FreeBSD/fdlibm e_exp.c (Copyright (C) 2004 by Sun Microsystems, Inc.; permission to use, copy,
 * modify, and distribute this software is freely granted, provided that this notice is preserved).
 */

// Freestanding (no libc) wasm32 kernel for the two hot loops of htkpa.ts: the biquad, the 4x oversampled
// amp shaper (OversampledShaper + allpassChain + expf) and the uniformly partitioned convolver
// (PartitionedConvolver + cjjFft128). It must give the same bytes as the TypeScript in V8:
//   - float ops here are the binary32 ops htkpa.ts writes as Math.fround(a op b);
//   - the biquad runs in double, like htkpa.ts biquadFilter;
//   - expf is (float)exp((double)x) with fdlibm exp, which is what V8's Math.exp runs;
//   - the operation order of every expression follows htkpa.ts.
// Build with -ffp-contract=off (no FMA) and without -ffast-math. scripts/snaptone-parity.ts is the proof.
//
// Build (committed as htkpakernel.wasm): npm run build:wasm

#define EXPORT __attribute__((visibility("default")))

typedef unsigned int u32;
typedef unsigned long long u64;

void* memset(void* dst, int value, unsigned long n)
{
  unsigned char* d = dst;
  while (n--) *d++ = (unsigned char)value;
  return dst;
}

void* memcpy(void* dst, const void* src, unsigned long n)
{
  unsigned char* d = dst;
  const unsigned char* s = src;
  while (n--) *d++ = *s++;
  return dst;
}

// ---------------------------------------------------------------------------
// fdlibm exp (e_exp.c).
// ---------------------------------------------------------------------------

static inline u32 high_word(double x)
{
  union { double d; u64 u; } v = { x };
  return (u32)(v.u >> 32);
}

static inline u32 low_word(double x)
{
  union { double d; u64 u; } v = { x };
  return (u32)v.u;
}

static inline double from_words(u32 hi, u32 lo)
{
  union { u64 u; double d; } v = { ((u64)hi << 32) | lo };
  return v.d;
}

static const double one = 1.0;
static const double halF[2] = { 0.5, -0.5 };
static const double huge = 1.0e+300;
static const double o_threshold = 7.09782712893383973096e+02;
static const double u_threshold = -7.45133219101941108420e+02;
static const double ln2HI[2] = { 6.93147180369123816490e-01, -6.93147180369123816490e-01 };
static const double ln2LO[2] = { 1.90821492927058770002e-10, -1.90821492927058770002e-10 };
static const double invln2 = 1.44269504088896338700e+00;
static const double P1 = 1.66666666666666019037e-01;
static const double P2 = -2.77777777770155933842e-03;
static const double P3 = 6.61375632143793436117e-05;
static const double P4 = -1.65339022054652515390e-06;
static const double P5 = 4.13813679705723846039e-08;
static const double twom1000 = 9.33263618503218878990e-302;

static double fdlibm_exp(double x)
{
  double y, hi = 0.0, lo = 0.0, c, t, twopk;
  int k = 0;
  u32 hx = high_word(x);
  int xsb = (hx >> 31) & 1;
  hx &= 0x7fffffff;

  if (hx >= 0x40862E42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | low_word(x)) != 0) return x + x;
      return xsb == 0 ? x : 0.0;
    }
    if (x > o_threshold) return huge * huge;
    if (x < u_threshold) return twom1000 * twom1000;
  }

  if (hx > 0x3fd62e42) {
    if (hx < 0x3FF0A2B2) {
      hi = x - ln2HI[xsb];
      lo = ln2LO[xsb];
      k = 1 - xsb - xsb;
    } else {
      k = (int)(invln2 * x + halF[xsb]);
      t = k;
      hi = x - t * ln2HI[0];
      lo = t * ln2LO[0];
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    if (huge + x > one) return one + x;
  } else {
    k = 0;
  }

  t = x * x;
  if (k >= -1021) twopk = from_words(0x3ff00000 + ((u32)k << 20), 0);
  else twopk = from_words(0x3ff00000 + ((u32)(k + 1000) << 20), 0);
  c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k == 0) return one - ((x * c) / (c - 2.0) - x);
  y = one - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) {
    if (k == 1024) return y * 2.0 * 8.98846567431157953865e+307; // 0x1p1023
    return y * twopk;
  }
  return y * twopk * twom1000;
}

static inline float expf_v8(float x)
{
  return (float)fdlibm_exp((double)x);
}

// ---------------------------------------------------------------------------
// biquadFilter: double state, float in and out.
// ---------------------------------------------------------------------------

#define BIQUAD_IN_GAIN 1000.0
#define BIQUAD_OUT_GAIN 0.001

EXPORT void htkpa_biquad(const float* src, float* dst, int n, double b0, double b1, double b2, double a1, double a2)
{
  double na1 = -a1;
  double na2 = -a2;
  double w1 = 0.0;
  double w2 = 0.0;
  for (int i = 0; i < n; i++) {
    double w = na1 * w1 + (na2 * w2 + (double)src[i] * BIQUAD_IN_GAIN);
    double y = b0 * w + (b2 * w2 + b1 * w1);
    dst[i] = (float)((double)(float)y * BIQUAD_OUT_GAIN);
    w2 = w1;
    w1 = w;
  }
}

// ---------------------------------------------------------------------------
// OversampledShaper. up and down are IIR_UP_COEFFS (28) and IIR_DOWN_COEFFS (24).
// ---------------------------------------------------------------------------

#define UP1_OFFSET 0
#define UP1_STAGES 7
#define UP2_OFFSET 7
#define UP2_STAGES 5
#define DOWN1_OFFSET 6
#define DOWN1_STAGES 4
#define DOWN2_OFFSET 0
#define DOWN2_STAGES 6
#define HALFBAND_AVG 0.5f

static inline float allpass_chain(float x, const float* c, float* state, int from, int to)
{
  for (int k = from; k < to; k++) {
    float y = c[k] * x + state[k];
    state[k] = x - c[k] * y;
    x = y;
  }
  return x;
}

EXPORT void htkpa_shape(float* buf, int n, const float* up, const float* down, float coeffPos, float coeffNeg, float ampPos, float ampNeg)
{
  float up1[UP1_STAGES] = { 0 };
  float up2[UP2_STAGES] = { 0 };
  float down1[DOWN1_STAGES] = { 0 };
  float down2[DOWN2_STAGES] = { 0 };
  float prev1 = 0.0f;
  float prev2 = 0.0f;
  const float* cu1 = up + UP1_OFFSET;
  const float* cu2 = up + UP2_OFFSET;
  const float* cd1 = down + DOWN1_OFFSET;
  const float* cd2 = down + DOWN2_OFFSET;
  const int su1 = UP1_STAGES - (UP1_STAGES >> 1);
  const int su2 = UP2_STAGES - (UP2_STAGES >> 1);
  const int sd1 = DOWN1_STAGES - (DOWN1_STAGES >> 1);
  const int sd2 = DOWN2_STAGES - (DOWN2_STAGES >> 1);

  for (int i = 0; i < n; i++) {
    float x2[2];
    float x4[4];
    float x = buf[i];
    x2[0] = allpass_chain(x, cu1, up1, 0, su1);
    x2[1] = allpass_chain(x, cu1, up1, su1, UP1_STAGES);
    x4[0] = allpass_chain(x2[0], cu2, up2, 0, su2);
    x4[1] = allpass_chain(x2[0], cu2, up2, su2, UP2_STAGES);
    x4[2] = allpass_chain(x2[1], cu2, up2, 0, su2);
    x4[3] = allpass_chain(x2[1], cu2, up2, su2, UP2_STAGES);
    for (int k = 0; k < 4; k++) {
      float v = x4[k];
      int positive = 0.0f < v;
      float coeff = positive ? coeffPos : coeffNeg;
      float gain = positive ? ampPos : ampNeg;
      x4[k] = (1.0f - expf_v8(coeff * v)) * gain;
    }
    float a = allpass_chain(x4[0], cd1, down1, 0, sd1);
    float b = allpass_chain(x4[1], cd1, down1, sd1, DOWN1_STAGES);
    float y0 = (a + prev1) * HALFBAND_AVG;
    prev1 = b;
    a = allpass_chain(x4[2], cd1, down1, 0, sd1);
    b = allpass_chain(x4[3], cd1, down1, sd1, DOWN1_STAGES);
    float y1 = (a + prev1) * HALFBAND_AVG;
    prev1 = b;
    a = allpass_chain(y0, cd2, down2, 0, sd2);
    b = allpass_chain(y1, cd2, down2, sd2, DOWN2_STAGES);
    buf[i] = (a + prev2) * HALFBAND_AVG;
    prev2 = b;
  }
}

// ---------------------------------------------------------------------------
// cjjFft128 and the partitioned convolver. twiddle is CJJ_TWIDDLE (128 floats).
// ---------------------------------------------------------------------------

#define CJJ_N 128
#define CJJ_STAGES 7
#define CONV_BLOCK 64
#define CONV_BINS (CONV_BLOCK + 1)
#define CONV_MAX_PARTITIONS 32

static int bitrev[CJJ_N];
static int bitrevReady = 0;

static void init_bitrev(void)
{
  if (bitrevReady) return;
  for (int i = 0; i < CJJ_N; i++) {
    int r = 0;
    for (int b = 0; b < CJJ_STAGES; b++) r |= ((i >> b) & 1) << (CJJ_STAGES - 1 - b);
    bitrev[i] = r;
  }
  bitrevReady = 1;
}

static void cjj_fft128(float* re, float* im, int inverse, const float* tw)
{
  for (int i = 0; i < CJJ_N - 1; i++) {
    int j = bitrev[i];
    if (i < j) {
      float t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (int half = 1, span = 2; half < CJJ_N; half *= 2, span *= 2) {
    for (int a = 0; a < CJJ_N; a += span) {
      int b = a + half;
      float br = re[b];
      float bi = im[b];
      re[b] = re[a] - br;
      im[b] = im[a] - bi;
      re[a] = br + re[a];
      im[a] = bi + im[a];
    }
    int step = CJJ_N / span;
    for (int j = 1, t = step; j < half; j++, t += step) {
      float s = inverse ? tw[t] : -tw[t];
      float c = tw[(CJJ_N / 4 + CJJ_N - t) % CJJ_N];
      for (int a = j; a < CJJ_N; a += span) {
        int b = a + half;
        float br = re[b];
        float bi = im[b];
        float ar = re[a];
        float ai = im[a];
        float tr = br * c - s * bi;
        float ti = br * s + bi * c;
        re[b] = ar - tr;
        im[b] = ai - ti;
        re[a] = tr + ar;
        im[a] = ti + ai;
      }
    }
  }
  if (inverse) {
    for (int k = 0; k < CJJ_N; k++) {
      re[k] = re[k] / CJJ_N;
      im[k] = im[k] / CJJ_N;
    }
  }
}

static float hRe[CONV_MAX_PARTITIONS][CONV_BINS];
static float hIm[CONV_MAX_PARTITIONS][CONV_BINS];
static float xRe[CONV_MAX_PARTITIONS][CONV_BINS];
static float xIm[CONV_MAX_PARTITIONS][CONV_BINS];
static float overlap[CONV_BLOCK];
static float fftRe[CJJ_N];
static float fftIm[CJJ_N];
static float accRe[CJJ_N];
static float accIm[CJJ_N];
static float work[CONV_BLOCK];

static void forward(const float* src, float* outRe, float* outIm, const float* tw)
{
  for (int i = 0; i < CJJ_N; i++) {
    fftRe[i] = 0.0f;
    fftIm[i] = 0.0f;
  }
  for (int i = 0; i < CONV_BLOCK; i++) fftRe[i] = src[i];
  cjj_fft128(fftRe, fftIm, 0, tw);
  for (int k = 0; k < CONV_BINS; k++) {
    outRe[k] = fftRe[k];
    outIm[k] = fftIm[k];
  }
}

static void process_block(float* buf, int P, int slot, const float* tw)
{
  forward(buf, xRe[slot], xIm[slot], tw);
  for (int k = 0; k < CJJ_N; k++) {
    accRe[k] = 0.0f;
    accIm[k] = 0.0f;
  }
  for (int u = 0; u < P; u++) {
    int s = (((slot - u) % P) + P) % P;
    const float* xr = xRe[s];
    const float* xi = xIm[s];
    const float* hr = hRe[u];
    const float* hi = hIm[u];
    for (int k = 0; k < CONV_BINS; k++) {
      accRe[k] = (xr[k] * hr[k] - hi[k] * xi[k]) + accRe[k];
      accIm[k] = (xr[k] * hi[k] + xi[k] * hr[k]) + accIm[k];
    }
  }
  for (int k = 1; k < CONV_BLOCK; k++) {
    accRe[CJJ_N - k] = accRe[k];
    accIm[CJJ_N - k] = -accIm[k];
  }
  for (int k = 0; k < CJJ_N; k++) {
    fftRe[k] = accRe[k];
    fftIm[k] = accIm[k];
  }
  cjj_fft128(fftRe, fftIm, 1, tw);
  for (int k = 0; k < CONV_BLOCK; k++) {
    buf[k] = fftRe[k] + overlap[k];
    overlap[k] = fftRe[CONV_BLOCK + k];
  }
}

/** convolveBlocks in place on buf[0..n). Returns 0, or -1 when the IR needs more than 32 partitions. */
EXPORT int htkpa_convolve(const float* ir, int irLen, float* buf, int n, const float* tw)
{
  int P = (irLen + CONV_BLOCK - 1) / CONV_BLOCK;
  if (P > CONV_MAX_PARTITIONS) return -1;
  init_bitrev();
  for (int p = 0; p < P; p++) {
    for (int i = 0; i < CONV_BLOCK; i++) {
      int k = p * CONV_BLOCK + i;
      work[i] = k < irLen ? ir[k] : 0.0f;
    }
    forward(work, hRe[p], hIm[p], tw);
    for (int k = 0; k < CONV_BINS; k++) {
      xRe[p][k] = 0.0f;
      xIm[p][k] = 0.0f;
    }
  }
  for (int k = 0; k < CONV_BLOCK; k++) overlap[k] = 0.0f;

  int slot = 0;
  int j = 0;
  for (; j <= n - CONV_BLOCK; j += CONV_BLOCK) {
    for (int i = 0; i < CONV_BLOCK; i++) work[i] = buf[j + i];
    process_block(work, P, slot, tw);
    for (int i = 0; i < CONV_BLOCK; i++) buf[j + i] = work[i];
    slot = (slot + 1) % P;
  }
  int rem = n % CONV_BLOCK;
  if (rem != 0) {
    for (int i = 0; i < CONV_BLOCK; i++) work[i] = 0.0f;
    for (int i = 0; i < rem; i++) work[i] = buf[n - rem + i];
    process_block(work, P, slot, tw);
    for (int i = 0; i < rem; i++) buf[n - rem + i] = work[i];
  }
  return 0;
}
