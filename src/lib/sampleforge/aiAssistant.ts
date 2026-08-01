// VibeCore Sample Forge — AI Sample Assistant.
//
// AI-assisted sample analysis and suggestions. All functions are ASSISTIVE
// — they produce suggestions and metadata, never modify audio without
// explicit user action. Deterministic given the same PCM input.
//
// Reuses:
//   • groove/analysis.ts (key detection, density)
//   • sampleforge/analysis.ts (BPM, dynamics, spectrum)
//   • sampleforge/sliceEngine.ts (auto-slice)
//
// No direct audio-path access — AI never touches the audio thread.

import type { PCM } from "@/lib/audio/sampleForge";
import {
  analyzeSample, detectBPM, computeSpectrum,
} from "./analysis";
import { autoSlice, equalSlice, type Slice } from "./sliceEngine";

// ─── Drum Classification ──────────────────────────────────────────────────────

export type DrumClass = "kick" | "snare" | "hat" | "perc" | "tom" | "clap" | "cymbal" | "unknown";

export interface DrumClassification {
  class: DrumClass;
  confidence: number;
  features: {
    spectralCentroid: number;   // brightness indicator
    transientSharpness: number; // attack sharpness
    durationMs: number;
    lowEnergy: number;          // 0..1 — energy below 200 Hz
    highEnergy: number;         // 0..1 — energy above 5 kHz
  };
}

/** Classify a drum sample based on spectral + temporal features. */
export function classifyDrum(pcm: PCM): DrumClassification {
  const sr = pcm.sampleRate;
  const len = pcm.channels[0]?.length ?? 0;
  const durMs = (len / sr) * 1000;
  const { magnitudes, binFreq } = computeSpectrum(pcm, 0, 1024);

  // Spectral centroid (brightness)
  let centroid = 0;
  let totalMag = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    const freq = k * binFreq;
    centroid += freq * magnitudes[k];
    totalMag += magnitudes[k];
  }
  centroid = totalMag > 0 ? centroid / totalMag : 0;

  // Low-band energy (< 200 Hz) and high-band energy (> 5 kHz)
  const lowBin = Math.floor(200 / binFreq);
  const highBin = Math.floor(5000 / binFreq);
  let lowE = 0, highE = 0, allE = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    allE += magnitudes[k] * magnitudes[k];
    if (k < lowBin) lowE += magnitudes[k] * magnitudes[k];
    if (k > highBin) highE += magnitudes[k] * magnitudes[k];
  }
  const lowEnergy = allE > 0 ? Math.sqrt(lowE / allE) : 0;
  const highEnergy = allE > 0 ? Math.sqrt(highE / allE) : 0;

  // Transient sharpness: ratio of first 10ms energy to total
  const attackSamp = Math.min(len, Math.floor(sr * 0.01));
  let attackE = 0, totalE = 0;
  const ch = pcm.channels[0];
  for (let i = 0; i < len; i++) {
    const v = ch[i] * ch[i];
    totalE += v;
    if (i < attackSamp) attackE += v;
  }
  const transientSharpness = totalE > 0 ? attackE / totalE : 0;

  // Heuristic classification
  let cls: DrumClass = "unknown";
  let confidence = 0;

  if (lowEnergy > 0.5 && centroid < 500 && durMs < 1500) {
    cls = "kick"; confidence = 0.7 + lowEnergy * 0.2;
  } else if (highEnergy > 0.3 && centroid > 3000 && durMs < 300) {
    cls = "hat"; confidence = 0.6 + highEnergy * 0.2;
  } else if (centroid > 1500 && centroid < 4000 && durMs < 800 && transientSharpness > 0.2) {
    cls = "snare"; confidence = 0.6;
  } else if (centroid > 2000 && durMs < 400) {
    cls = "perc"; confidence = 0.5;
  } else if (lowEnergy > 0.3 && centroid < 1000 && durMs < 600) {
    cls = "tom"; confidence = 0.5;
  } else if (transientSharpness > 0.3 && centroid > 2000 && durMs < 400) {
    cls = "clap"; confidence = 0.5;
  } else if (highEnergy > 0.4 && durMs > 500) {
    cls = "cymbal"; confidence = 0.5;
  }

  return {
    class: cls,
    confidence: Math.min(0.95, confidence),
    features: { spectralCentroid: centroid, transientSharpness, durationMs: durMs, lowEnergy, highEnergy },
  };
}

