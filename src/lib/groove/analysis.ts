// VibeCore Groove — Analysis Utilities.
//
// Pure, deterministic analysis functions for the Groove module. No audio,
// no clock, no UI — these operate on the Pattern model and return structured
// analysis results. Used by the Groove Analysis tab, AI co-assistant (context),
// and the self-test suite.
//
// All functions are allocation-free in the audio path (they run on the control
// thread / UI thread only) and fully deterministic given the same Pattern.

import type { Pattern, Part, Step, Note, PartCategory } from "@/lib/model";
import { SCALE_DEGREES, type ArpScale } from "@/lib/audio/arpEngine";

// ─── Groove Density ─────────────────────────────────────────────────────────
/** Fraction of active (on) steps across all parts in all scenes. 0 = empty,
 *  1 = every step in every part is active. Weighted by scene length so longer
 *  scenes don't dominate. */
export function grooveDensity(pattern: Pattern): number {
  let total = 0;
  let active = 0;
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) {
        total++;
        if (st.on) active++;
      }
    }
  }
  return total === 0 ? 0 : active / total;
}

/** Per-part density map — useful for visualisation and AI context. */
export function partDensity(pattern: Pattern, parts: Part[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of parts) {
    let total = 0, active = 0;
    for (const sc of pattern.scenes) {
      const arr = sc.partSteps[p.id];
      if (!arr) continue;
      for (const st of arr) { total++; if (st.on) active++; }
    }
    out.set(p.id, total === 0 ? 0 : active / total);
  }
  return out;
}

// ─── Swing ──────────────────────────────────────────────────────────────────
/** Swing amount (0..100, 50 = straight). Read from the pattern's swing field. */
export function swingAmount(pattern: Pattern): number {
  return Math.max(0, Math.min(100, pattern.swing ?? 50));
}

// ─── Velocity Histogram ─────────────────────────────────────────────────────
/** Histogram of velocities across all active steps. Returns a Map from
 *  velocity bucket (0..127, rounded to nearest 8) to count. */
export function velocityHistogram(pattern: Pattern): Map<number, number> {
  const hist = new Map<number, number>();
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) {
        if (!st.on) continue;
        const bucket = Math.round(st.velocity / 8) * 8;
        hist.set(bucket, (hist.get(bucket) ?? 0) + 1);
      }
    }
    // Include piano-roll notes too.
    for (const partId of Object.keys(sc.partNotes)) {
      const notes = sc.partNotes[Number(partId)];
      if (!notes) continue;
      for (const n of notes) {
        const bucket = Math.round(n.velocity / 8) * 8;
        hist.set(bucket, (hist.get(bucket) ?? 0) + 1);
      }
    }
  }
  return hist;
}

/** Average velocity across all active hits. */
export function avgVelocity(pattern: Pattern): number {
  let sum = 0, count = 0;
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) {
        if (!st.on) continue;
        sum += st.velocity; count++;
      }
    }
  }
  return count === 0 ? 0 : Math.round(sum / count);
}

// ─── Humanize / Timing Analysis ─────────────────────────────────────────────
/** Analyse micro-timing offsets across all active steps. Returns min, max,
 *  avg, and the spread (max - min). */
export function timingAnalysis(pattern: Pattern): {
  microMin: number; microMax: number; microAvg: number; spread: number;
} {
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) {
        if (!st.on) continue;
        const m = st.micro ?? 0;
        if (m < min) min = m;
        if (m > max) max = m;
        sum += m; count++;
      }
    }
  }
  if (count === 0) return { microMin: 0, microMax: 0, microAvg: 0, spread: 0 };
  return { microMin: min, microMax: max, microAvg: Math.round(sum / count), spread: max - min };
}

/** Analyse humanize amounts across all active steps. */
export function humanizeAnalysis(pattern: Pattern): {
  humMin: number; humMax: number; humAvg: number;
} {
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) {
        if (!st.on) continue;
        const h = st.humanize ?? 0;
        if (h < min) min = h;
        if (h > max) max = h;
        sum += h; count++;
      }
    }
  }
  if (count === 0) return { humMin: 0, humMax: 0, humAvg: 0 };
  return { humMin: min, humMax: max, humAvg: Math.round(sum / count) };
}

// ─── Pattern Similarity ─────────────────────────────────────────────────────
/** Jaccard similarity between two patterns' active-step sets.
 *  Compares step activation across all parts in all scenes.
 *  Returns 0..1 (1 = identical hit patterns, 0 = no overlap). */
export function patternSimilarity(a: Pattern, b: Pattern): number {
  // Build sets of "sceneIdx:partId:stepIdx" for active steps.
  const setA = new Set<string>();
  const setB = new Set<string>();
  a.scenes.forEach((sc, si) => {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      arr.forEach((st, i) => { if (st.on) setA.add(`${si}:${partId}:${i}`); });
    }
  });
  b.scenes.forEach((sc, si) => {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      arr.forEach((st, i) => { if (st.on) setB.add(`${si}:${partId}:${i}`); });
    }
  });
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const k of setA) if (setB.has(k)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ─── Key / Scale Detection ──────────────────────────────────────────────────
/** Pitch-class histogram from all piano-roll notes in a pattern. */
export function pitchClassHistogram(pattern: Pattern): number[] {
  const hist = new Array(12).fill(0);
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partNotes)) {
      const notes = sc.partNotes[Number(partId)];
      if (!notes) continue;
      for (const n of notes) {
        hist[((n.pitch % 12) + 12) % 12]++;
      }
    }
  }
  return hist;
}

