// VibeCore DSP Core — Spatial Processing.
//
// Stereo width, Mid/Side processing, equal-power panning, binaural basics,
// and 3D positioning utilities. All spatial transforms use Web Audio's native
// ChannelSplitter / ChannelMerger / StereoPanner nodes where possible.
//
// Realtime-safe: factories run on the control thread. AudioParam automation
// for live spatial movement is driven by the UA's audio thread.

import { clamp, equalPowerPan } from "./math";

// ── Stereo width (narrow ↔ widen) ────────────────────────────────────────────

export interface StereoWidthNode {
  input: GainNode;
  output: GainNode;
  mid: GainNode;
  side: GainNode;
  widthGain: GainNode;
}

/**
 * Create a stereo width controller using Mid/Side decomposition.
 * @param width  0..2 (0 = mono, 1 = original, 2 = double-wide)
 */
export function createStereoWidth(
  ctx: BaseAudioContext, width: number,
): StereoWidthNode {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Mid = (L + R) / 2, Side = (L - R) / 2
  const midL = ctx.createGain();   // L → mid
  const midR = ctx.createGain();   // R → mid
  midL.gain.value = 0.5;
  midR.gain.value = 0.5;
  const sideL = ctx.createGain();  // L → side
  const sideR = ctx.createGain();  // R → side (inverted)
  sideL.gain.value = 0.5;
  sideR.gain.value = -0.5;

  const mid = ctx.createGain();
  const side = ctx.createGain();
  const widthGain = ctx.createGain();
  widthGain.gain.value = clamp(width, 0, 2);

  // Reconstruct: L = mid + side * width, R = mid - side * width
  const reconAddL = ctx.createGain();  // +side
  const reconSubR = ctx.createGain();  // -side
  reconAddL.gain.value = 1;
  reconSubR.gain.value = -1;

  input.connect(splitter);
  splitter.connect(midL, 0);
  splitter.connect(midR, 1);
  splitter.connect(sideL, 0);
  splitter.connect(sideR, 1);
  midL.connect(mid);
  midR.connect(mid);
  sideL.connect(side);
  sideR.connect(side);

  // L = mid + side * width
  mid.connect(merger, 0, 0);
  side.connect(widthGain);
  widthGain.connect(reconAddL);
  reconAddL.connect(merger, 0, 0);
  // R = mid - side * width
  mid.connect(merger, 0, 1);
  widthGain.connect(reconSubR);
  reconSubR.connect(merger, 0, 1);
  merger.connect(output);

  return { input, output, mid, side, widthGain };
}

// ── Mid/Side encoder/decoder ─────────────────────────────────────────────────

export type MSMode = "encode" | "decode";

/** Create a Mid/Side encoder or decoder.
 *  Encode: L/R → M/S (M = (L+R)/2 on left, S = (L-R)/2 on right).
 *  Decode: M/S → L/R (L = M+S on left, R = M-S on right).
 *
 *  Fix: the previous implementation only placed L/2 on the left output and
 *  -R/2 on the right — that is NOT M/S. Correct M/S requires summing both
 *  channels (with appropriate signs) into each output channel via the
 *  ChannelMergerNode's input mixing. */