// ─── Instrument Detection ─────────────────────────────────────────────────────

export type InstrumentClass = "drum" | "bass" | "synth" | "vocal" | "texture" | "unknown";

/** Classify the general instrument type of a sample. */
export function classifyInstrument(pcm: PCM): { class: InstrumentClass; confidence: number } {
  const analysis = analyzeSample(pcm);
  const drum = classifyDrum(pcm);
  const durMs = analysis.durationSec * 1000;
  const fundamental = analysis.key.fundamental;

  if (drum.confidence > 0.6 && durMs < 2000) {
    return { class: "drum", confidence: drum.confidence };
  }
  if (analysis.dynamics.crest > 4 && fundamental > 0 && fundamental < 200) {
    return { class: "bass", confidence: 0.6 };
  }
  if (fundamental > 200 && fundamental < 2000 && analysis.dynamics.crest < 6) {
    return { class: "synth", confidence: 0.5 };
  }
  if (analysis.dynamics.crest < 3 && durMs > 2000) {
    return { class: "texture", confidence: 0.5 };
  }
  if (fundamental > 200 && fundamental < 1500 && analysis.dynamics.peak > 0.3) {
    return { class: "vocal", confidence: 0.4 };
  }
  return { class: "unknown", confidence: 0.2 };
}

// ─── AI Suggestions ────────────────────────────────────────────────────────────

export interface SliceSuggestion {
  slices: Slice[];
  sensitivity: number;
  rationale: string;
}

/** Suggest an optimal slice configuration based on sample analysis.
 *  Tries multiple sensitivities and picks the one that produces the most
 *  musically useful number of slices (4..32). */
export function suggestSlices(pcm: PCM): SliceSuggestion {
  const bpm = detectBPM(pcm);
  const durSec = (pcm.channels[0]?.length ?? 0) / pcm.sampleRate;

  // If BPM detected, try to slice at beat boundaries
  if (bpm > 0) {
    const beatSec = 60 / bpm;
    const beats = Math.round(durSec / beatSec);
    if (beats >= 4 && beats <= 64) {
      return {
        slices: equalSlice(beats, { namePrefix: "BEAT" }),
        sensitivity: 0.5,
        rationale: `BPM-locked: ${beats} beats at ${bpm} BPM`,
      };
    }
  }

  // Fall back to transient detection with adaptive sensitivity
  for (const sens of [0.7, 0.5, 0.3]) {
    const slices = autoSlice(pcm, sens, 32);
    if (slices.length >= 4 && slices.length <= 32) {
      return {
        slices,
        sensitivity: sens,
        rationale: `Transient-based: ${slices.length} slices at sensitivity ${sens}`,
      };
    }
  }
  return {
    slices: equalSlice(8),
    sensitivity: 0.5,
    rationale: "Default: 8 equal slices (no clear transients detected)",
  };
}

export interface LoopSuggestion {
  startNorm: number;
  endNorm: number;
  bpm: number;
  bars: number;
  rationale: string;
}

/** Suggest loop points based on BPM and bar detection.
 *  AI-2 fix: guards against 0-length PCM to prevent NaN endNorm. */
export function suggestLoopPoints(pcm: PCM): LoopSuggestion {
  const bpm = detectBPM(pcm);
  const sr = pcm.sampleRate;
  const len = pcm.channels[0]?.length ?? 0;
  const durSec = len > 0 ? len / sr : 0;

  if (durSec <= 0) {
    return { startNorm: 0, endNorm: 0, bpm: 0, bars: 0, rationale: "Empty sample" };
  }

  if (bpm > 0) {
    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const bars = Math.max(1, Math.floor(durSec / barSec));
    const loopLen = bars * barSec;
    return {
      startNorm: 0,
      endNorm: Math.min(1, loopLen / durSec),
      bpm,
      bars,
      rationale: `${bars} bars at ${bpm} BPM (${loopLen.toFixed(2)}s)`,
    };
  }

  // Fallback: use the whole sample as a one-shot
  return {
    startNorm: 0,
    endNorm: 1,
    bpm: 0,
    bars: 0,
    rationale: "No BPM detected — using full sample length",
  };
}

// ─── Sample Tags ───────────────────────────────────────────────────────────────

