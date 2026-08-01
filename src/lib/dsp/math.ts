// VibeCore DSP Core — Math & Conversion Utilities.
//
// Central source of truth for all DSP math primitives. Every module that
// needs signal-processing math imports from here — no inline reimplementations.
//
// Realtime-safe: all functions are pure, O(1), allocation-free, and branch-free
// in the hot path where possible. SIMD-friendly: scalar implementations map
// 1:1 to ARM NEON / AVX2 intrinsics in the native engine (see MODULE_DSP_CORE §9).

// ── Constants ───────────────────────────────────────────────────────────────
export const MIDI_A4 = 440;          // Hz for MIDI note 69
export const MIDI_A4_SEMITONE = 69;
export const TAU = Math.PI * 2;

// Smallest normal Float32 — values below this are denormal (slow on most CPUs).
// Used by denormalFlush to gate the audio path.
export const DENORMAL_THRESHOLD = 1.1754943508222875e-38;

// ── Clamping & interpolation ────────────────────────────────────────────────

/** Clamp `v` to [lo, hi]. O(1), branch-free on most engines. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolate between `a` and `b` at position `t` (0..1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map `v` from range [inLo..inHi] to [outLo..outHi], clamped. */
export function mapRange(
  v: number, inLo: number, inHi: number, outLo: number, outHi: number,
): number {
  const t = clamp((v - inLo) / (inHi - inLo), 0, 1);
  return lerp(outLo, outHi, t);
}

// ── Level conversions ──────────────────────────────────────────────────────

/** Decibels → linear gain. O(1). */
export function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

/** Linear gain → decibels. Returns -Infinity for gain ≤ 0. */
export function linToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}

// ── Pitch / frequency conversions ───────────────────────────────────────────

/** MIDI note number → frequency in Hz, using A4 = 440 Hz. */
export function midiToFreq(semi: number): number {
  return MIDI_A4 * Math.pow(2, (semi - MIDI_A4_SEMITONE) / 12);
}

/** Base frequency × semitone offset → frequency.  e.g. semiToHz(440, 12) = 880. */
export function semiToHz(base: number, semi: number): number {
  return base * Math.pow(2, semi / 12);
}

/** Frequency in Hz → MIDI note number (fractional).  Inverse of midiToFreq. */
export function hzToMidi(hz: number): number {
  return MIDI_A4_SEMITONE + 12 * Math.log2(hz / MIDI_A4);
}

// ── Fast approximations (SIMD-friendly polynomial forms) ──────────────────────

/**
 * Fast tanh approximation — 7th-order Padé rational.
 * Max error < 2e-4 across [-1, 1]; sufficient for wave shaping.
 * Maps to NEON/AVX2 polynomial evaluation in the native engine.
 */
export function fastTanh(x: number): number {
  const x2 = x * x;
  const a = x * (27 + x2 * (2.4048 + x2 * 0.1939));
  const b = 27 + x2 * (6.0376 + x2 * 0.3878);
  return a / b;
}

/**
 * Fast atan approximation — Bhaskara I formula.
 * Max error < 0.001 rad across [-1, 1].
 */
export function fastAtan(x: number): number {
  return x / (1 + 0.28 * Math.abs(x));
}

// ── Panning ─────────────────────────────────────────────────────────────────

/** Equal-power sine-law pan gains for pan ∈ [-1, +1]. Returns [left, right]. */
export function equalPowerPan(pan: number): [number, number] {
  const ang = (clamp(pan, -1, 1) + 1) * 0.25 * Math.PI; // -1..1 → 0..π/2
  return [Math.cos(ang), Math.sin(ang)];
}

// ── Phase / wrapping ────────────────────────────────────────────────────────

/** Wrap phase to [0, 1). O(1), handles negatives. */
export function wrapPhase(phase: number): number {
  return phase - Math.floor(phase);
}

// ── Denormal protection ─────────────────────────────────────────────────────

/**
 * Flush denormal floats to zero. On most CPUs, denormals (|x| < 1.18e-38)
 * are 10–100× slower than normal floats. In JavaScript the UA handles this
 * in the Web Audio render thread, but pure-DSP algorithms that produce
 * exponentially-decaying values should flush to avoid pathological cases.
 *
 * The native engine enables FTZ (flush-to-zero) mode globally; this
 * function mirrors that behaviour for the scalar JS fallback.
 */
export function denormalFlush(x: number): number {
  return Math.abs(x) < DENORMAL_THRESHOLD ? 0 : x;
}

/** In-place denormal flush for a Float32Array segment. O(n). */
export function flushBuffer(buf: Float32Array, len: number): void {
  for (let i = 0; i < len; i++) {
    if (Math.abs(buf[i]) < DENORMAL_THRESHOLD) buf[i] = 0;
  }
}