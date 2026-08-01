// VibeCore AI — Music Theory Engine.
//
// Pure, deterministic music-theory utilities. No audio, no store, no side
// effects. All functions are referentially transparent — same inputs → same
// outputs. Used by every AI assistant for scale/chord/progression logic.
//
// Determinism: seeded helpers use mulberry32(hashSeed(...)) from the existing
// platform RNG — the same deterministic PRNG used by aiSceneBuild and arpEngine.

import { mulberry32, hashSeed, randInt, randRange, type Rng } from "@/lib/utils/random";
import type { ScaleType } from "./types";

// ── Scale tables (semitone intervals from root) ───────────────────────────────

export const SCALES: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_NAMES: Record<ScaleType, string> = {
  major: "Major", minor: "Natural Minor", dorian: "Dorian", phrygian: "Phrygian",
  lydian: "Lydian", mixolydian: "Mixolydian", harmonicMinor: "Harmonic Minor",
  minorPent: "Minor Pentatonic", majorPent: "Major Pentatonic", blues: "Blues",
  chromatic: "Chromatic",
};

// ── Chord shapes (semitone intervals from chord root) ─────────────────────────

export type ChordShape =
  | "maj" | "min" | "dim" | "aug" | "sus2" | "sus4" | "power"
  | "maj7" | "min7" | "dom7" | "dim7" | "min7b5" | "add9" | "maj9";

export const CHORD_SHAPES: Record<ChordShape, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  min7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 14],
  maj9: [0, 4, 7, 11, 14],
};

// ── Diatonic chord qualities per scale degree (for harmonisation) ────────────

/** For each scale degree (0..6), the natural chord quality in major/minor. */
export const DIATONIC_QUALITIES: Record<"major" | "minor", ChordShape[]> = {
  major: ["maj", "min", "min", "maj", "dom7", "min", "dim"],
  minor: ["min", "dim", "maj", "min", "min", "maj", "dom7"],
};

// ── Common progressions (scale-degree indices, 0 = I/i) ───────────────────────

export const PROGRESSIONS: Record<string, { degrees: number[]; label: string }> = {
  pop:       { degrees: [0, 4, 5, 3], label: "I–V–vi–IV (Pop)" },
  jazz:      { degrees: [1, 4, 0, 0], label: "ii–V–I (Jazz)" },
  classical: { degrees: [0, 3, 4, 0], label: "I–IV–V–I (Classical)" },
  minor:     { degrees: [0, 3, 6, 6], label: "i–iv–v (Minor)" },
  techno:    { degrees: [0, 0, 5, 5], label: "i–i–vi–vi (Techno)" },
  ambient:   { degrees: [0, 5, 3, 4], label: "I–vi–IV–V (Ambient)" },
  blues:     { degrees: [0, 0, 3, 3, 4, 4, 0, 0], label: "12-Bar Blues" },
  dnb:       { degrees: [0, 5, 3, 4], label: "i–vi–iv–V (DnB)" },
};

// ── Note naming ───────────────────────────────────────────────────────────────

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const m = Math.round(midi);
  const oct = Math.floor(m / 12) - 1;
  return NOTE_NAMES[((m % 12) + 12) % 12] + oct;
}

export function pitchClassName(midi: number): string {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
}

// ── Scale degree → MIDI pitch ─────────────────────────────────────────────────

/** Convert a scale degree (can be negative / span octaves) to a MIDI pitch. */
export function scaleDegreeToMidi(root: number, scale: ScaleType, degree: number): number {
  const intervals = SCALES[scale] ?? SCALES.minorPent;
  const n = intervals.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + octave * 12 + intervals[idx];
}

/** Check whether a MIDI pitch is in the given scale (any octave). */
export function isInScale(root: number, scale: ScaleType, midi: number): boolean {
  const intervals = SCALES[scale] ?? SCALES.minorPent;
  const pc = ((midi - root) % 12 + 12) % 12;
  return intervals.includes(pc);
}

// ── Chord construction ────────────────────────────────────────────────────────

/** Build chord pitches from a scale degree + chord shape. */
export function chordPitches(
  root: number, scale: ScaleType, degree: number, shape: ChordShape = "maj7",
): number[] {
  const chordRoot = scaleDegreeToMidi(root, scale, degree);
  return CHORD_SHAPES[shape].map((iv) => chordRoot + iv);
}

/** Diatonic chord for a scale degree (auto-selects quality from the scale). */
export function diatonicChord(
  root: number, scale: ScaleType, degree: number, seventh = false,
): number[] {
  const isMinorish = scale === "minor" || scale === "phrygian" || scale === "harmonicMinor"
    || scale === "dorian" || scale === "minorPent" || scale === "blues";
  const qualities = isMinorish ? DIATONIC_QUALITIES.minor : DIATONIC_QUALITIES.major;
  const shape = (qualities[degree % qualities.length] ?? "maj") as ChordShape;
  const finalShape = seventh
    ? (shape === "maj" ? "maj7" : shape === "min" ? "min7" : shape)
    : shape;
  return chordPitches(root, scale, degree, finalShape);
}

// ── Voicing helpers ───────────────────────────────────────────────────────────

/** Voice a chord around a target octave (spread notes, no clashing). */
export function voiceChord(pitches: number[], centerOctave = 4): number[] {
  const center = centerOctave * 12;
  return pitches.map((p) => {
    let midi = p;
    while (midi < center - 6) midi += 12;
    while (midi > center + 6) midi -= 12;
    return midi;
  });
}

// ── Progression builder ───────────────────────────────────────────────────────

/** Build a chord progression from scale-degree indices. Returns pitched chords. */
export function buildProgression(
  root: number, scale: ScaleType, degrees: number[], seventh = false,
): number[][] {
  return degrees.map((d) => diatonicChord(root, scale, d, seventh));
}

// ── Deterministic RNG helpers ─────────────────────────────────────────────────

export function makeRng(seed: number, salt = 0): Rng {
  return mulberry32(hashSeed(seed, salt));
}

export { randInt, randRange, mulberry32 };
export { hashSeed as hashInt };

// ── Suggestion id (deterministic) ─────────────────────────────────────────────

/** Deterministic suggestion id — same kind + same seed → same id.
 *  No mutable counter: callers differentiate batch items via distinct seeds
 *  (e.g. `seed + part.id`). This guarantees reproducibility across sessions. */
export function suggestionId(kind: string, seed: number): string {
  return `ai_${kind}_${seed.toString(36)}`;
}

// ── Energy / density inference ───────────────────────────────────────────────

import type { Step } from "@/lib/model";

/** Infer rhythmic density (0..1) from a step array. */
export function inferDensity(steps: Step[]): number {
  if (!steps.length) return 0;
  const active = steps.filter((s) => s.on).length;
  return active / steps.length;
}

/** Infer musical energy (0..1) from density + average velocity. */
export function inferEnergy(steps: Step[]): number {
  if (!steps.length) return 0;
  const active = steps.filter((s) => s.on);
  if (!active.length) return 0;
  const avgVel = active.reduce((sum, s) => sum + s.velocity, 0) / active.length;
  const density = active.length / steps.length;
  return Math.min(1, density * 0.6 + (avgVel / 127) * 0.4);
}