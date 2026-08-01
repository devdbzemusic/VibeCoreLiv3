// VibeCore Sample Forge — Audio Analysis Module.
//
// Pure, deterministic analysis functions operating on PCM (Float32Array[]
// + sampleRate). No AudioContext required — all math runs on the control
// thread and is fully testable without audio hardware.
//
// Reuses VibeCore DSP Core math primitives (clamp, dbToLin, linToDb) and
// the Krumhansl-Schmuckler key-detection approach from groove/analysis.
// No DSP duplication — all fundamental algorithms go through DSP Core.

import { clamp, dbToLin, linToDb, denormalFlush } from "@/lib/dsp";

// Re-export the PCM interface from the existing sampleForge module so all
// Sample Forge sub-modules share one type.
export type { PCM } from "@/lib/audio/sampleForge";
import type { PCM } from "@/lib/audio/sampleForge";

// ─── Level / Loudness ──────────────────────────────────────────────────────

/** Peak amplitude across all channels (0..1). */
export function computePeak(pcm: PCM): number {
  let peak = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

/** RMS level across all channels (0..1). */
export function computeRMS(pcm: PCM): number {
  let sum = 0;
  let count = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) {
      sum += ch[i] * ch[i];
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/** Crest factor = peak / RMS (dynamic range indicator). Higher = more
 *  transient content (percussive), lower = more sustained ( pads, drones). */
export function computeCrest(pcm: PCM): number {
  const peak = computePeak(pcm);
  const rms = computeRMS(pcm);
  if (rms < 1e-8) return 0;
  return peak / rms;
}

/** ITU-R BS.1770-4 simplified loudness (LUFS approximation).
 *  Uses K-weighting approximation (high-pass + shelving) — not a full
 *  implementation but sufficient for relative loudness comparison. */
export function computeLoudness(pcm: PCM): number {
  if (pcm.channels.length === 0) return -70;
  const sr = pcm.sampleRate;
  // Simple high-pass for K-weighting stage 1 (approximate)
  const hpFreq = 38;
  const hpAlpha = Math.exp(-2 * Math.PI * hpFreq / sr);
  let hpPrev = 0;
  // Shelving filter for K-weighting stage 2 (4 dB high-shelf ~1500 Hz)
  const shelfFreq = 1500;
  const shelfAlpha = Math.exp(-2 * Math.PI * shelfFreq / sr);
  let shelfPrev = 0;
  const shelfGain = Math.pow(10, 4 / 20); // +4 dB

  let sumSq = 0;
  let count = 0;
  for (const ch of pcm.channels) {
    hpPrev = 0; shelfPrev = 0;
    for (let i = 0; i < ch.length; i++) {
      let s = ch[i];
      // High-pass (pre-filter)
      s = s - hpPrev * hpAlpha;
      hpPrev = s;
      // High-shelf (RLB)
      const dry = s;
      s = dry * shelfAlpha + shelfPrev * (1 - shelfAlpha);
      s = dry + (s - dry) * (shelfGain - 1);
      shelfPrev = s;
      sumSq += s * s;
      count++;
    }
  }
  if (count === 0) return -70;
  const meanSq = sumSq / count;
  if (meanSq < 1e-12) return -70;
  // -0.691 dB offset for LUFS calibration
  return linToDb(meanSq) - 0.691;
}

// ─── DC Offset ──────────────────────────────────────────────────────────────

/** DC offset = mean amplitude. Should be ~0 for well-recorded audio. */
export function computeDCOffset(pcm: PCM): number {
  let sum = 0;
  let count = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) {
      sum += ch[i];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// ─── Clipping Detection ─────────────────────────────────────────────────────

export interface ClippingReport {
  clipped: boolean;
  clipCount: number;
  clipRatio: number;   // fraction of samples at/near full scale
  maxAmplitude: number;
}

/** Detect digital clipping — samples at or above threshold (default 0.99). */
export function detectClipping(pcm: PCM, threshold = 0.99): ClippingReport {
  let clipCount = 0;
  let maxAmp = 0;
  let total = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > maxAmp) maxAmp = a;
      if (a >= threshold) clipCount++;
      total++;
    }
  }
  return {
    clipped: clipCount > 0,
    clipCount,
    clipRatio: total > 0 ? clipCount / total : 0,
    maxAmplitude: maxAmp,
  };
}

// ─── Spectrum ───────────────────────────────────────────────────────────────

const DEFAULT_FFT_N = 2048;

/** Compute a Hann-windowed magnitude spectrum at a normalized position.
 *  Returns Float32Array of magnitude bins (0..FFT_N/2). Uses direct DFT
 *  for testability (no FFTW dependency). */