export function createMidSide(
  ctx: BaseAudioContext, mode: MSMode,
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  if (mode === "encode") {
    // L/R → M/S: M = (L+R)/2, S = (L-R)/2
    // Need 4 gain paths: L→M, R→M, L→S, R→S(inverted)
    const gML = ctx.createGain(); gML.gain.value = 0.5;
    const gMR = ctx.createGain(); gMR.gain.value = 0.5;
    const gSL = ctx.createGain(); gSL.gain.value = 0.5;
    const gSR = ctx.createGain(); gSR.gain.value = -0.5;
    input.connect(splitter);
    splitter.connect(gML, 0); gML.connect(merger, 0, 0);  // L × 0.5 → M (left)
    splitter.connect(gMR, 1); gMR.connect(merger, 0, 0);  // R × 0.5 → M (left, summed)
    splitter.connect(gSL, 0); gSL.connect(merger, 0, 1);  // L × 0.5 → S (right)
    splitter.connect(gSR, 1); gSR.connect(merger, 0, 1);  // R × -0.5 → S (right, summed)
  } else {
    // M/S → L/R: L = M+S, R = M-S
    // M on channel 0, S on channel 1
    const gLL = ctx.createGain(); gLL.gain.value = 1;
    const gLR = ctx.createGain(); gLR.gain.value = 1;
    const gRL = ctx.createGain(); gRL.gain.value = 1;
    const gRR = ctx.createGain(); gRR.gain.value = -1;
    input.connect(splitter);
    splitter.connect(gLL, 0); gLL.connect(merger, 0, 0);  // M × 1 → L (left)
    splitter.connect(gLR, 1); gLR.connect(merger, 0, 0);  // S × 1 → L (left, summed)
    splitter.connect(gRL, 0); gRL.connect(merger, 0, 1);  // M × 1 → R (right)
    splitter.connect(gRR, 1); gRR.connect(merger, 0, 1);  // S × -1 → R (right, summed)
  }
  merger.connect(output);
  return { input, output };
}

// ── Binaural (HRTF-based) ─────────────────────────────────────────────────────

export interface BinauralParams {
  /** Azimuth angle in degrees (-90 = full left, 0 = front, +90 = full right). */
  azimuth: number;
  /** Elevation in degrees (-45 = below, 0 = horizontal, +45 = above). */
  elevation?: number;
  /** Distance factor (0..1, affects gain + reverb amount). */
  distance?: number;
}

/**
 * Create a basic binaural panner using StereoPanner + distance attenuation.
 * Full HRTF requires custom impulse responses; this provides a simplified
 * 3D positioning that works without external IR files.
 */
export function createBinaural(
  ctx: BaseAudioContext, p: BinauralParams,
): { input: GainNode; output: GainNode; panner: StereoPannerNode; distanceGain: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const distanceGain = ctx.createGain();

  // Map azimuth (-90..+90) to pan (-1..+1) with a sine-law curve
  const azNorm = clamp(p.azimuth, -90, 90) / 90;
  panner.pan.value = Math.sin(azNorm * Math.PI / 2);

  // Distance attenuation (inverse-square approximation)
  const dist = clamp(p.distance ?? 0.5, 0, 1);
  distanceGain.gain.value = 1 / (1 + dist * 3);

  input.connect(panner);
  panner.connect(distanceGain);
  distanceGain.connect(output);
  return { input, output, panner, distanceGain };
}

// ── 3D Positioning (PannerNode) ───────────────────────────────────────────────

export interface Spatial3DParams {
  x: number;      // -1..+1 (left..right)
  y: number;      // -1..+1 (front..back)
  z: number;      // -1..+1 (below..above)
  /** Panning model: "HRTF" (high quality) or "equalpower" (fast). */
  model?: PanningModelType;
}

/**
 * Create a 3D spatial panner using PannerNode.
 * Position is normalised to [-1, +1] in each axis and scaled to metres.
 */
export function createSpatial3D(
  ctx: BaseAudioContext, p: Spatial3DParams,
): { input: GainNode; panner: PannerNode } {
  const input = ctx.createGain();
  const panner = ctx.createPanner();
  panner.panningModel = p.model ?? "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 100;
  panner.rolloffFactor = 1;

  // Normalised position → metres (scale by 10)
  panner.positionX.value = clamp(p.x, -1, 1) * 10;
  panner.positionY.value = clamp(p.y, -1, 1) * 10;
  panner.positionZ.value = clamp(p.z, -1, 1) * 10;

  input.connect(panner);
  return { input, panner };
}

// ── Utility: equal-power crossfade ────────────────────────────────────────────

/** Compute crossfade gains for position `t` (0 = A, 1 = B). Returns [gainA, gainB]. */
export function crossFadeGains(t: number): [number, number] {
  const c = clamp(t, 0, 1);
  return [Math.cos(c * Math.PI / 2), Math.sin(c * Math.PI / 2)];
}

// ── Utility: equal-power pan (re-export for convenience) ──────────────────────

export { equalPowerPan };