// Krumhansl-Schmuckler key profiles (major / minor).
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Detect the most likely key (root pitch class + major/minor) from all
 *  piano-roll notes. Uses the Krumhansl-Schmuckler algorithm: rotates the
 *  pitch-class histogram against the major / minor key profiles and picks
 *  the rotation with the highest cosine similarity.
 *  Returns { root, mode, confidence } where root is 0..11 (C=0) and confidence
 *  is the cosine similarity (0..1). */
export function detectKey(pattern: Pattern): {
  root: number; mode: "major" | "minor"; confidence: number;
} {
  const hist = pitchClassHistogram(pattern);
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return { root: 0, mode: "minor", confidence: 0 };

  let bestRoot = 0;
  let bestMode: "major" | "minor" = "minor";
  let bestSim = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    const rotated = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      rotated[i] = hist[(i + shift) % 12];
    }
    const simMajor = cosineSimilarity(rotated, MAJOR_PROFILE);
    const simMinor = cosineSimilarity(rotated, MINOR_PROFILE);
    if (simMajor > bestSim) { bestSim = simMajor; bestRoot = shift; bestMode = "major"; }
    if (simMinor > bestSim) { bestSim = simMinor; bestRoot = shift; bestMode = "minor"; }
  }

  return { root: bestRoot, mode: bestMode, confidence: Math.max(0, bestSim) };
}

/** Map a detected key to the closest ArpScale for the ArpEngine. */
export function keyToArpScale(mode: "major" | "minor"): ArpScale {
  return mode === "major" ? "major" : "minor";
}

// ─── Chord Detection ─────────────────────────────────────────────────────────
/** Detect chords at each step by collecting simultaneous notes across all
 *  parts in a scene. Returns a map of stepIndex → chord root + quality. */
export function detectChords(pattern: Pattern, sceneIdx = 0): Map<number, {
  root: number; type: string; notes: number[];
}> {
  const sc = pattern.scenes[sceneIdx];
  if (!sc) return new Map();
  const out = new Map<number, { root: number; type: string; notes: number[] }>();
  for (let step = 0; step < sc.length; step++) {
    const pitches: number[] = [];
    for (const partId of Object.keys(sc.partNotes)) {
      const notes = sc.partNotes[Number(partId)];
      if (!notes) continue;
      for (const n of notes) {
        if (n.step === step) pitches.push(((n.pitch % 12) + 12) % 12);
      }
    }
    if (pitches.length < 2) continue;
    const unique = [...new Set(pitches)].sort((a, b) => a - b);
    const root = unique[0];
    const intervals = unique.map((p) => (p - root + 12) % 12);
    let type = "unknown";
    if (intervals.includes(4) && intervals.includes(7)) type = "major";
    else if (intervals.includes(3) && intervals.includes(7)) type = "minor";
    else if (intervals.includes(3) && intervals.includes(6)) type = "dim";
    else if (intervals.includes(4) && intervals.includes(8)) type = "aug";
    else if (intervals.includes(2) && intervals.includes(7)) type = "sus2";
    else if (intervals.includes(5) && intervals.includes(7)) type = "sus4";
    out.set(step, { root, type, notes: unique });
  }
  return out;
}

// ─── Groove Summary ──────────────────────────────────────────────────────────
export interface GrooveSummary {
  density: number;
  swing: number;
  avgVelocity: number;
  timing: { microMin: number; microMax: number; microAvg: number; spread: number };
  humanize: { humMin: number; humMax: number; humAvg: number };
  key: { root: number; mode: "major" | "minor"; confidence: number };
  totalSteps: number;
  totalNotes: number;
  activeSteps: number;
  sceneCount: number;
}

/** Compute a full groove summary for the analysis tab / AI context. */
export function grooveSummary(pattern: Pattern): GrooveSummary {
  let totalSteps = 0, activeSteps = 0, totalNotes = 0;
  for (const sc of pattern.scenes) {
    for (const partId of Object.keys(sc.partSteps)) {
      const arr = sc.partSteps[Number(partId)];
      if (!arr) continue;
      for (const st of arr) { totalSteps++; if (st.on) activeSteps++; }
    }
    for (const partId of Object.keys(sc.partNotes)) {
      totalNotes += sc.partNotes[Number(partId)]?.length ?? 0;
    }
  }
  return {
    density: grooveDensity(pattern),
    swing: swingAmount(pattern),
    avgVelocity: avgVelocity(pattern),
    timing: timingAnalysis(pattern),
    humanize: humanizeAnalysis(pattern),
    key: detectKey(pattern),
    totalSteps,
    totalNotes,
    activeSteps,
    sceneCount: pattern.scenes.length,
  };
}

// Re-export SCALE_DEGREES for convenience.
export { SCALE_DEGREES };