export function computeSpectrum(
  pcm: PCM,
  posNorm = 0,
  fftN = DEFAULT_FFT_N,
): { magnitudes: Float32Array; sampleRate: number; binFreq: number } {
  const ch = pcm.channels[0];
  if (!ch || ch.length < fftN) {
    return { magnitudes: new Float32Array(fftN / 2), sampleRate: pcm.sampleRate, binFreq: pcm.sampleRate / fftN };
  }
  const center = Math.floor(clamp(posNorm, 0, 0.999) * (ch.length - fftN));
  // Hann window
  const win = new Float32Array(fftN);
  for (let i = 0; i < fftN; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftN - 1));
  }
  // Windowed frame
  const frame = new Float32Array(fftN);
  for (let i = 0; i < fftN; i++) frame[i] = ch[center + i] * win[i];
  // DFT (direct — O(N²) but N=2048 is manageable for analysis)
  const half = fftN / 2;
  const mags = new Float32Array(half);
  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    const w = -2 * Math.PI * k / fftN;
    for (let n = 0; n < fftN; n++) {
      re += frame[n] * Math.cos(w * n);
      im -= frame[n] * Math.sin(w * n);
    }
    mags[k] = Math.hypot(re, im) / (fftN / 2);
  }
  return { magnitudes: mags, sampleRate: pcm.sampleRate, binFreq: pcm.sampleRate / fftN };
}

// ─── Fundamental Frequency (Root) Detection ─────────────────────────────────

/** Detect the fundamental frequency via autocorrelation on the first channel.
 *  Returns Hz, or 0 if no clear fundamental found. */
export function detectFundamental(pcm: PCM, minHz = 50, maxHz = 2000): number {
  const ch = pcm.channels[0];
  if (!ch || ch.length < 256) return 0;
  const sr = pcm.sampleRate;
  const minLag = Math.floor(sr / maxHz);
  const maxLag = Math.min(Math.floor(sr / minHz), ch.length / 2);
  if (maxLag <= minLag) return 0;

  // Use a windowed segment from the middle for stability.
  const segLen = Math.min(ch.length, Math.floor(sr * 0.05));
  const segStart = Math.floor((ch.length - segLen) / 2);
  const seg = ch.subarray(segStart, segStart + segLen);

  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let norm = 0;
    for (let i = 0; i < segLen - lag; i++) {
      corr += seg[i] * seg[i + lag];
      norm += seg[i] * seg[i];
    }
    if (norm < 1e-10) continue;
    const normCorr = corr / Math.sqrt(norm);
    if (normCorr > bestCorr) {
      bestCorr = normCorr;
      bestLag = lag;
    }
  }
  if (bestLag === 0) return 0;
  return sr / bestLag;
}

// ─── Pitch-Class Histogram from Audio ────────────────────────────────────────

/** Build a pitch-class histogram (12 bins) from the fundamental frequency
 *  across multiple analysis windows. Returns number[12]. */
export function pitchClassHistogramFromAudio(pcm: PCM): number[] {
  const hist = new Array(12).fill(0);
  const ch = pcm.channels[0];
  if (!ch || ch.length < 1024) return hist;
  const sr = pcm.sampleRate;
  const stepMs = 50;
  const stepSamp = Math.floor(sr * stepMs / 1000);
  const winSamp = Math.min(ch.length, Math.floor(sr * 0.1));

  for (let start = 0; start + winSamp < ch.length; start += stepSamp) {
    const seg = ch.subarray(start, start + winSamp);
    // Autocorrelation for this window
    let bestLag = 0;
    let bestCorr = 0;
    const minLag = Math.floor(sr / 2000);
    const maxLag = Math.min(Math.floor(sr / 50), winSamp / 2);
    if (maxLag <= minLag) continue;
    let norm = 0;
    for (let i = 0; i < winSamp; i++) norm += seg[i] * seg[i];
    if (norm < 1e-10) continue;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < winSamp - lag; i++) corr += seg[i] * seg[i + lag];
      const nc = corr / Math.sqrt(norm);
      if (nc > bestCorr) { bestCorr = nc; bestLag = lag; }
    }
    if (bestLag > 0 && bestCorr > 0.3) {
      const freq = sr / bestLag;
      if (freq > 20 && freq < 8000) {
        // Convert to MIDI pitch class
        const midi = 69 + 12 * Math.log2(freq / 440);
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        hist[pc] += bestCorr;
      }
    }
  }
  return hist;
}

// Krumhansl-Schmuckler key profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d === 0 ? 0 : dot / d;
}

/** Detect key from audio — uses pitch-class histogram + Krumhansl-Schmuckler. */
export function detectKeyFromAudio(pcm: PCM): {
  root: number; mode: "major" | "minor"; confidence: number; fundamental: number;
} {
  const fundamental = detectFundamental(pcm);
  const hist = pitchClassHistogramFromAudio(pcm);
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return { root: 0, mode: "minor", confidence: 0, fundamental };

  let bestRoot = 0;
  let bestMode: "major" | "minor" = "minor";
  let bestSim = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    const rotated = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) rotated[i] = hist[(i + shift) % 12];
    const simMaj = cosineSimilarity(rotated, MAJOR_PROFILE);
    const simMin = cosineSimilarity(rotated, MINOR_PROFILE);
    if (simMaj > bestSim) { bestSim = simMaj; bestRoot = shift; bestMode = "major"; }
    if (simMin > bestSim) { bestSim = simMin; bestRoot = shift; bestMode = "minor"; }
  }
  return { root: bestRoot, mode: bestMode, confidence: Math.max(0, bestSim), fundamental };
}

