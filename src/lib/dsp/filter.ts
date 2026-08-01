// VibeCore DSP Core — Filter Factories.
//
// All filter types are created here with typed parameters. Web Audio's
// BiquadFilterNode covers LP, HP, BP, Notch, and Allpass; the Comb filter
// uses a FeedbackDelayNode; the Morph filter crossfades between two biquads.
//
// No module-scope state. All factories return the created node(s); the
// caller owns the lifecycle (connect, start, stop, disconnect).
//
// Realtime-safe: factories run on the control thread (graph construction).
// AudioParam automation is driven by the UA's native DSP (SIMD-optimised).

import { clamp } from "./math";

export type FilterType = "lp" | "hp" | "bp" | "notch" | "allpass" | "comb" | "morph";

export interface FilterParams {
  frequency: number;   // Hz (20..20000)
  q?: number;          // resonance (0.1..20, default 1)
  gain?: number;       // dB (for peaking/shelving, default 0)
}

// ── Biquad-based filters ─────────────────────────────────────────────────────

/** Create a lowpass filter. */
export function createLP(ctx: BaseAudioContext, p: FilterParams): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = clamp(p.frequency, 20, 20000);
  f.Q.value = Math.max(0.1, p.q ?? 1);
  return f;
}

/** Create a highpass filter. */
export function createHP(ctx: BaseAudioContext, p: FilterParams): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = clamp(p.frequency, 20, 20000);
  f.Q.value = Math.max(0.1, p.q ?? 1);
  return f;
}

/** Create a bandpass filter. */
export function createBP(ctx: BaseAudioContext, p: FilterParams): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = clamp(p.frequency, 20, 20000);
  f.Q.value = Math.max(0.1, p.q ?? 1);
  return f;
}

/** Create a notch (band-reject) filter. */
export function createNotch(ctx: BaseAudioContext, p: FilterParams): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "notch";
  f.frequency.value = clamp(p.frequency, 20, 20000);
  f.Q.value = Math.max(0.1, p.q ?? 1);
  return f;
}

// ── Comb filter (feedback delay) ─────────────────────────────────────────────

export interface CombParams {
  delaySec: number;   // 0.0001..0.5
  feedback: number;   // 0..0.99 (above 0.99 → unstable)
  mix?: number;        // 0..1 (dry/wet, default 0.5)
}

export interface CombNode {
  input: GainNode;
  output: GainNode;
  wet: GainNode;
  dry: GainNode;
  feedbackGain: GainNode;
}

/** Create a comb filter using a feedback delay line. */
export function createComb(ctx: BaseAudioContext, p: CombParams): CombNode {
  const input = ctx.createGain();
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = clamp(p.delaySec, 0.0001, 0.5);
  const fb = ctx.createGain();
  fb.gain.value = clamp(p.feedback, 0, 0.99);
  const wet = ctx.createGain();
  wet.gain.value = clamp(p.mix ?? 0.5, 0, 1);
  const dry = ctx.createGain();
  dry.gain.value = 1 - (p.mix ?? 0.5);
  const output = ctx.createGain();
  output.gain.value = 1;

  // Input → delay → feedback loop → wet → output
  // Input → dry → output
  // Fix: previously `input` was the delay node itself, so the dry path
  // was disconnected (no signal reached `dry`). Now `input` is a GainNode
  // that feeds both the delay and the dry path.
  input.connect(delay);
  input.connect(dry);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(output);
  dry.connect(output);

  return { input, output, wet, dry, feedbackGain: fb };
}

// ── Morph filter (crossfade between two biquad types) ────────────────────────

export type MorphPair = ["lp" | "hp" | "bp" | "notch", "lp" | "hp" | "bp" | "notch"];

export interface MorphFilterParams {
  freqA: number;
  freqB: number;
  qA?: number;
  qB?: number;
  morph: number;       // 0..1 (0 = filter A, 1 = filter B)
}

export interface MorphFilterNode {
  input: GainNode;
  output: GainNode;
  filterA: BiquadFilterNode;
  filterB: BiquadFilterNode;
  gainA: GainNode;
  gainB: GainNode;
}

const BIQUAD_TYPE_MAP: Record<string, BiquadFilterType> = {
  lp: "lowpass",
  hp: "highpass",
  bp: "bandpass",
  notch: "notch",
};

/** Create a morph filter that crossfades between two biquad filter types. */
export function createMorphFilter(
  ctx: BaseAudioContext, pair: MorphPair, p: MorphFilterParams,
): MorphFilterNode {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  const filterA = ctx.createBiquadFilter();
  filterA.type = BIQUAD_TYPE_MAP[pair[0]];
  filterA.frequency.value = clamp(p.freqA, 20, 20000);
  filterA.Q.value = Math.max(0.1, p.qA ?? 1);
  const filterB = ctx.createBiquadFilter();
  filterB.type = BIQUAD_TYPE_MAP[pair[1]];
  filterB.frequency.value = clamp(p.freqB, 20, 20000);
  filterB.Q.value = Math.max(0.1, p.qB ?? 1);

  const m = clamp(p.morph, 0, 1);
  gainA.gain.value = 1 - m;
  gainB.gain.value = m;

  input.connect(filterA);
  filterA.connect(gainA).connect(output);
  input.connect(filterB);
  filterB.connect(gainB).connect(output);

  return { input, output, filterA, filterB, gainA, gainB };
}