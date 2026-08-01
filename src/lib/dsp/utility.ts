// VibeCore DSP Core — Utility DSP.
//
// DC blocker, gain smoothing, and other small DSP utilities that don't
// belong in a specific processor category.
//
// Realtime-safe: all functions are pure or use module-scope reusable state
// with in-place updates (no per-call allocation).

import { clamp } from "./math";

// ── DC blocker ───────────────────────────────────────────────────────────────

/**
 * Create a DC blocker — a one-pole high-pass filter at ~20 Hz.
 * Removes DC offset from signals that have non-zero mean (e.g. wave shapers
 * with asymmetrical curves, long feedback delays with non-zero feedback).
 */
export function createDCBlocker(ctx: BaseAudioContext): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 20;
  f.Q.value = 0.5;
  return f;
}

// ── Gain smoother ────────────────────────────────────────────────────────────

/**
 * Create a one-pole gain smoother for click-free parameter changes.
 * Wraps a GainNode and exposes a `smoothTo(value)` method that uses
 * setTargetAtTime with a configurable time-constant.
 */
export function createGainSmoother(
  ctx: BaseAudioContext, initialGain = 1, tau = 0.03,
): {
  node: GainNode;
  smoothTo: (value: number, when?: number) => void;
  snapTo: (value: number) => void;
} {
  const node = ctx.createGain();
  node.gain.value = initialGain;
  let _tau = tau;

  return {
    node,
    smoothTo: (value: number, when?: number) => {
      const t = when ?? ctx.currentTime;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.setTargetAtTime(clamp(value, 0, 1), t, _tau);
    },
    snapTo: (value: number) => {
      node.gain.value = clamp(value, 0, 1);
    },
  };
}

// ── Metering helper ───────────────────────────────────────────────────────────

/**
 * Compute RMS and peak from a Float32Array segment. O(n), allocation-free.
 * Returns { rms, peak } as linear values (0..1+).
 */
export function computeLevel(buf: Float32Array, len: number): { rms: number; peak: number } {
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const s = buf[i];
    sumSq += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  return { rms: Math.sqrt(sumSq / Math.max(1, len)), peak };
}

// ── Mono ↔ stereo conversion ─────────────────────────────────────────────────

/** Create a mono-to-stereo converter (duplicates the mono signal to both channels). */
export function createMonoToStereo(ctx: BaseAudioContext): {
  input: GainNode; output: GainNode; merger: ChannelMergerNode;
} {
  const input = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  const output = ctx.createGain();
  input.connect(merger, 0, 0);
  input.connect(merger, 0, 1);
  merger.connect(output);
  return { input, output, merger };
}

/** Create a stereo-to-mono converter (averages L and R). */
export function createStereoToMono(ctx: BaseAudioContext): {
  input: GainNode; output: GainNode; splitter: ChannelSplitterNode;
} {
  const input = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const gL = ctx.createGain();
  const gR = ctx.createGain();
  gL.gain.value = 0.5;
  gR.gain.value = 0.5;
  const output = ctx.createGain();
  input.connect(splitter);
  splitter.connect(gL, 0);
  splitter.connect(gR, 1);
  gL.connect(output);
  gR.connect(output);
  return { input, output, splitter };
}