// ─── BPM Detection ───────────────────────────────────────────────────────────

/** Detect BPM via onset-based autocorrelation. Analyzes the onset envelope
 *  and finds the periodicity that best explains the onset pattern.
 *  Returns BPM in range [60, 300] or 0 if not detected. */
export function detectBPM(pcm: PCM, minBPM = 60, maxBPM = 300): number {
  const ch = pcm.channels[0];
  if (!ch || ch.length < pcm.sampleRate) return 0; // need at least 1 second
  const sr = pcm.sampleRate;
  // Onset envelope: short-term energy flux
  const winSamp = Math.max(128, Math.floor(sr * 0.01)); // 10ms
  const hop = Math.max(64, Math.floor(winSamp / 2));
  const onsets: number[] = [];
  for (let i = 0; i + winSamp < ch.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < winSamp; j++) sum += ch[i + j] * ch[i + j];
    onsets.push(Math.sqrt(sum / winSamp));
  }
  // Flux = positive differences
  const flux = new Float32Array(onsets.length);
  for (let i = 1; i < onsets.length; i++) {
    flux[i] = Math.max(0, onsets[i] - onsets[i - 1]);
  }
  // Autocorrelation over BPM range
  const minLagFrames = Math.floor((60 / maxBPM) / (hop / sr));
  const maxLagFrames = Math.floor((60 / minBPM) / (hop / sr));
  if (maxLagFrames >= flux.length || minLagFrames < 1) return 0;

  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = minLagFrames; lag <= maxLagFrames; lag++) {
    let corr = 0;
    for (let i = lag; i < flux.length; i++) corr += flux[i] * flux[i - lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  if (bestLag === 0) return 0;
  const bpm = 60 / (bestLag * hop / sr);
  // Snap to nearest integer, fold into [minBPM, maxBPM]
  let snapped = Math.round(bpm);
  while (snapped < minBPM) snapped *= 2;
  while (snapped > maxBPM) snapped /= 2;
  return snapped;
}

// ─── Transient Detection (re-export for convenience) ────────────────────────

export { detectTransients } from "@/lib/audio/sampleForge";

// ─── Dynamics Analysis ───────────────────────────────────────────────────────

export interface DynamicsReport {
  rms: number;
  rmsDb: number;
  peak: number;
  peakDb: number;
  crest: number;
  crestDb: number;
  loudness: number;       // LUFS approximation
  dynamicRange: number;   // peak - RMS in dB (simplified)
}

/** Full dynamics analysis. */
export function analyzeDynamics(pcm: PCM): DynamicsReport {
  const rms = computeRMS(pcm);
  const peak = computePeak(pcm);
  const crest = computeCrest(pcm);
  return {
    rms,
    rmsDb: rms > 1e-8 ? linToDb(rms) : -120,
    peak,
    peakDb: peak > 1e-8 ? linToDb(peak) : -120,
    crest,
    crestDb: crest > 0 ? linToDb(crest) : 0,
    loudness: computeLoudness(pcm),
    dynamicRange: (peak > 1e-8 && rms > 1e-8) ? linToDb(peak) - linToDb(rms) : 0,
  };
}

// ─── Full Sample Analysis Summary ───────────────────────────────────────────

export interface SampleAnalysis {
  durationSec: number;
  sampleRate: number;
  channels: number;
  peak: number;
  rms: number;
  crest: number;
  loudness: number;
  dcOffset: number;
  clipping: ClippingReport;
  dynamics: DynamicsReport;
  bpm: number;
  key: { root: number; mode: "major" | "minor"; confidence: number; fundamental: number };
  transients: number[];
}

/** Complete analysis of a sample — all fields deterministic and reproducible. */
export function analyzeSample(pcm: PCM): SampleAnalysis {
  const len = pcm.channels[0]?.length ?? 0;
  return {
    durationSec: len / pcm.sampleRate,
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.length,
    peak: computePeak(pcm),
    rms: computeRMS(pcm),
    crest: computeCrest(pcm),
    loudness: computeLoudness(pcm),
    dcOffset: computeDCOffset(pcm),
    clipping: detectClipping(pcm),
    dynamics: analyzeDynamics(pcm),
    bpm: detectBPM(pcm),
    key: detectKeyFromAudio(pcm),
    transients: [], // populated by caller via detectTransients if needed
  };
}

// Silence unused import (denormalFlush is available for consumers).
void denormalFlush;