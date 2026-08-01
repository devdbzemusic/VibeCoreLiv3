// Sample Forge Engine — Phase 4.
// Pure, deterministic offline DSP operations on AudioBuffers.
// Each op returns a NEW buffer (non-destructive); callers decide whether to
// reassign via `assignBufferToPart`.
//
// All math lives on `PCM` (channels[][]+sampleRate) so it is testable
// without an AudioContext. AudioBuffer in/out is just a thin shell.

import { getCtx } from "./engine";

// ─── PCM helpers ───────────────────────────────────────────────────────────

export interface PCM {
  channels: Float32Array[];
  sampleRate: number;
}

export function bufferToPCM(buf: AudioBuffer): PCM {
  const ch: Float32Array[] = [];
  for (let i = 0; i < buf.numberOfChannels; i++) ch.push(buf.getChannelData(i).slice());
  return { channels: ch, sampleRate: buf.sampleRate };
}

export function pcmToBuffer(pcm: PCM): AudioBuffer {
  const ctx = getCtx();
  if (!ctx) throw new Error("AudioContext not initialised");
  const len = pcm.channels[0]?.length ?? 0;
  const out = ctx.createBuffer(pcm.channels.length, Math.max(1, len), pcm.sampleRate);
  for (let i = 0; i < pcm.channels.length; i++) out.getChannelData(i).set(pcm.channels[i]);
  return out;
}

function newPCM(channelCount: number, length: number, sampleRate: number): PCM {
  const channels: Float32Array[] = [];
  for (let i = 0; i < channelCount; i++) channels.push(new Float32Array(length));
  return { channels, sampleRate };
}

function clampNorm(x: number) { return Math.max(0, Math.min(1, x)); }

// ─── 1. TRIM ───────────────────────────────────────────────────────────────

export function trimRegion(pcm: PCM, startNorm: number, endNorm: number): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const s = Math.floor(clampNorm(startNorm) * L);
  const e = Math.floor(clampNorm(endNorm) * L);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  const len = Math.max(1, hi - lo);
  const out = newPCM(pcm.channels.length, len, pcm.sampleRate);
  for (let i = 0; i < pcm.channels.length; i++) {
    out.channels[i].set(pcm.channels[i].subarray(lo, hi));
  }
  return out;
}

// ─── 2. FADE ───────────────────────────────────────────────────────────────

/** Apply linear fade-in / fade-out. Percent (0..100) of total length each. */
export function applyFade(pcm: PCM, fadeInPct: number, fadeOutPct: number): PCM {
  const L = pcm.channels[0]?.length ?? 0;
  const fi = Math.floor(Math.max(0, Math.min(100, fadeInPct)) * 0.01 * L);
  const fo = Math.floor(Math.max(0, Math.min(100, fadeOutPct)) * 0.01 * L);
  const out = newPCM(pcm.channels.length, L, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    const dst = out.channels[c];
    for (let i = 0; i < L; i++) {
      let g = 1;
      if (fi > 0 && i < fi) g *= i / fi;
      if (fo > 0 && i >= L - fo) g *= (L - 1 - i) / Math.max(1, fo - 1);
      dst[i] = src[i] * g;
    }
  }
  return out;
}

// ─── 3. GRANULAR SOLA — Pitch & Time Stretch ───────────────────────────────
//
// Single-pass overlap-add with Hann-windowed grains.
//   timeRatio  > 1 → longer output
//   pitchRatio > 1 → higher pitch (playback speed of each grain)
// Output length = round(inputLength * timeRatio).
//
// Strategy: walk output, at each output hop pick the corresponding input
// position (output_pos / timeRatio) and read a grain of length `grainLen`
// stepping at `pitchRatio` per output sample. Hann-window cross-fade keeps
// it click-free even for extreme ratios.

