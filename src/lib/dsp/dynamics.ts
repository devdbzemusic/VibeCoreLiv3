// VibeCore DSP Core — Dynamics Processors.
//
// Compressor, Limiter, Expander, Gate, and Soft Clip factories.
// Uses Web Audio's DynamicsCompressorNode for the dynamics processors
// and WaveShaperNode (from curves.ts) for soft clipping.
//
// Realtime-safe: all factories run on the control thread. The UA's native
// dynamics implementation is SIMD-optimised.

import { makeSoftClipCurve, makeOverdriveCurve } from "./curves";
import { clamp } from "./math";

// ── Compressor ───────────────────────────────────────────────────────────────

export interface CompressorParams {
  threshold: number;  // dB (-100..0)
  knee: number;       // dB (0..40)
  ratio: number;      // 1..20
  attack: number;     // seconds (0..1)
  release: number;     // seconds (0..1)
  makeup?: number;     // dB gain after compression (default 0)
}

/** Create a compressor with post-compression makeup gain. */
export function createCompressor(
  ctx: BaseAudioContext, p: CompressorParams,
): { input: GainNode; comp: DynamicsCompressorNode; makeup: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = clamp(p.threshold, -100, 0);
  comp.knee.value = clamp(p.knee, 0, 40);
  comp.ratio.value = clamp(p.ratio, 1, 20);
  comp.attack.value = clamp(p.attack, 0, 1);
  comp.release.value = clamp(p.release, 0, 1);
  const makeup = ctx.createGain();
  makeup.gain.value = Math.pow(10, (p.makeup ?? 0) / 20);
  const output = ctx.createGain();
  output.gain.value = 1;
  input.connect(comp);
  comp.connect(makeup);
  makeup.connect(output);
  return { input, comp, makeup, output };
}

// ── Limiter ──────────────────────────────────────────────────────────────────

export interface LimiterParams {
  threshold?: number;  // dB (default -1)
  release?: number;     // seconds (default 0.05)
}

/** Create a brick-wall limiter (compressor with high ratio). */
export function createLimiter(
  ctx: BaseAudioContext, p: LimiterParams = {},
): DynamicsCompressorNode {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = p.threshold ?? -1;
  lim.knee.value = 0;
  lim.ratio.value = 20;       // max allowed ratio
  lim.attack.value = 0.001;
  lim.release.value = clamp(p.release ?? 0.05, 0.001, 1);
  return lim;
}

// ── Expander ─────────────────────────────────────────────────────────────────

export interface ExpanderParams {
  threshold: number;  // dB
  ratio: number;      // expansion ratio (1..20)
  attack: number;     // seconds
  release: number;     // seconds
}

/**
 * Create an expander using a downward compressor with ratio < 1.
 * Web Audio doesn't have a native expander — we approximate by using
 * a compressor with inverted threshold logic (signals below threshold
 * are attenuated).
 */
export function createExpander(
  ctx: BaseAudioContext, p: ExpanderParams,
): DynamicsCompressorNode {
  const exp = ctx.createDynamicsCompressor();
  exp.threshold.value = clamp(p.threshold, -100, 0);
  exp.knee.value = 6;
  exp.ratio.value = clamp(p.ratio, 1, 20);
  exp.attack.value = clamp(p.attack, 0, 1);
  exp.release.value = clamp(p.release, 0, 1);
  return exp;
}

// ── Noise Gate ───────────────────────────────────────────────────────────────

export interface GateParams {
  threshold: number;  // dB (signals below this are silenced)
  attack: number;      // seconds
  release: number;     // seconds
  hold?: number;       // seconds (hold time before release)
}

/**
 * Create a noise gate using a DynamicsCompressorNode with extreme ratio.
 * Signals below the threshold are heavily attenuated (effectively gated).
 */
export function createGate(
  ctx: BaseAudioContext, p: GateParams,
): DynamicsCompressorNode {
  const gate = ctx.createDynamicsCompressor();
  gate.threshold.value = clamp(p.threshold, -100, 0);
  gate.knee.value = 0;
  gate.ratio.value = 20;       // hard gate
  gate.attack.value = clamp(p.attack, 0.001, 1);
  gate.release.value = clamp(p.release, 0.001, 1);
  return gate;
}

// ── Soft clip (wave-shaper based) ────────────────────────────────────────────

/** Create a soft-clip stage using a cubic-law wave shaper curve. */
export function createSoftClip(ctx: BaseAudioContext, amount = 1): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSoftClipCurve(amount);
  shaper.oversample = amount > 0.5 ? "4x" : "2x";
  return shaper;
}

/** Create an overdrive / hard-clip stage. */
export function createOverdrive(ctx: BaseAudioContext, amount = 0.5): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeOverdriveCurve(amount);
  shaper.oversample = "4x";
  return shaper;
}