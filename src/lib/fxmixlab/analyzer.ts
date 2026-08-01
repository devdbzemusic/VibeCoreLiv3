// VibeCore FX Mix Lab — Audio Analyzer.
//
// Off-audio-path analysis functions. All functions are pure — they operate
// on Float32Array snapshots from AnalyserNode.getFloatTimeDomainData() /
// getFloatFrequencyData(). No audio thread access, no Web Audio node creation.
//
// Implements: Peak, RMS, LUFS (integrated + short-term), Crest Factor,
// Stereo Balance, Phase Correlation, Frequency Spectrum, Headroom,
// Clipping Detection.

import type { AnalyzerSnapshot } from "./types";

// ── Level Analysis ────────────────────────────────────────────────────────────

/** Compute peak and RMS from a Float32Array. O(n), allocation-free. */
export function computePeakRMS(buf: Float32Array): { peak: number; rms: number } {
  let peak = 0, sumSq = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > peak) peak = a;
    sumSq += buf[i] * buf[i];
  }
  return { peak, rms: Math.sqrt(sumSq / Math.max(1, buf.length)) };
}

/** Convert linear amplitude to dB. */
export function linToDb(lin: number): number {
  if (lin <= 1e-10) return -200;
  return 20 * Math.log10(lin);
}

// ── LUFS (K-weighted) ─────────────────────────────────────────────────────────
//
// ITU-R BS.1770-4 simplified K-weighting: high-shelf + high-pass.
// This is a control-thread approximation using offline filtering on the
// snapshot — not a realtime LUFS meter. Accurate enough for mixing decisions.

const K_WEIGHT_HP_FREQ = 38;    // Hz
const K_WEIGHT_HS_FREQ = 1500;  // Hz
const K_WEIGHT_HS_GAIN = 4;     // dB

/** K-weight a buffer (simplified ITU-R BS.1770). Returns weighted RMS. */
function kWeightedRMS(buf: Float32Array, sampleRate: number): number {
  // Simplified: apply high-pass at 38 Hz + high-shelf boost at 1.5 kHz
  // For a control-thread approximation, we use a one-pole HP filter.
  const hpAlpha = 1 - Math.exp(-2 * Math.PI * K_WEIGHT_HP_FREQ / sampleRate);
  const hsAlpha = 1 - Math.exp(-2 * Math.PI * K_WEIGHT_HS_FREQ / sampleRate);
  const hsGainLin = Math.pow(10, K_WEIGHT_HS_GAIN / 20);

  let hpState = 0;
  let hsState = 0;
  let sumSq = 0;

  for (let i = 0; i < buf.length; i++) {
    // High-pass (one-pole)
    hpState += hpAlpha * (buf[i] - hpState);
    const hp = buf[i] - hpState;

    // High-shelf (one-pole low-pass → subtract from original → shelf)
    hsState += hsAlpha * (hp - hsState);
    const weighted = hp + (hp - hsState) * (hsGainLin - 1);

    sumSq += weighted * weighted;
  }
  return Math.sqrt(sumSq / Math.max(1, buf.length));
}

/** Compute LUFS from K-weighted RMS. */
function rmsToLufs(rms: number): number {
  if (rms <= 1e-10) return -200;
  return linToDb(rms) + 0.691;  // K-weighting offset (ITU-R BS.1770-4)
}

// ── Integrated LUFS (rolling) ─────────────────────────────────────────────────

let _lufsIntegratedSum = 0;
let _lufsIntegratedCount = 0;
let _lufsShortTermBuffer: number[] = [];

/** Feed a new RMS measurement to the integrated LUFS accumulator. */
export function feedLufsIntegrated(rmsL: number, rmsR: number): void {
  const lufs = rmsToLufs(Math.sqrt((rmsL * rmsL + rmsR * rmsR) / 2));
  _lufsIntegratedSum += lufs;
  _lufsIntegratedCount++;
  _lufsShortTermBuffer.push(lufs);
  if (_lufsShortTermBuffer.length > 10) _lufsShortTermBuffer.shift(); // 400ms window at 25 Hz
}

/** Get the integrated LUFS value. */
export function getIntegratedLufs(): number {
  if (_lufsIntegratedCount === 0) return -200;
  return _lufsIntegratedSum / _lufsIntegratedCount;
}

/** Get the short-term LUFS (400ms window). */
export function getShortTermLufs(): number {
  if (_lufsShortTermBuffer.length === 0) return -200;
  return _lufsShortTermBuffer.reduce((a, b) => a + b, 0) / _lufsShortTermBuffer.length;
}

/** Reset the LUFS accumulators (on transport start). */
export function resetLufs(): void {
  _lufsIntegratedSum = 0;
  _lufsIntegratedCount = 0;
  _lufsShortTermBuffer = [];
}

