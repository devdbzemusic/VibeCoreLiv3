// VibeCore DSP Core — Delay Processors.
//
// BPM-synced, stereo, ping-pong, and multitap delay factories.
// All delays use Web Audio's DelayNode (native, realtime-safe, SIMD-optimised).
//
// Realtime-safe: factories run on the control thread. DelayNode processing
// is on the UA audio thread. Feedback gain is clamped to < 1 to prevent
// runaway feedback.

import { clamp } from "./math";

// ── BPM → delay time ─────────────────────────────────────────────────────────

export type DelayDivision = "1/64" | "1/32" | "1/16" | "1/16." | "1/8" | "1/8." | "1/4" | "1/4." | "1/2" | "1" | "2";

const DIV_MAP: Record<DelayDivision, number> = {
  "1/64": 1 / 16,
  "1/32": 1 / 8,
  "1/16": 1 / 4,
  "1/16.": 3 / 8,
  "1/8": 1 / 2,
  "1/8.": 3 / 4,
  "1/4": 1,
  "1/4.": 3 / 2,
  "1/2": 2,
  "1": 4,
  "2": 8,
};

/** Convert BPM + division to delay time in seconds. */
export function bpmToDelaySec(bpm: number, div: DelayDivision): number {
  const beatsPerSec = bpm / 60;
  const quarterNotes = DIV_MAP[div] ?? 1;
  return quarterNotes / beatsPerSec;
}

// ── Basic delay ──────────────────────────────────────────────────────────────

export interface DelayParams {
  timeSec: number;     // 0.001..2
  feedback: number;    // 0..0.95
  mix?: number;         // 0..1 (wet/dry, default 0.3)
}

export interface DelayFXNode {
  input: GainNode;
  output: GainNode;
  wet: GainNode;
  dry: GainNode;
  delay: DelayNode;
  feedback: GainNode;
}

/** Create a basic feedback delay with wet/dry mix. */
export function createDelay(
  ctx: BaseAudioContext, p: DelayParams,
): DelayFXNode {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();

  const mix = clamp(p.mix ?? 0.3, 0, 1);
  delay.delayTime.value = clamp(p.timeSec, 0.001, 2);
  fb.gain.value = clamp(p.feedback, 0, 0.95);
  wet.gain.value = mix;
  dry.gain.value = 1 - mix;

  input.connect(dry);
  dry.connect(output);
  input.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(output);

  return { input, output, wet, dry, delay, feedback: fb };
}

// ── BPM-synced delay ────────────────────────────────────────────────────────

export interface BPMDelayParams {
  bpm: number;
  div: DelayDivision;
  feedback: number;
  mix?: number;
}

/** Create a BPM-synced delay. The delay time is derived from BPM + division. */
export function createBPMDelay(
  ctx: BaseAudioContext, p: BPMDelayParams,
): DelayFXNode {
  return createDelay(ctx, {
    timeSec: bpmToDelaySec(p.bpm, p.div),
    feedback: p.feedback,
    mix: p.mix,
  });
}

// ── Stereo delay (independent L/R times) ─────────────────────────────────────

export interface StereoDelayParams {
  timeL: number;
  timeR: number;
  feedbackL: number;
  feedbackR: number;
  mix?: number;
}

/** Create a stereo delay with independent left and right delay lines. */
export function createStereoDelay(
  ctx: BaseAudioContext, p: StereoDelayParams,
): { input: GainNode; output: GainNode; delayL: DelayNode; delayR: DelayNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const mix = clamp(p.mix ?? 0.3, 0, 1);

  const delayL = ctx.createDelay(2);
  const delayR = ctx.createDelay(2);
  const fbL = ctx.createGain();
  const fbR = ctx.createGain();
  const wetL = ctx.createGain();
  const wetR = ctx.createGain();
  const dryL = ctx.createGain();
  const dryR = ctx.createGain();

  delayL.delayTime.value = clamp(p.timeL, 0.001, 2);
  delayR.delayTime.value = clamp(p.timeR, 0.001, 2);
  fbL.gain.value = clamp(p.feedbackL, 0, 0.95);
  fbR.gain.value = clamp(p.feedbackR, 0, 0.95);
  wetL.gain.value = mix;
  wetR.gain.value = mix;
  dryL.gain.value = 1 - mix;
  dryR.gain.value = 1 - mix;

  input.connect(splitter);
  splitter.connect(dryL, 0);
  splitter.connect(dryR, 1);
  splitter.connect(delayL, 0);
  splitter.connect(delayR, 1);
  delayL.connect(fbL);
  fbL.connect(delayL);
  delayR.connect(fbR);
  fbR.connect(delayR);
  delayL.connect(wetL);
  delayR.connect(wetR);
  dryL.connect(merger, 0, 0);
  wetL.connect(merger, 0, 0);
  dryR.connect(merger, 0, 1);
  wetR.connect(merger, 0, 1);
  merger.connect(output);

  return { input, output, delayL, delayR };
}

// ── Ping-pong delay ──────────────────────────────────────────────────────────

/** Create a ping-pong delay — signal alternates between L and R channels. */
export function createPingPongDelay(
  ctx: BaseAudioContext, p: DelayParams,
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  const delayL = ctx.createDelay(2);
  const delayR = ctx.createDelay(2);
  const fbL = ctx.createGain();
  const fbR = ctx.createGain();
  const wetL = ctx.createGain();
  const wetR = ctx.createGain();

  const mix = clamp(p.mix ?? 0.3, 0, 1);
  delayL.delayTime.value = clamp(p.timeSec, 0.001, 2);
  delayR.delayTime.value = clamp(p.timeSec, 0.001, 2);
  fbL.gain.value = clamp(p.feedback, 0, 0.95);
  fbR.gain.value = clamp(p.feedback, 0, 0.95);
  wetL.gain.value = mix;
  wetR.gain.value = mix;

  // Ping-pong: L delay → R delay → L delay (cross feedback)
  input.connect(splitter);
  splitter.connect(delayL, 0);
  delayL.connect(fbR);
  fbR.connect(delayR);
  delayR.connect(fbL);
  fbL.connect(delayL);
  delayL.connect(wetL);
  delayR.connect(wetR);
  wetL.connect(merger, 0, 0);
  wetR.connect(merger, 0, 1);
  // Dry pass-through
  input.connect(output);
  merger.connect(output);

  return { input, output };
}

// ── Multitap delay ───────────────────────────────────────────────────────────

export interface TapParams {
  timeSec: number;     // 0.001..2
  gain: number;         // 0..1
  pan?: number;         // -1..+1 (default 0)
}

/** Create a multitap delay — multiple delay taps at different times/pans/gains. */
export function createMultitapDelay(
  ctx: BaseAudioContext, taps: TapParams[], mix = 0.4,
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  input.connect(dry);
  dry.connect(output);

  for (const tap of taps) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = clamp(tap.timeSec, 0.001, 2);
    const gain = ctx.createGain();
    gain.gain.value = clamp(tap.gain, 0, 1) * mix;
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(tap.pan ?? 0, -1, 1);

    input.connect(delay);
    delay.connect(gain);
    gain.connect(panner);
    panner.connect(output);
  }

  return { input, output };
}