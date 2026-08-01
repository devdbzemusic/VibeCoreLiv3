// VibeCore DSP Core — Distortion & Saturation.
//
// All non-linear waveshaping processors. Each uses a WaveShaperNode with
// curves generated from curves.ts. The factories handle oversample settings
// and optional pre/post gain staging.
//
// Realtime-safe: curve generation is control-thread only. WaveShaperNode
// processing runs on the UA's audio thread (SIMD-optimised for the common
// curve sizes).

import {
  makeTanhCurve, makeTubeCurve, makeTapeCurve, makeFoldbackCurve,
  makeDriveCurve, makeBitcrushCurve,
} from "./curves";
import { clamp, dbToLin } from "./math";

export type DistortionType =
  | "saturation" | "tube" | "tape" | "foldback" | "drive" | "bitcrush";

export interface DistortionParams {
  type: DistortionType;
  amount: number;     // 0..1+ (type-specific scaling)
  /** Pre-gain in dB (drives the shaper harder). Default 0. */
  preGain?: number;
  /** Post-gain in dB (compensates level after distortion). Default 0. */
  postGain?: number;
  /** Oversample: "none" | "2x" | "4x" (default "2x"). */
  oversample?: OverSampleType;
  /** For foldback: threshold (0..1). For bitcrush: bits (1..16). */
  threshold?: number;
}

export interface DistortionNode {
  input: GainNode;
  shaper: WaveShaperNode;
  output: GainNode;
}

function getCurve(p: DistortionParams): Float32Array {
  switch (p.type) {
    case "saturation": return makeTanhCurve(p.amount);
    case "tube":      return makeTubeCurve(p.amount);
    case "tape":     return makeTapeCurve(p.amount);
    case "foldback":  return makeFoldbackCurve(p.threshold ?? 0.5);
    case "drive":     return makeDriveCurve(p.amount * 100);
    case "bitcrush":  return makeBitcrushCurve(Math.round(p.threshold ?? 4));
    default:          return makeTanhCurve(p.amount);
  }
}

/**
 * Create a distortion stage with pre-gain → wave shaper → post-gain.
 * The pre-gain drives the shaper harder; the post-gain compensates the
 * output level after clipping.
 */
export function createDistortion(
  ctx: BaseAudioContext, p: DistortionParams,
): DistortionNode {
  const input = ctx.createGain();
  input.gain.value = dbToLin(p.preGain ?? 0);
  const shaper = ctx.createWaveShaper();
  shaper.curve = getCurve(p);
  shaper.oversample = p.oversample ?? "2x";
  const output = ctx.createGain();
  output.gain.value = dbToLin(p.postGain ?? 0);
  input.connect(shaper);
  shaper.connect(output);
  return { input, shaper, output };
}

// ── Convenience factories ────────────────────────────────────────────────────

/** Saturation — gentle tanh soft-clip. */
export function createSaturation(ctx: BaseAudioContext, amount: number): DistortionNode {
  return createDistortion(ctx, { type: "saturation", amount: clamp(amount, 0, 3) });
}

/** Tube — asymmetric 2nd-harmonic distortion. */
export function createTube(ctx: BaseAudioContext, amount: number): DistortionNode {
  return createDistortion(ctx, { type: "tube", amount: clamp(amount, 0, 3) });
}

/** Tape — magnetic tape saturation model. */
export function createTape(ctx: BaseAudioContext, amount: number): DistortionNode {
  return createDistortion(ctx, { type: "tape", amount: clamp(amount, 0, 2) });
}

/** Foldback — buzzy harmonic-rich clipping. */
export function createFoldback(ctx: BaseAudioContext, threshold: number): DistortionNode {
  return createDistortion(ctx, {
    type: "foldback", amount: 1,
    threshold: clamp(threshold, 0.05, 1),
  });
}

/** Drive — general-purpose overdrive (matches the engine's per-part drive). */
export function createDrive(ctx: BaseAudioContext, amount: number): DistortionNode {
  return createDistortion(ctx, {
    type: "drive", amount: clamp(amount, 0, 1),
  });
}

/** Bitcrush — sample quantisation distortion. */
export function createBitcrush(ctx: BaseAudioContext, bits: number): DistortionNode {
  return createDistortion(ctx, {
    type: "bitcrush", amount: 1,
    threshold: clamp(bits, 1, 16),
    oversample: "none", // bitcrush shouldn't oversample
  });
}