// ── Stereo Analysis ───────────────────────────────────────────────────────────

/** Stereo balance: -1 (full L) .. +1 (full R). 0 = centered. */
export function computeStereoBalance(peakL: number, peakR: number): number {
  const sum = peakL + peakR;
  if (sum < 1e-10) return 0;
  return (peakR - peakL) / sum;
}

/** Phase correlation: -1 (anti-phase) .. +1 (mono). */
export function computePhaseCorrelation(bufL: Float32Array, bufR: Float32Array): number {
  if (bufL.length === 0 || bufR.length === 0) return 0;
  const n = Math.min(bufL.length, bufR.length);
  let sumLR = 0, sumLL = 0, sumRR = 0;
  for (let i = 0; i < n; i++) {
    sumLR += bufL[i] * bufR[i];
    sumLL += bufL[i] * bufL[i];
    sumRR += bufR[i] * bufR[i];
  }
  const denom = Math.sqrt(sumLL * sumRR);
  if (denom < 1e-10) return 0;
  return Math.max(-1, Math.min(1, sumLR / denom));
}

// ── Crest Factor ─────────────────────────────────────────────────────────────

/** Crest factor in dB: peak_dB - rms_dB. Higher = more dynamic range. */
export function computeCrestFactor(peak: number, rms: number): number {
  if (rms < 1e-10) return 0;
  return linToDb(peak) - linToDb(rms);
}

// ── Headroom ──────────────────────────────────────────────────────────────────

/** Headroom in dB below 0 dBFS (full scale). */
export function computeHeadroom(peak: number): number {
  if (peak < 1e-10) return 200;
  return -linToDb(peak);
}

// ── Clipping Detection ────────────────────────────────────────────────────────

/** Detect clipping: any sample at or above the clipping threshold (0.99). */
export function detectClipping(buf: Float32Array, threshold = 0.99): boolean {
  for (let i = 0; i < buf.length; i++) {
    if (Math.abs(buf[i]) >= threshold) return true;
  }
  return false;
}

// ── Frequency Spectrum (FFT bins) ─────────────────────────────────────────────

/** Downsample a Float32Array of FFT magnitudes (dB) to N bins for visualization.
 *  Input is typically from AnalyserNode.getFloatFrequencyData(). */
export function downsampleSpectrum(
  freqData: Float32Array,
  bins: number,
): Float32Array {
  const out = new Float32Array(bins);
  if (freqData.length === 0) return out;
  const blockSize = Math.max(1, Math.floor(freqData.length / bins));
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, freqData.length);
    for (let j = start; j < end; j++) sum += freqData[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

// ── Full Snapshot ──────────────────────────────────────────────────────────────

/** Build a complete AnalyzerSnapshot from L/R time-domain buffers.
 *  By default this does NOT feed the global LUFS accumulator — pass
 *  `feedLufs: true` for the master-bus snapshot that should update
 *  integrated/short-term LUFS. This prevents per-channel snapshots
 *  from polluting the global loudness state. */
export function buildSnapshot(
  bufL: Float32Array,
  bufR: Float32Array,
  sampleRate: number,
  freqData?: Float32Array,
  feedLufs: boolean = false,
): AnalyzerSnapshot {
  const { peak: peakL, rms: rmsL } = computePeakRMS(bufL);
  const { peak: peakR, rms: rmsR } = computePeakRMS(bufR);

  const peak = Math.max(peakL, peakR);

  // K-weighted LUFS — only feed the global accumulator when explicitly
  // requested (master bus). Per-channel snapshots compute momentary
  // LUFS without polluting integrated state.
  const kwL = kWeightedRMS(bufL, sampleRate);
  const kwR = kWeightedRMS(bufR, sampleRate);
  if (feedLufs) {
    feedLufsIntegrated(kwL, kwR);
  }
  const momentaryLufs = rmsToLufs(Math.sqrt((kwL * kwL + kwR * kwR) / 2));

  return {
    peakL,
    peakR,
    rmsL,
    rmsR,
    lufsIntegrated: feedLufs ? getIntegratedLufs() : momentaryLufs,
    lufsShortTerm: feedLufs ? getShortTermLufs() : momentaryLufs,
    crestFactor: computeCrestFactor(peak, Math.sqrt((rmsL * rmsL + rmsR * rmsR) / 2)),
    stereoBalance: computeStereoBalance(peakL, peakR),
    phaseCorrelation: computePhaseCorrelation(bufL, bufR),
    headroomDb: computeHeadroom(peak),
    clipping: detectClipping(bufL) || detectClipping(bufR),
    spectrum: freqData ? downsampleSpectrum(freqData, 64) : undefined,
  };
}