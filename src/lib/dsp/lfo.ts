// VibeCore DSP Core — LFO (Low-Frequency Oscillator).
//
// Free-running and beat-synced LFOs with multiple waveforms. The LFO can
// drive any AudioParam via its output gain node, or its value can be sampled
// via computeLFO() for pure-DSP modulation.
//
// Realtime-safe: the oscillator runs on the audio thread (OscillatorNode).
// computeLFO() is a pure O(1) function for control-thread sampling.

import { clamp, wrapPhase, TAU } from "./math";
import { mulberry32, hashSeed, type Rng } from "@/lib/utils/random";

export type LFOWaveform = "sine" | "triangle" | "saw" | "square" | "samplehold";

export interface LFOParams {
  rate: number;        // Hz (0.01..20)
  waveform: LFOWaveform;
  depth: number;       // 0..1 (output gain)
  /** Beat-sync: if set, `rate` is ignored and the LFO cycles per `syncDiv` beats. */
  syncDiv?: "1/16" | "1/8" | "1/4" | "1/2" | "1" | "2";
  bpm?: number;        // required if syncDiv is set
  phase?: number;      // 0..1 initial phase offset
}

/**
 * Pure LFO value computation for a given waveform and phase (0..1).
 * O(1), allocation-free. Used for control-thread sampling and tests.
 */
export function computeLFO(waveform: LFOWaveform, phase: number): number {
  const p = wrapPhase(phase);
  switch (waveform) {
    case "sine":   return Math.sin(p * TAU);
    case "triangle": return 2 * Math.abs(p * 2 - 1) - 1;
    case "saw":    return p * 2 - 1;
    case "square": return p < 0.5 ? 1 : -1;
    case "samplehold": return 0; // S&H value is external — see sampledLFO
    default:       return 0;
  }
}

/** Compute the effective rate in Hz, resolving beat-sync if set. */
export function lfoRateHz(p: LFOParams): number {
  if (p.syncDiv && p.bpm) {
    const beatsPerSec = p.bpm / 60;
    const divMap: Record<string, number> = {
      "1/16": 1 / 4, "1/8": 1 / 2, "1/4": 1, "1/2": 2, "1": 4, "2": 8,
    };
    const cyclesPerBeat = divMap[p.syncDiv] ?? 1;
    return beatsPerSec * cyclesPerBeat;
  }
  return clamp(p.rate, 0.01, 20);
}

// ── OscillatorNode-based LFO ─────────────────────────────────────────────────

export interface LFONode {
  osc: OscillatorNode;
  gain: GainNode;
  output: AudioParam;   // gain.gain — connect to target AudioParam
  setRate: (hz: number) => void;
  setDepth: (depth: number) => void;
}

/**
 * Create an oscillator-based LFO. The output (gain.gain) swings between
 * -depth and +depth. Connect it to any AudioParam (e.g. filter.frequency,
 * oscillator.detune, gain.gain).
 *
 * For square/saw/triangle, OscillatorNode natively supports these types.
 * For sample&hold, use the sampledLFO() function instead.
 */
export function createLFO(ctx: BaseAudioContext, p: LFOParams): LFONode {
  const rate = lfoRateHz(p);
  const osc = ctx.createOscillator();
  const typeMap: Record<LFOWaveform, OscillatorType> = {
    sine: "sine",
    triangle: "triangle",
    saw: "sawtooth",
    square: "square",
    samplehold: "square", // placeholder — S&H should use sampledLFO
  };
  osc.type = typeMap[p.waveform] ?? "sine";
  osc.frequency.value = rate;
  // Note: OscillatorNode has no phase parameter. detune shifts pitch in
  // cents (1200/octave), NOT phase. Setting detune = phase * 360 would detune
  // by up to 3.6 semitones — a pitch shift, not a phase offset. For
  // phase-offset LFO values, use computeLFO(waveform, phase) on the control
  // thread. The oscillator always starts at phase 0.

  const gain = ctx.createGain();
  gain.gain.value = clamp(p.depth, 0, 1);

  osc.connect(gain);

  return {
    osc,
    gain,
    output: gain.gain,
    setRate: (hz: number) => { osc.frequency.value = clamp(hz, 0.01, 20); },
    setDepth: (d: number) => { gain.gain.value = clamp(d, 0, 1); },
  };
}

// ── Sample & Hold LFO (beat-synced random) ───────────────────────────────────

/**
 * Beat-synced sample-and-hold: produces a new random value (−1..+1) at each
 * beat boundary, held until the next beat. Seeded for deterministic playback.
 * @param seed    pattern seed (for reproducibility)
 * @param beat    current beat number (integer)
 * @param rng     optional pre-seeded RNG (created lazily if omitted)
 */
export function sampledLFO(
  seed: number, beat: number, rng?: Rng,
): { value: number; rng: Rng } {
  const r = rng ?? mulberry32(hashSeed(seed, beat));
  return { value: r() * 2 - 1, rng: r };
}