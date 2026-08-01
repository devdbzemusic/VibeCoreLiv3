// Pure DSP helpers for click/discontinuity detection.
// Used by automated audio regression tests to verify that loop wraps,
// position jumps and size changes in the Freeze engine do not produce
// audible artifacts.
//
// We don't depend on Web Audio here so these helpers can run inside
// Vitest/jsdom and in headless CI.

export interface ClickReport {
  /** absolute peak sample value in window */
  peak: number;
  /** root-mean-square of window */
  rms: number;
  /** largest |x[n] - x[n-1]| within window */
  maxDelta: number;
  /** number of samples whose |x[n] - x[n-1]| exceeds `deltaThreshold` */
  clickCount: number;
  /** sample indices of detected clicks (capped at 32 entries) */
  clickIdx: number[];
}

export interface ClickThresholds {
  /** Sample-to-sample slew threshold considered a click. Default 0.20 (~ -14 dBFS jump). */
  deltaThreshold?: number;
}

/** Scan a Float32 signal window for discontinuities ("clicks"). */
export function detectClicks(
  data: Float32Array,
  { deltaThreshold = 0.20 }: ClickThresholds = {},
): ClickReport {
  let peak = 0;
  let sumSq = 0;
  let maxDelta = 0;
  let clickCount = 0;
  const clickIdx: number[] = [];
  let prev = data[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
    if (i > 0) {
      const d = Math.abs(v - prev);
      if (d > maxDelta) maxDelta = d;
      if (d > deltaThreshold) {
        clickCount++;
        if (clickIdx.length < 32) clickIdx.push(i);
      }
    }
    prev = v;
  }
  const rms = data.length ? Math.sqrt(sumSq / data.length) : 0;
  return { peak, rms, maxDelta, clickCount, clickIdx };
}

/** Compare RMS energy of two equal-length windows. Returns dB delta (b−a). */
export function rmsDeltaDb(a: Float32Array, b: Float32Array): number {
  const ra = detectClicks(a).rms;
  const rb = detectClicks(b).rms;
  if (ra < 1e-9 || rb < 1e-9) return 0;
  return 20 * Math.log10(rb / ra);
}

/** Build a sine partial that, when looped naively, will click at the seam
 *  because the loop window does not end at a zero crossing.
 *  freq=440Hz, sampleRate=48000, windowSec=0.2 → ~88 cycles + offset → click. */
export function makeNonZeroLoopSegment(
  freq: number,
  sampleRate: number,
  windowSec: number,
): Float32Array {
  const n = Math.floor(windowSec * sampleRate);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < n; i++) out[i] = Math.sin(i * w) * 0.8;
  return out;
}

/** Simulate a looped playback of `seg` for `totalSec` seconds. */
export function simulateNativeLoop(
  seg: Float32Array,
  sampleRate: number,
  totalSec: number,
): Float32Array {
  const totalN = Math.floor(totalSec * sampleRate);
  const out = new Float32Array(totalN);
  for (let i = 0; i < totalN; i++) out[i] = seg[i % seg.length];
  return out;
}

/** Apply a cosine seam-dip (matches the engine's 3 ms setTargetAtTime dip)
 *  every `segLen` samples — mirrors `scheduleFreezeSeams` in granular.ts.
 *  Envelope is a bowl: gain=1 at the edges, 0 at the seam, using the
 *  raised-cosine curve g(d) = (1 - cos(π·d)) / 2 with d = |i-seam|/dipN. */
export function applySeamDips(
  signal: Float32Array,
  segLen: number,
  sampleRate: number,
  dipSec = 0.003,
): Float32Array {
  const out = new Float32Array(signal.length);
  const dipN = Math.max(2, Math.floor(dipSec * sampleRate));
  for (let i = 0; i < signal.length; i++) out[i] = signal[i];
  for (let seam = segLen; seam < signal.length; seam += segLen) {
    const start = Math.max(0, seam - dipN);
    const end = Math.min(signal.length, seam + dipN);
    for (let i = start; i < end; i++) {
      const d = Math.abs(i - seam) / dipN;              // 0 at seam → 1 at edges
      const gain = 0.5 - 0.5 * Math.cos(d * Math.PI);   // 0 at seam → 1 at edges
      out[i] = signal[i] * gain;
    }
  }
  return out;
}

/** Simulate a position/size jump. Mirrors the engine path where the outgoing
 *  voice ramps to 0 over `rampSec` and the incoming voice ramps from 0 to 1
 *  over the same window, with the two envelopes overlapping for `rampSec`. */
export function simulatePositionJump(
  segA: Float32Array,
  segB: Float32Array,
  sampleRate: number,
  totalSec: number,
  jumpSec: number,
  rampSec = 0.005,
): Float32Array {
  const totalN = Math.floor(totalSec * sampleRate);
  const jumpN = Math.floor(jumpSec * sampleRate);
  const rampN = Math.max(1, Math.floor(rampSec * sampleRate));
  const out = new Float32Array(totalN);
  for (let i = 0; i < totalN; i++) {
    let s = 0;
    // Outgoing voice A: full level until rampN before jump, then linear → 0.
    if (i < jumpN) {
      const distToEnd = jumpN - i;
      const envA = distToEnd >= rampN ? 1 : distToEnd / rampN;
      s += segA[i % segA.length] * envA;
    }
    // Incoming voice B: ramps from 0→1 over rampN samples starting at jumpN-rampN
    // so it overlaps A's fade-out (equal-power-ish crossfade).
    if (i >= jumpN - rampN) {
      const offset = i - (jumpN - rampN);
      const envB = Math.min(1, offset / rampN);
      const srcIdx = i - jumpN;
      const sample = srcIdx >= 0 ? segB[srcIdx % segB.length] : 0;
      s += sample * envB;
    }
    out[i] = s;
  }
  return out;
}
