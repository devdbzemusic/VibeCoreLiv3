// VibeCore DSP Core — Wave Shaper Curve Generators.
//
// All WaveShaperNode curves are generated here. Previously each sound module
// built its own tanh/drive/softclip curve inline — this is the single source.
//
// All curves return Float32Array (N samples, -1..+1 input domain) ready for
// `WaveShaperNode.curve = result`. Curves are generated once and cached by
// the consumer (not here — no module-scope caches, no global state).
//
// Realtime note: curve generation is O(N) and runs on the control thread
// (graph construction), never in the audio render thread. N defaults to 8192
// for smoothness; 1024 is sufficient for aggressive distortion.

export const DEFAULT_CURVE_SIZE = 8192;
export const MIN_CURVE_SIZE = 64;
export const MAX_CURVE_SIZE = 16384;

function sizedN(n?: number): number {
  if (n == null) return DEFAULT_CURVE_SIZE;
  return Math.max(MIN_CURVE_SIZE, Math.min(MAX_CURVE_SIZE, Math.floor(n)));
}

/**
 * Tanh distortion curve — the most common soft-clip / overdrive shape.
 * @param amount  0..1+  (0 = bypass, 1 = moderate, >1 = aggressive)
 * @param n       curve resolution (default 8192)
 */
export function makeTanhCurve(amount: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const k = Math.max(0, amount);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    cv[i] = Math.tanh(x * k);
  }
  return cv;
}

/**
 * Tube-style asymmetrical distortion — even harmonics + DC offset trim.
 * Adds a slight positive bias (2nd harmonic) then symmetric tanh clip.
 */
export function makeTubeCurve(amount: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const k = Math.max(0, amount);
  const bias = 0.08; // positive bias → 2nd harmonic emphasis
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    cv[i] = Math.tanh((x + bias) * k) - Math.tanh(bias * k);
  }
  // Normalize peak to ±1
  const peak = Math.max(...cv.map(Math.abs)) || 1;
  for (let i = 0; i < N; i++) cv[i] /= peak;
  return cv;
}

/**
 * Tape saturation — soft knee compression curve with subtle asymmetry.
 * Mimics magnetic tape's gradual onset + slight high-frequency loss.
 */
export function makeTapeCurve(amount: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const k = Math.max(0, amount) * 1.5;
  const knee = 0.55;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const sign = x < 0 ? -1 : 1;
    // Soft knee: linear below knee, compressive above
    const shaped = ax < knee
      ? ax
      : knee + (1 - knee) * Math.tanh((ax - knee) * k) / Math.max(0.01, Math.tanh(k));
    cv[i] = sign * shaped;
  }
  // Normalize
  const peak = Math.max(...cv.map(Math.abs)) || 1;
  for (let i = 0; i < N; i++) cv[i] /= peak;
  return cv;
}

/**
 * Foldback distortion — signal folds back toward zero when it exceeds the
 * threshold, creating a buzzy, harmonically-rich clipping characteristic.
 * @param threshold  0..1  (input level at which folding begins)
 */
export function makeFoldbackCurve(threshold: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const thr = Math.max(0.05, Math.min(1, threshold));
  for (let i = 0; i < N; i++) {
    let x = (i / (N - 1)) * 2 - 1;
    // Fold: reflect excess back toward zero, repeat
    const range = thr * 2;
    if (range > 0) {
      x = ((x + thr) % range + range) % range - thr;
    }
    cv[i] = x;
  }
  return cv;
}

/**
 * Soft clip — cubic law. Gentle saturation that preserves transients.
 *  y = x - (x³ / 3) for |x| < 1, clamped beyond.
 */
export function makeSoftClipCurve(_amount: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const shaped = ax <= 1
      ? x - (x * x * x) / 3
      : Math.sign(x) * (1 - 1 / (3 * ax * ax));
    cv[i] = shaped;
  }
  // Normalize to ±1
  const peak = Math.max(...cv.map(Math.abs)) || 1;
  for (let i = 0; i < N; i++) cv[i] /= peak;
  return cv;
}

/**
 * Hard clip / overdrive — linear until threshold, then hard clamp.
 * @param amount  0..1  (0 = bypass, 1 = full square-ish clip)
 */
export function makeOverdriveCurve(amount: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const threshold = Math.max(0.01, 1 - amount);
  const gain = 1 / threshold;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    const driven = x * gain;
    cv[i] = driven < -1 ? -1 : driven > 1 ? 1 : driven;
  }
  return cv;
}

/**
 * Bitcrush curve — quantise to N discrete levels.
 * @param bits  1..16  (number of quantisation bits)
 */
export function makeBitcrushCurve(bits: number, n?: number): Float32Array {
  const N = sizedN(n);
  const cv = new Float32Array(N);
  const levels = Math.pow(2, Math.max(1, Math.min(16, bits)));
  const step = 2 / levels;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    cv[i] = Math.round(x / step) * step;
  }
  return cv;
}

/**
 * Generic drive curve — alias for tanh with a user-facing "drive" parameter.
 * Used by the engine's per-part drive and the FX bus "Drive" type.
 */
export function makeDriveCurve(amount: number, n?: number): Float32Array {
  // Drive 0..100 maps to tanh k = 1 + amount/100 * 8 (matches the old inline
  // engine.ts kick-drive curve exactly so existing projects sound identical).
  const k = 1 + Math.max(0, amount) / 100 * 8;
  return makeTanhCurve(k, n);
}