export function granularSOLA(pcm: PCM, timeRatio: number, pitchRatio: number): PCM {
  const sr = pcm.sampleRate;
  const inLen = pcm.channels[0]?.length ?? 0;
  if (inLen === 0) return newPCM(pcm.channels.length, 1, sr);

  const tRatio = Math.max(0.25, Math.min(8, timeRatio));
  const pRatio = Math.max(0.25, Math.min(8, pitchRatio));
  const outLen = Math.max(1, Math.round(inLen * tRatio));

  // Grain length ~ 50ms, hop = 1/4 grain → 75% overlap.
  const grainLen = Math.max(64, Math.floor(sr * 0.05));
  const hop = Math.max(16, Math.floor(grainLen / 4));

  // Hann window (precomputed).
  const win = new Float32Array(grainLen);
  for (let i = 0; i < grainLen; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grainLen - 1));

  // Constant overlap-add normaliser: sum of overlapping Hanns at 75% overlap = ~1.5.
  const olaNorm = 1.5;

  const out = newPCM(pcm.channels.length, outLen, sr);

  for (let outPos = 0; outPos < outLen; outPos += hop) {
    // Input grain start = where in input this output time maps to.
    const inStart = outPos / tRatio;
    for (let c = 0; c < pcm.channels.length; c++) {
      const src = pcm.channels[c];
      const dst = out.channels[c];
      for (let i = 0; i < grainLen; i++) {
        const o = outPos + i;
        if (o >= outLen) break;
        // Linear-interp read at inStart + i*pRatio.
        const r = inStart + i * pRatio;
        if (r < 0 || r >= inLen - 1) continue;
        const ri = r | 0;
        const rf = r - ri;
        const s = src[ri] * (1 - rf) + src[ri + 1] * rf;
        dst[o] += s * win[i] / olaNorm;
      }
    }
  }
  return out;
}

export function pitchShiftBuffer(pcm: PCM, semitones: number): PCM {
  const r = Math.pow(2, semitones / 12);
  return granularSOLA(pcm, 1, r);
}

export function timeStretchBuffer(pcm: PCM, ratio: number): PCM {
  return granularSOLA(pcm, ratio, 1);
}

// ─── 4. SPECTRAL FREEZE ────────────────────────────────────────────────────
//
// Take a window at `posNorm`, compute magnitude spectrum, generate a steady
// loopable texture by randomising phases per frame and overlap-adding into
// a buffer of `durationSec`. Pure DFT over N=1024 — small but fully working.
// Used for "infinite freeze" textures from any sample point.

const FFT_N = 1024;

function dft(real: Float32Array, imag: Float32Array): void {
  const N = real.length;
  const outR = new Float32Array(N);
  const outI = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let sr = 0, si = 0;
    const w = -2 * Math.PI * k / N;
    for (let n = 0; n < N; n++) {
      const c = Math.cos(w * n);
      const s = Math.sin(w * n);
      sr += real[n] * c - imag[n] * s;
      si += real[n] * s + imag[n] * c;
    }
    outR[k] = sr; outI[k] = si;
  }
  real.set(outR); imag.set(outI);
}

function idft(real: Float32Array, imag: Float32Array): void {
  const N = real.length;
  const outR = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let s = 0;
    const w = 2 * Math.PI * n / N;
    for (let k = 0; k < N; k++) s += real[k] * Math.cos(w * k) - imag[k] * Math.sin(w * k);
    outR[n] = s / N;
  }
  real.set(outR);
  imag.fill(0);
}

export function spectralFreezeBuffer(pcm: PCM, posNorm: number, durationSec: number): PCM {
  const sr = pcm.sampleRate;
  const inLen = pcm.channels[0]?.length ?? 0;
  if (inLen < FFT_N) {
    // Fallback: just loop the existing material.
    return granularSOLA(pcm, Math.max(1, (durationSec * sr) / Math.max(1, inLen)), 1);
  }
  const center = Math.floor(clampNorm(posNorm) * (inLen - FFT_N));
  const outLen = Math.max(FFT_N, Math.floor(durationSec * sr));
  const out = newPCM(pcm.channels.length, outLen, sr);

  // Hann window.
  const win = new Float32Array(FFT_N);
  for (let i = 0; i < FFT_N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));
  const hop = FFT_N / 4;

  for (let c = 0; c < pcm.channels.length; c++) {
    const src = pcm.channels[c];
    // Magnitude spectrum of the snapshot.
    const real = new Float32Array(FFT_N);
    const imag = new Float32Array(FFT_N);
    for (let i = 0; i < FFT_N; i++) real[i] = src[center + i] * win[i];
    dft(real, imag);
    const mag = new Float32Array(FFT_N);
    for (let k = 0; k < FFT_N; k++) mag[k] = Math.hypot(real[k], imag[k]);

    // Overlap-add with random phases per frame.
    let seed = 0xc0ffee + c * 17;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const fr = new Float32Array(FFT_N);
    const fi = new Float32Array(FFT_N);
    for (let off = 0; off + FFT_N <= outLen; off += hop) {
      // Symmetric random phases (real signal).
      fr[0] = mag[0]; fi[0] = 0;
      for (let k = 1; k < FFT_N / 2; k++) {
        const ph = rnd() * 2 * Math.PI;
        fr[k] = mag[k] * Math.cos(ph);
        fi[k] = mag[k] * Math.sin(ph);
        fr[FFT_N - k] = fr[k];
        fi[FFT_N - k] = -fi[k];
      }
      fr[FFT_N / 2] = mag[FFT_N / 2]; fi[FFT_N / 2] = 0;
      idft(fr, fi);
      for (let i = 0; i < FFT_N; i++) out.channels[c][off + i] += fr[i] * win[i] * 0.5;
    }
  }
  return out;
}

