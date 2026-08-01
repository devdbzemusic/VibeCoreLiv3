// VibeCore Sample Forge — Audio Editor Module.
//
// Pure, deterministic editing operations on PCM. Every function returns a NEW
// buffer (non-destructive). Operations are sample-accurate and reproducible.
//
// Reuses the existing trimRegion / applyFade from sampleForge.ts and adds:
//   cut, copy, paste, delete, silence, merge, split, gain, crossfade,
//   reverseRegion, normalizePCM, stereoToMono, monoToStereo.
//
// No DSP duplication — all fundamental math goes through the existing
// sampleForge PCM helpers + DSP Core primitives.

import { clamp } from "@/lib/dsp";
import { trimRegion, applyFade } from "@/lib/audio/sampleForge";
import type { PCM } from "@/lib/audio/sampleForge";

function newPCM(channels: number, length: number, sampleRate: number): PCM {
  const ch: Float32Array[] = [];
  for (let i = 0; i < channels; i++) ch.push(new Float32Array(length));
  return { channels: ch, sampleRate };
}

function clampNorm(x: number): number { return Math.max(0, Math.min(1, x)); }

// ─── Copy / Cut / Paste / Delete ─────────────────────────────────────────────

/** Copy a region [startNorm, endNorm] as a standalone PCM (non-destructive). */
export function copyRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  return trimRegion(pcm, startNorm, endNorm);
}

/** Cut: remove [startNorm, endNorm] and return BOTH the cut piece and the
 *  remaining buffer with the region removed. Handles empty regions
 *  (startNorm === endNorm) without crashing — returns a 0-length cut and
 *  the full original as rest. */
export function cutRegion(pcm: PCM, startNorm: number, endNorm: number): { cut: PCM; rest: PCM } {
  const L = pcm.channels[0]?.length ?? 0;
  const s = Math.floor(clampNorm(startNorm) * L);
  const e = Math.floor(clampNorm(endNorm) * L);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const cutLen = Math.max(0, hi - lo);   // A-2 fix: allow 0-length (empty region)
  const restLen = L - cutLen;
  const cut = newPCM(pcm.channels.length, cutLen, pcm.sampleRate);
  const rest = newPCM(pcm.channels.length, restLen, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    if (cutLen > 0) cut.channels[c].set(src.subarray(lo, hi));
    if (lo > 0) rest.channels[c].set(src.subarray(0, lo), 0);
    if (hi < L) rest.channels[c].set(src.subarray(hi, L), lo);
  }
  return { cut, rest };
}

/** Delete a region [startNorm, endNorm] — returns buffer with region removed. */
export function deleteRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  return cutRegion(pcm, startNorm, endNorm).rest;
}

/** Paste a PCM into a target at a normalized position. Existing content
 *  after the insert point shifts right. */
export function pasteRegion(target: PCM, insertNorm: number, pasted: PCM): PCM {
  const L = target.channels[0]?.length ?? 0;
  const ins = Math.floor(clampNorm(insertNorm) * L);
  const pastedLen = pasted.channels[0]?.length ?? 0;
  const newLen = L + pastedLen;
  const out = newPCM(target.channels.length, Math.max(1, newLen), target.sampleRate);
  for (let c = 0; c < target.channels.length; c++) {
    const src = target.channels[c];
    // Copy pre-insert
    if (ins > 0) out.channels[c].set(src.subarray(0, ins), 0);
    // Copy pasted (channel-matched: use channel 0 if mono→stereo)
    const pastCh = pasted.channels[Math.min(c, pasted.channels.length - 1)];
    out.channels[c].set(pastCh, ins);
    // Copy post-insert
    if (ins < L) out.channels[c].set(src.subarray(ins, L), ins + pastedLen);
  }
  return out;
}

// ─── Silence ──────────────────────────────────────────────────────────────────

/** Insert silence of `durationSec` at `atNorm`. */
export function insertSilence(pcm: PCM, atNorm: number, durationSec: number): PCM {
  const silenceLen = Math.max(1, Math.floor(durationSec * pcm.sampleRate));
  const silence = newPCM(pcm.channels.length, silenceLen, pcm.sampleRate);
  return pasteRegion(pcm, atNorm, silence);
}

/** Replace region [startNorm, endNorm] with silence (overwrites in place). */
export function silenceRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const s = Math.floor(clampNorm(startNorm) * L);
  const e = Math.floor(clampNorm(endNorm) * L);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const out = newPCM(pcm.channels.length, L, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    out.channels[c].set(pcm.channels[c]);
    for (let i = lo; i < hi; i++) out.channels[c][i] = 0;
  }
  return out;
}

// ─── Merge / Split ────────────────────────────────────────────────────────────

/** Merge (concatenate) two PCMs end-to-end. Channel count = max of both. */
export function mergeBuffers(a: PCM, b: PCM): PCM {
  const channels = Math.max(a.channels.length, b.channels.length);
  const aLen = a.channels[0]?.length ?? 0;
  const bLen = b.channels[0]?.length ?? 0;
  const out = newPCM(channels, aLen + bLen, a.sampleRate);
  for (let c = 0; c < channels; c++) {
    const aCh = a.channels[Math.min(c, a.channels.length - 1)];
    const bCh = b.channels[Math.min(c, b.channels.length - 1)];
    if (aCh) out.channels[c].set(aCh, 0);
    if (bCh) out.channels[c].set(bCh, aLen);
  }
  return out;
}

