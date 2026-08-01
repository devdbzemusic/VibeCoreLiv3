// VibeCore DSP Core — Reverb Processors.
//
// Algorithmic reverb via ConvolverNode with procedurally-generated impulse
// responses. Four reverb types (Hall, Room, Plate, Algorithmic) are created
// by generating different impulse response shapes.
//
// Realtime-safe: IR generation is O(N) on the control thread (graph
// construction). ConvolverNode processing is on the UA audio thread
// (FFT-based convolution, SIMD-optimised). IRs are cached per type+duration.

import { clamp } from "./math";

export type ReverbType = "hall" | "room" | "plate" | "algorithmic";

export interface ReverbParams {
  type: ReverbType;
  /** Reverb decay time in seconds (0.1..10). */
  decay: number;
  /** Pre-delay in seconds (0..0.5). */
  preDelay?: number;
  /** Wet/dry mix (0..1, default 0.3). */
  mix?: number;
  /** Damping factor (0..1, higher = darker). */
  damping?: number;
}

export interface ReverbNode {
  input: GainNode;
  output: GainNode;
  convolver: ConvolverNode;
  wet: GainNode;
  dry: GainNode;
}

// ── Impulse response generation ──────────────────────────────────────────────

// IR cache — keyed by `${type}:${duration}:${sr}:${damping}`
const _irCache = new Map<string, AudioBuffer>();

/**
 * Generate a stereo impulse response for the given reverb type.
 * All types use an exponentially-decaying noise burst; the difference is
 * in the decay curve, early reflections, and damping.
 */
function generateIR(
  ctx: BaseAudioContext, type: ReverbType, durationSec: number, damping: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(durationSec * sr));
  const ir = ctx.createBuffer(2, len, sr);
  const l = ir.getChannelData(0);
  const r = ir.getChannelData(1);

  const damp = clamp(damping, 0, 0.95);
  const highShelf = 1 - damp * 0.8; // damping attenuates highs in the tail

  switch (type) {
    case "hall": {
      // Long, smooth exponential decay with subtle early reflections
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-2.5 * t);
        // Early reflection pattern (first 80ms — discrete echoes)
        const er = i < sr * 0.08
          ? (Math.exp(-30 * t) * (i % 97 === 0 ? 0.5 : 0))
          : 0;
        l[i] = (Math.random() * 2 - 1) * env * highShelf + er;
        r[i] = (Math.random() * 2 - 1) * env * highShelf + er * 0.8;
      }
      break;
    }
    case "room": {
      // Short, dense decay — small room ambience
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-6 * t);
        l[i] = (Math.random() * 2 - 1) * env * highShelf;
        r[i] = (Math.random() * 2 - 1) * env * highShelf;
      }
      break;
    }
    case "plate": {
      // Bright, dense, metallic — plate reverbs have a bright, even decay
      const bright = 1 - damp * 0.5;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-4 * t);
        l[i] = (Math.random() * 2 - 1) * env * bright;
        r[i] = (Math.random() * 2 - 1) * env * bright;
      }
      break;
    }
    case "algorithmic": {
      // Smooth, modulated decay — general-purpose
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-3.5 * t);
        // LFO-modulated decay for shimmer
        const mod = 1 + 0.15 * Math.sin(t * 8);
        l[i] = (Math.random() * 2 - 1) * env * highShelf * mod;
        r[i] = (Math.random() * 2 - 1) * env * highShelf * (2 - mod);
      }
      break;
    }
  }

  // Normalize to avoid clipping
  let peak = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(l[i]) > peak) peak = Math.abs(l[i]);
    if (Math.abs(r[i]) > peak) peak = Math.abs(r[i]);
  }
  if (peak > 0) {
    const norm = 0.9 / peak;
    for (let i = 0; i < len; i++) { l[i] *= norm; r[i] *= norm; }
  }

  return ir;
}

function getCachedIR(
  ctx: BaseAudioContext, type: ReverbType, durationSec: number, damping: number,
): AudioBuffer {
  const key = `${type}:${durationSec.toFixed(2)}:${ctx.sampleRate}:${damping.toFixed(2)}`;
  const cached = _irCache.get(key);
  if (cached) return cached;
  const ir = generateIR(ctx, type, durationSec, damping);
  _irCache.set(key, ir);
  return ir;
}

// ── Reverb factory ───────────────────────────────────────────────────────────

/** Create a reverb with the given type and parameters. */
export function createReverb(
  ctx: BaseAudioContext, p: ReverbParams,
): ReverbNode {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const convolver = ctx.createConvolver();
  const preDelay = ctx.createDelay(0.5);

  const mix = clamp(p.mix ?? 0.3, 0, 1);
  const decay = clamp(p.decay, 0.1, 10);
  const damping = clamp(p.damping ?? 0.3, 0, 0.95);

  convolver.buffer = getCachedIR(ctx, p.type, decay, damping);
  preDelay.delayTime.value = clamp(p.preDelay ?? 0, 0, 0.5);
  wet.gain.value = mix;
  dry.gain.value = 1 - mix;

  // Dry path
  input.connect(dry);
  dry.connect(output);
  // Wet path: pre-delay → convolver → wet
  input.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(wet);
  wet.connect(output);

  return { input, output, convolver, wet, dry };
}

// ── Convenience factories ────────────────────────────────────────────────────

export function createHallReverb(ctx: BaseAudioContext, decay: number, mix?: number): ReverbNode {
  return createReverb(ctx, { type: "hall", decay, mix, damping: 0.35 });
}

export function createRoomReverb(ctx: BaseAudioContext, decay: number, mix?: number): ReverbNode {
  return createReverb(ctx, { type: "room", decay, mix, damping: 0.4 });
}

export function createPlateReverb(ctx: BaseAudioContext, decay: number, mix?: number): ReverbNode {
  return createReverb(ctx, { type: "plate", decay, mix, damping: 0.2 });
}

export function createAlgorithmicReverb(ctx: BaseAudioContext, decay: number, mix?: number): ReverbNode {
  return createReverb(ctx, { type: "algorithmic", decay, mix, damping: 0.3 });
}