// ─── 5. TRANSIENT DETECTION + AUTO-CHOP ────────────────────────────────────
//
// Energy-flux onset detector: short-term RMS, compare to running mean,
// peak-pick above adaptive threshold. Returns slice positions in [0..1].

export function detectTransients(pcm: PCM, sensitivity = 0.5): number[] {
  const sr = pcm.sampleRate;
  const ch = pcm.channels[0];
  if (!ch || ch.length === 0) return [];
  const winSamp = Math.max(128, Math.floor(sr * 0.01)); // 10ms
  const hop = Math.max(32, Math.floor(winSamp / 2));
  const frames: number[] = [];
  for (let i = 0; i + winSamp < ch.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < winSamp; j++) { const v = ch[i + j]; sum += v * v; }
    frames.push(Math.sqrt(sum / winSamp));
  }
  // Flux = max(0, frame[n] - frame[n-1]).
  const flux = new Float32Array(frames.length);
  for (let i = 1; i < frames.length; i++) flux[i] = Math.max(0, frames[i] - frames[i - 1]);
  // Adaptive threshold = mean + k*stddev, k from sensitivity (0..1 → 2.5..0.5).
  let m = 0; for (const v of flux) m += v; m /= Math.max(1, flux.length);
  let s = 0; for (const v of flux) s += (v - m) ** 2; s = Math.sqrt(s / Math.max(1, flux.length));
  const k = 2.5 - Math.max(0, Math.min(1, sensitivity)) * 2.0; // 0→2.5, 1→0.5
  const thr = m + k * s;
  // Peak-pick with min spacing ~30ms.
  const minSpaceFrames = Math.max(1, Math.floor((0.03 * sr) / hop));
  const positions: number[] = [];
  let lastPick = -minSpaceFrames * 2;
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      if (i - lastPick >= minSpaceFrames) {
        positions.push((i * hop) / ch.length);
        lastPick = i;
      }
    }
  }
  return positions;
}

/** Produce auto-chop slice markers (0..1), capped to `maxSlices`. Always
 *  prepends 0 and ends below 1. */
export function autoChop(pcm: PCM, sensitivity = 0.5, maxSlices = 16): number[] {
  const ts = detectTransients(pcm, sensitivity);
  const out = [0, ...ts].filter((v) => v < 0.999);
  // Drop near-duplicates.
  const cleaned: number[] = [];
  for (const p of out) {
    if (!cleaned.length || p - cleaned[cleaned.length - 1] > 0.01) cleaned.push(p);
  }
  return cleaned.slice(0, maxSlices);
}

// ─── 6. AudioBuffer convenience wrappers ───────────────────────────────────

export function trimBufferRegion(buf: AudioBuffer, startNorm: number, endNorm: number): AudioBuffer {
  return pcmToBuffer(trimRegion(bufferToPCM(buf), startNorm, endNorm));
}
export function applyFadeBuffer(buf: AudioBuffer, fadeInPct: number, fadeOutPct: number): AudioBuffer {
  return pcmToBuffer(applyFade(bufferToPCM(buf), fadeInPct, fadeOutPct));
}
export function pitchShiftAudioBuffer(buf: AudioBuffer, semitones: number): AudioBuffer {
  return pcmToBuffer(pitchShiftBuffer(bufferToPCM(buf), semitones));
}
export function timeStretchAudioBuffer(buf: AudioBuffer, ratio: number): AudioBuffer {
  return pcmToBuffer(timeStretchBuffer(bufferToPCM(buf), ratio));
}
export function spectralFreezeAudioBuffer(buf: AudioBuffer, posNorm: number, durationSec: number): AudioBuffer {
  return pcmToBuffer(spectralFreezeBuffer(bufferToPCM(buf), posNorm, durationSec));
}
export function autoChopBuffer(buf: AudioBuffer, sensitivity = 0.5, maxSlices = 16): number[] {
  return autoChop(bufferToPCM(buf), sensitivity, maxSlices);
}