/** Split a PCM at `posNorm` — returns [left, right]. */
export function splitAt(pcm: PCM, posNorm: number): [PCM, PCM] {
  const L = pcm.channels[0]?.length ?? 0;
  const pos = Math.floor(clampNorm(posNorm) * L);
  const left = newPCM(pcm.channels.length, Math.max(1, pos), pcm.sampleRate);
  const right = newPCM(pcm.channels.length, Math.max(1, L - pos), pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    if (pos > 0) left.channels[c].set(pcm.channels[c].subarray(0, pos));
    if (pos < L) right.channels[c].set(pcm.channels[c].subarray(pos, L));
  }
  return [left, right];
}

// ─── Gain / Normalize / Reverse ────────────────────────────────────────────────

/** Apply linear gain (0..8). 1.0 = unity. */
export function applyGain(pcm: PCM, gain: number): PCM {
  const g = Math.max(0, Math.min(8, gain));
  const out = newPCM(pcm.channels.length, pcm.channels[0]?.length ?? 1, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    for (let i = 0; i < src.length; i++) out.channels[c][i] = src[i] * g;
  }
  return out;
}

/** Apply gain in dB. 0 dB = unity. */
export function applyGainDb(pcm: PCM, db: number): PCM {
  return applyGain(pcm, Math.pow(10, db / 20));
}

/** Normalize to a target peak (default 0.99). Returns unchanged if silent. */
export function normalizePCM(pcm: PCM, targetPeak = 0.99): PCM {
  let peak = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak < 1e-6) return { channels: pcm.channels.map((c) => c.slice()), sampleRate: pcm.sampleRate };
  const g = targetPeak / peak;
  return applyGain(pcm, g);
}

/** Reverse the entire buffer (existing engine.reverseBuffer does this for
 *  AudioBuffer; this works on PCM). */
export function reversePCM(pcm: PCM): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const out = newPCM(pcm.channels.length, L, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    for (let i = 0; i < L; i++) out.channels[c][i] = src[L - 1 - i];
  }
  return out;
}

/** Reverse a region [startNorm, endNorm] only. */
export function reverseRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const s = Math.floor(clampNorm(startNorm) * L);
  const e = Math.floor(clampNorm(endNorm) * L);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const out = newPCM(pcm.channels.length, L, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    out.channels[c].set(pcm.channels[c]);
    let j = hi - 1;
    for (let i = lo; i < hi; i++) out.channels[c][i] = pcm.channels[c][j--];
  }
  return out;
}

// ─── Crossfade ────────────────────────────────────────────────────────────────

/** Crossfade two buffers: end of `a` fades out while start of `b` fades in.
 *  The crossfade length is `fadeNorm` (fraction of the shorter buffer).
 *  A-3 fix: clamps fadeLen to min(aLen, bLen) so very short buffers don't
 *  cause RangeError (negative length) or NaN writes (out-of-bounds index). */
export function crossfadeBuffers(a: PCM, b: PCM, fadeNorm = 0.05): PCM {
  const aLen = a.channels[0]?.length ?? 0;
  const bLen = b.channels[0]?.length ?? 0;
  if (aLen === 0) return { channels: b.channels.map((c) => c.slice()), sampleRate: b.sampleRate };
  if (bLen === 0) return { channels: a.channels.map((c) => c.slice()), sampleRate: a.sampleRate };
  const fadeLen = Math.min(
    Math.max(16, Math.floor(Math.min(aLen, bLen) * clamp(fadeNorm, 0.01, 0.5))),
    aLen, bLen,
  );
  const channels = Math.max(a.channels.length, b.channels.length);
  const out = newPCM(channels, aLen + bLen - fadeLen, a.sampleRate);
  for (let c = 0; c < channels; c++) {
    const aCh = a.channels[Math.min(c, a.channels.length - 1)];
    const bCh = b.channels[Math.min(c, b.channels.length - 1)];
    const dst = out.channels[c];
    // Copy a (pre-fade + fade-out region)
    for (let i = 0; i < aLen - fadeLen; i++) dst[i] = aCh[i];
    for (let i = 0; i < fadeLen; i++) {
      const outPos = aLen - fadeLen + i;
      const g = 1 - i / fadeLen;     // a fades out
      const gB = i / fadeLen;       // b fades in
      dst[outPos] = aCh[aLen - fadeLen + i] * g + bCh[i] * gB;
    }
    // Copy b (post-fade)
    for (let i = fadeLen; i < bLen; i++) dst[aLen - fadeLen + i] = bCh[i];
  }
  return out;
}

// ─── Channel Conversion ────────────────────────────────────────────────────────

/** Downmix to mono (average all channels). A-4 fix: guards 0-channel PCM. */
export function stereoToMono(pcm: PCM): PCM {
  if (pcm.channels.length === 0) return { channels: [new Float32Array(0)], sampleRate: pcm.sampleRate };
  if (pcm.channels.length === 1) return { channels: [pcm.channels[0].slice()], sampleRate: pcm.sampleRate };
  const L = pcm.channels[0].length;
  const mono = new Float32Array(L);
  const inv = 1 / pcm.channels.length;
  for (let i = 0; i < L; i++) {
    let sum = 0;
    for (const ch of pcm.channels) sum += ch[i];
    mono[i] = sum * inv;
  }
  return { channels: [mono], sampleRate: pcm.sampleRate };
}

/** Upmix mono to stereo (duplicate channel). A-5 fix: guards 0-channel PCM. */
export function monoToStereo(pcm: PCM): PCM {
  if (pcm.channels.length === 0) return { channels: [new Float32Array(0), new Float32Array(0)], sampleRate: pcm.sampleRate };
  if (pcm.channels.length >= 2) return { channels: pcm.channels.map((c) => c.slice()), sampleRate: pcm.sampleRate };
  return {
    channels: [pcm.channels[0].slice(), pcm.channels[0].slice()],
    sampleRate: pcm.sampleRate,
  };
}

// Re-export existing operations for the Sample Forge API surface.
export { trimRegion, applyFade };