/** Auto-generate descriptive tags from sample analysis. */
export function generateSampleTags(pcm: PCM): string[] {
  const analysis = analyzeSample(pcm);
  const drum = classifyDrum(pcm);
  const inst = classifyInstrument(pcm);
  const tags: string[] = [];

  // Instrument tag
  tags.push(inst.class);

  // Drum class tag
  if (inst.class === "drum") tags.push(drum.class);

  // Key/mode tags
  if (analysis.key.confidence > 0.3) {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    tags.push(`${noteNames[analysis.key.root]}${analysis.key.mode === "major" ? "maj" : "min"}`);
  }

  // BPM tag
  if (analysis.bpm > 0) tags.push(`${analysis.bpm}bpm`);

  // Dynamics tags
  if (analysis.dynamics.crest > 6) tags.push("transient");
  else if (analysis.dynamics.crest < 2) tags.push("sustained");
  else tags.push("balanced");

  // Duration tags
  if (analysis.durationSec < 0.5) tags.push("oneshot");
  else if (analysis.durationSec > 3) tags.push("loop");

  // Clipping warning
  if (analysis.clipping.clipped) tags.push("clipped");

  return tags;
}

// ─── Similarity Search ─────────────────────────────────────────────────────────

export interface SampleFingerprint {
  bpm: number;
  key: { root: number; mode: string; confidence: number };
  spectralCentroid: number;
  crest: number;
  durationSec: number;
  drumClass: string;
  instrumentClass: string;
}

/** Compute a content fingerprint for similarity comparison. */
export function computeFingerprint(pcm: PCM): SampleFingerprint {
  const analysis = analyzeSample(pcm);
  const drum = classifyDrum(pcm);
  const inst = classifyInstrument(pcm);
  const { magnitudes, binFreq } = computeSpectrum(pcm, 0, 1024);
  let centroid = 0, total = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    centroid += k * binFreq * magnitudes[k];
    total += magnitudes[k];
  }
  return {
    bpm: analysis.bpm,
    key: { root: analysis.key.root, mode: analysis.key.mode, confidence: analysis.key.confidence },
    spectralCentroid: total > 0 ? centroid / total : 0,
    crest: analysis.dynamics.crest,
    durationSec: analysis.durationSec,
    drumClass: drum.class,
    instrumentClass: inst.class,
  };
}

/** Compare two fingerprints — returns 0..1 similarity (1 = identical). */
export function fingerprintSimilarity(a: SampleFingerprint, b: SampleFingerprint): number {
  let score = 0;
  let weight = 0;
  // BPM similarity (within 5% = full match)
  if (a.bpm > 0 && b.bpm > 0) {
    const diff = Math.abs(a.bpm - b.bpm) / Math.max(a.bpm, b.bpm);
    score += (1 - Math.min(1, diff * 20)) * 0.25;
    weight += 0.25;
  }
  // Key similarity
  if (a.key.root === b.key.root && a.key.mode === b.key.mode) {
    score += 0.2; weight += 0.2;
  } else if (a.key.root === b.key.root) {
    score += 0.1; weight += 0.1;
  }
  // Spectral centroid similarity
  const cdDiff = Math.abs(a.spectralCentroid - b.spectralCentroid) / Math.max(1, a.spectralCentroid, b.spectralCentroid);
  score += (1 - Math.min(1, cdDiff)) * 0.2; weight += 0.2;
  // Crest similarity
  const crDiff = Math.abs(a.crest - b.crest) / Math.max(1, a.crest, b.crest);
  score += (1 - Math.min(1, crDiff)) * 0.15; weight += 0.15;
  // Duration similarity
  const dDiff = Math.abs(a.durationSec - b.durationSec) / Math.max(0.1, a.durationSec, b.durationSec);
  score += (1 - Math.min(1, dDiff)) * 0.1; weight += 0.1;
  // Class match
  if (a.instrumentClass === b.instrumentClass) { score += 0.05; weight += 0.05; }
  if (a.drumClass === b.drumClass) { score += 0.05; weight += 0.05; }

  return weight > 0 ? score / weight : 0;
}

/** Find similar samples in a library (array of fingerprints). Returns
 *  indices sorted by similarity (descending), top N. */
export function findSimilarSamples(
  target: SampleFingerprint,
  library: SampleFingerprint[],
  topN = 10,
): { idx: number; similarity: number }[] {
  const scored = library.map((fp, idx) => ({ idx, similarity: fingerprintSimilarity(target, fp) }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topN);
}