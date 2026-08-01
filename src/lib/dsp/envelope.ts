// VibeCore DSP Core — Envelope Generators.
//
// ADSR, AHDSR, and multi-stage envelope generators. These provide both:
//   • pure value-at-time functions (for sampling / LFO / testing)
//   • AudioParam schedulers (applyADSR / applyAHDSR / applyMultiStage)
//     that drive any AudioParam (gain, frequency, filter cutoff, etc.)
//
// All envelopes are sample-rate independent (time-based) and deterministic.
// Exponential ramps are used where musically appropriate (gain/frequency);
// linear ramps for parameters that can't go exponential (pan, width).
//
// Realtime-safe: schedulers call AudioParam methods (setTargetAtTime,
// linearRampToValueAtTime, exponentialRampToValueAtTime) — no allocations,
// no closures in hot paths, no UI access.

import { clamp } from "./math";

// ── ADSR ─────────────────────────────────────────────────────────────────────

export interface ADSRParams {
  attack: number;    // seconds (0..10)
  decay: number;     // seconds (0..10)
  sustain: number;   // 0..1
  release: number;   // seconds (0..10)
  /** Peak level at end of attack (default 1). */
  peak?: number;
}

/**
 * Compute the ADSR envelope value at time `t` given a note of total duration
 * `gateSec`. Pure function — for testing, visualisation, and LFO sampling.
 * `gateSec` is the time from note-on to note-off; release extends beyond.
 */
export function computeADSR(t: number, gateSec: number, p: ADSRParams): number {
  const peak = p.peak ?? 1;
  const A = Math.max(0, p.attack);
  const D = Math.max(0, p.decay);
  const S = clamp(p.sustain, 0, 1);
  const R = Math.max(0, p.release);

  if (t < 0) return 0;
  if (t < A) return (t / Math.max(0.001, A)) * peak;
  if (t < A + D) {
    const dt = (t - A) / Math.max(0.001, D);
    return peak + (S * peak - peak) * dt;
  }
  if (t < gateSec) return S * peak;
  const relT = t - gateSec;
  if (relT < R) return S * peak * (1 - relT / Math.max(0.001, R));
  return 0;
}

/**
 * Schedule an ADSR envelope on an AudioParam.
 * @param param   the AudioParam to drive (e.g. gainNode.gain)
 * @param when    audio-context time of note-on
 * @param gateSec  time from note-on to note-off
 * @param p       ADSR parameters
 * @param maxLevel  peak AudioParam value (default 1)
 */
export function applyADSR(
  param: AudioParam, when: number, gateSec: number, p: ADSRParams, maxLevel = 1,
): void {
  const peak = (p.peak ?? 1) * maxLevel;
  const A = Math.max(0.001, p.attack);
  const D = Math.max(0.001, p.decay);
  const S = clamp(p.sustain, 0, 1) * maxLevel;
  const R = Math.max(0.01, p.release);
  const noteOff = when + Math.max(gateSec, A + D + 0.02);

  param.cancelScheduledValues(when);
  param.setValueAtTime(0.0001, when);
  param.linearRampToValueAtTime(peak, when + A);
  param.linearRampToValueAtTime(Math.max(0.0001, S), when + A + D);
  param.setValueAtTime(Math.max(0.0001, S), noteOff);
  param.exponentialRampToValueAtTime(0.0001, noteOff + R);
}

// ── AHDSR (Attack-Hold-Decay-Sustain-Release) ────────────────────────────────

export interface AHDSRParams extends ADSRParams {
  hold: number;      // seconds — full-level hold between attack and decay
}

/**
 * Schedule an AHDSR envelope. The `hold` stage keeps the peak level for a
 * fixed duration before the decay slope begins.
 */
export function applyAHDSR(
  param: AudioParam, when: number, gateSec: number, p: AHDSRParams, maxLevel = 1,
): void {
  const peak = (p.peak ?? 1) * maxLevel;
  const A = Math.max(0.001, p.attack);
  const H = Math.max(0, p.hold);
  const D = Math.max(0.001, p.decay);
  const S = clamp(p.sustain, 0, 1) * maxLevel;
  const R = Math.max(0.01, p.release);
  const noteOff = when + Math.max(gateSec, A + H + D + 0.02);

  param.cancelScheduledValues(when);
  param.setValueAtTime(0.0001, when);
  param.linearRampToValueAtTime(peak, when + A);
  param.setValueAtTime(peak, when + A + H);
  param.linearRampToValueAtTime(Math.max(0.0001, S), when + A + H + D);
  param.setValueAtTime(Math.max(0.0001, S), noteOff);
  param.exponentialRampToValueAtTime(0.0001, noteOff + R);
}

// ── Multi-Stage (arbitrary breakpoint envelope) ──────────────────────────────

export interface EnvStage {
  time: number;      // seconds from note-on
  level: number;     // 0..1+
  curve?: "linear" | "exponential"; // default: linear
}

export interface MultiStageParams {
  stages: EnvStage[];
  /** Sustain stage index — the envelope holds at this stage's level until
   *  note-off, then proceeds through remaining stages as the release. */
  sustainIndex?: number;
}

/**
 * Schedule a multi-stage breakpoint envelope on an AudioParam.
 * Stages must be sorted by time. The `sustainIndex` stage is held until
 * note-off; subsequent stages form the release curve.
 */
export function applyMultiStage(
  param: AudioParam, when: number, gateSec: number, p: MultiStageParams, maxLevel = 1,
): void {
  if (p.stages.length < 2) return;
  const stages = p.stages.filter((s) => s.time >= 0).sort((a, b) => a.time - b.time);
  const susIdx = p.sustainIndex ?? stages.length - 1;

  param.cancelScheduledValues(when);
  param.setValueAtTime(Math.max(0.0001, stages[0].level * maxLevel), when);

  for (let i = 1; i < stages.length; i++) {
    const s = stages[i];
    const t = when + s.time;
    const val = Math.max(0.0001, s.level * maxLevel);
    if (s.curve === "exponential") {
      param.exponentialRampToValueAtTime(val, t);
    } else {
      param.linearRampToValueAtTime(val, t);
    }
    // If this is the sustain stage, hold until note-off
    if (i === susIdx) {
      const noteOff = when + Math.max(gateSec, s.time + 0.02);
      param.setValueAtTime(val, noteOff);
    }
  }
}