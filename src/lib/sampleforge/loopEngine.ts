// VibeCore Sample Forge — Loop Engine.
//
// Loop mode definitions + boundary crossfade. The playback loop behavior
// (forward / reverse / ping-pong) is already handled by the Audio Engine's
// `triggerPart` one-shot path and the Wave model's `playMode` field.
//
// This module provides:
//   • Loop mode type (mirrors model.ts PlayMode)
//   • Loop crossfade — smooth the splice point for seamless looping
//   • Loop region extraction
//   • BPM-locked loop length calculation
//
// No DSP duplication — crossfade uses the same Hann-window approach as the
// existing applyFade + granularSOLA in sampleForge.ts.

import { clamp } from "@/lib/dsp";
import type { PCM } from "@/lib/audio/sampleForge";

export type LoopMode = "forward" | "reverse" | "pingpong" | "sustain" | "oneshot";

export interface LoopSettings {
  mode: LoopMode;
  startNorm: number;
  endNorm: number;
  crossfadeMs: number;
  bpmLock: boolean;
}

export function defaultLoopSettings(): LoopSettings {
  return { mode: "oneshot", startNorm: 0, endNorm: 1, crossfadeMs: 4, bpmLock: false };
}

// ─── Loop Crossfade ──────────────────────────────────────────────────────────

/** Apply a crossfade at the loop boundary to make the splice seamless.
 *  Takes the last `crossfadeMs` of the buffer, fades it out, and mixes it
 *  with a faded-in copy of the beginning. The result is a buffer that
 *  loops without a click at the splice point.
 *
 *  L-1 fix: uses a LINEAR ramp (0→1) instead of a full Hann window
 *  (which goes 0→1→0). The full Hann created a silence dip at both ends
 *  of the crossfade region — at i=0 and i=fadeLen-1, both tailGain and
 *  headGain were 0, producing audible silence at the splice point.
 *  Linear: tailGain goes 1→0, headGain goes 0→1, sum=1 at every point. */
export function applyLoopCrossfade(pcm: PCM, crossfadeMs = 4): PCM {
  const sr = pcm.sampleRate;
  const fadeLen = Math.max(16, Math.floor((crossfadeMs / 1000) * sr));
  const L = pcm.channels[0]?.length ?? 0;
  if (L < fadeLen * 2) return pcm; // too short to crossfade

  const out: Float32Array[] = [];
  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    const dst = src.slice();
    // Linear crossfade: tail fades 1→0, head fades 0→1 (constant power sum).
    for (let i = 0; i < fadeLen; i++) {
      const g = i / (fadeLen - 1);       // linear 0→1
      const tailIdx = L - fadeLen + i;
      const headIdx = i;
      dst[tailIdx] = src[tailIdx] * (1 - g) + src[headIdx] * g;
    }
    out.push(dst);
  }
  return { channels: out, sampleRate: sr };
}

// ─── Loop Region Extraction ───────────────────────────────────────────────────

/** Extract the loop region [startNorm, endNorm] from a PCM. */
export function extractLoopRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const s = Math.floor(clamp(startNorm, 0, 0.999) * L);
  const e = Math.floor(clamp(endNorm, 0.001, 1) * L);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const len = Math.max(1, hi - lo);
  const out: Float32Array[] = [];
  for (let c = 0; c < pcm.channels.length; c++) {
    out.push(pcm.channels[c].subarray(lo, hi).slice());
  }
  return { channels: out, sampleRate: pcm.sampleRate };
}

// ─── BPM-Locked Loop Length ────────────────────────────────────────────────────

/** Calculate the number of samples for N bars at a given BPM.
 *  barsAtBpm(bpm, bars, sr) → samples for `bars` bars at `bpm` BPM.
 *  1 bar = 4 beats (assuming 4/4). */
export function barsToSamples(bpm: number, bars: number, sampleRate: number): number {
  const beatSec = 60 / Math.max(1, bpm);
  const barSec = beatSec * 4;
  return Math.round(barSec * Math.max(0.0625, bars) * sampleRate);
}

/** Find the closest whole-bar loop length (in samples) to a target length.
 *  Useful for snapping a loop to BPM-locked boundaries. */
export function snapLoopToBars(
  targetSamples: number,
  bpm: number,
  sampleRate: number,
  maxBars = 32,
): { samples: number; bars: number } {
  let bestBars = 1;
  let bestDiff = Infinity;
  for (let bars = 1; bars <= maxBars; bars++) {
    const s = barsToSamples(bpm, bars, sampleRate);
    const diff = Math.abs(s - targetSamples);
    if (diff < bestDiff) { bestDiff = diff; bestBars = bars; }
  }
  return { samples: barsToSamples(bpm, bestBars, sampleRate), bars: bestBars };
}

// ─── Ping-Pong / Reverse Preparation ──────────────────────────────────────────

/** Prepare a ping-pong loop: forward + reverse concatenated with crossfade.
 *  The result is twice the length and plays forward then backward seamlessly. */
export function makePingPongLoop(pcm: PCM, crossfadeMs = 4): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const fwd = pcm.channels;
  // Reverse copy
  const rev: Float32Array[] = fwd.map((ch) => {
    const r = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) r[i] = ch[ch.length - 1 - i];
    return r;
  });
  // Concatenate fwd + rev
  const out: Float32Array[] = [];
  for (let c = 0; c < pcm.channels.length; c++) {
    const dst = new Float32Array(L * 2);
    dst.set(fwd[c], 0);
    dst.set(rev[c], L);
    out.push(dst);
  }
  return applyLoopCrossfade({ channels: out, sampleRate: pcm.sampleRate }, crossfadeMs);
}