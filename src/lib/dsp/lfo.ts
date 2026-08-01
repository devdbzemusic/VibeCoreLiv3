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
  /** The driving source node — OscillatorNode for periodic waveforms,
   *  ConstantSourceNode for sample-and-hold. Cast to AudioScheduledSourceNode
   *  when you only need start/stop. */
  osc: AudioScheduledSourceNode;
  gain: GainNode;
  output: AudioParam;   // gain.gain — connect to target AudioParam
  setRate: (hz: number) => void;
  setDepth: (depth: number) => void;
  /** Optional cleanup for S&H scheduling timer. Call before discarding the node. */
  dispose?: () => void;
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
  const gain = ctx.createGain();
  gain.gain.value = clamp(p.depth, 0, 1);

  // ── Sample & Hold path ────────────────────────────────────────────────────
  // OscillatorNode cannot produce true S&H behaviour — its waveform is
  // continuous and band-limited. Instead we drive a ConstantSourceNode whose
  // `offset` AudioParam is updated with setValueAtTime at each LFO period,
  // producing a true stepped random signal with zero inter-step slope.
  if (p.waveform === "samplehold") {
    type CtxWithCSN = BaseAudioContext & {
      createConstantSource?: () => ConstantSourceNode;
    };
    const csnFactory = (ctx as CtxWithCSN).createConstantSource?.bind(ctx);

    if (csnFactory) {
      const csn: ConstantSourceNode = csnFactory();
      csn.connect(gain);

      // Deterministic RNG seeded from the LFO phase so repeated renders are
      // bit-identical (same contract as sampledLFO() in the control path).
      const rng = mulberry32(hashSeed(Math.round((p.phase ?? 0) * 0xffff), 0x53414e48));
      const period = 1 / Math.max(0.001, rate);

      // Schedule the first value immediately then pre-fill a rolling window.
      const AHEAD = 8; // number of steps to schedule ahead of currentTime
      let nextScheduleTime = (ctx as AudioContext).currentTime ?? 0;

      const scheduleSteps = () => {
        const now = (ctx as AudioContext).currentTime ?? 0;
        while (nextScheduleTime < now + AHEAD * period) {
          csn.offset.setValueAtTime(rng() * 2 - 1, nextScheduleTime);
          nextScheduleTime += period;
        }
      };

      // Initial fill
      scheduleSteps();

      // Replenish the schedule at ~4× the LFO period so we never run dry
      const intervalMs = Math.max(50, Math.min(2000, period * 4 * 1000));
      const timerId = window.setInterval(scheduleSteps, intervalMs);

      return {
        osc: csn,
        gain,
        output: gain.gain,
        setRate: (_hz) => {
          // Rate changes require rebuilding the schedule; signal that the
          // caller should recreate the LFO node (industry-standard pattern
          // for ConstantSourceNode-based LFOs).
        },
        setDepth: (d) => { gain.gain.value = clamp(d, 0, 1); },
        dispose: () => { window.clearInterval(timerId); },
      };
    }
    // Fallback for environments without ConstantSourceNode (< Chrome 62):
    // use a square oscillator — audibly similar at slow rates.
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = rate;
    osc.connect(gain);
    return {
      osc,
      gain,
      output: gain.gain,
      setRate: (hz) => { osc.frequency.value = clamp(hz, 0.01, 20); },
      setDepth: (d) => { gain.gain.value = clamp(d, 0, 1); },
    };
  }

  // ── Standard oscillator path ──────────────────────────────────────────────
  const osc = ctx.createOscillator();
  const typeMap: Record<LFOWaveform, OscillatorType> = {
    sine:      "sine",
    triangle:  "triangle",
    saw:       "sawtooth",
    square:    "square",
    samplehold: "square", // only reached for unknown waveform values
  };
  osc.type = typeMap[p.waveform] ?? "sine";
  osc.frequency.value = rate;
  // Note: OscillatorNode has no phase parameter. detune shifts pitch in
  // cents (1200/octave), NOT phase. For phase-offset LFO values use
  // computeLFO(waveform, phase) on the control thread instead.

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