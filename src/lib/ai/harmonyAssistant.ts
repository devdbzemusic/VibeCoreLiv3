// VibeCore AI — Harmony Assistant.
//
// Erzeugt Akkord-, Progressions-, Modulations- und Voicing-Vorschläge basierend
// auf dem Harmoniekontext (Tonart + Skala aus ArpEngine). Alle Funktionen sind
// pure + deterministisch. Vorschläge werden über `setNotes` auf Pad/Synth-Parts
// angewendet (immutable → rückgängig).

import type { Note } from "@/lib/model";
import type { ContextSnapshot, Suggestion, HarmonyPayload, ScaleType } from "./types";
import {
  buildProgression, voiceChord, diatonicChord,
  suggestionId, PROGRESSIONS, type ChordShape,
} from "./engine";

export interface HarmonyOpts {
  seed?: number;
  mood?: keyof typeof PROGRESSIONS;
  bars?: number;
  seventh?: boolean;
  shape?: ChordShape;
  degree?: number;
}

export function suggestProgression(
  ctx: ContextSnapshot, opts: HarmonyOpts = {},
): Suggestion<HarmonyPayload> {
  const seed = opts.seed ?? 0xA8000;
  const mood = opts.mood ?? "pop";
  const bars = opts.bars ?? 4;
  const prog = PROGRESSIONS[mood] ?? PROGRESSIONS.pop;
  const root = ctx.harmony.root + 48;
  const scale = ctx.harmony.scale;

  const progression = buildProgression(root, scale, prog.degrees, opts.seventh ?? true);
  const voicing = progression.map((chord) => voiceChord(chord, 4));

  return {
    id: suggestionId("harmony", seed), kind: "harmony", label: prog.label,
    description: `${bars}-bar progression in ${scale} — ${prog.degrees.length} chords voiced around octave 4.`,
    confidence: 0.7, seed,
    payload: { progression, voicing, scale, root: ctx.harmony.root },
  };
}

export function suggestChord(
  ctx: ContextSnapshot, opts: HarmonyOpts = {},
): Suggestion<HarmonyPayload> {
  const seed = opts.seed ?? 0xC0000;
  const degree = opts.degree ?? 0;
  const root = ctx.harmony.root + 48;
  const scale = ctx.harmony.scale;

  const progression = [diatonicChord(root, scale, degree, true)];
  const voicing = progression.map((c) => voiceChord(c, 4));

  return {
    id: suggestionId("harmony", seed), kind: "harmony",
    label: `Chord (degree ${degree + 1})`,
    description: `Diatonic chord on scale degree ${degree + 1} in ${scale}.`,
    confidence: 0.7, seed,
    payload: { progression, voicing, scale, root: ctx.harmony.root },
  };
}

export function suggestVoicing(
  ctx: ContextSnapshot, chord: number[], octave = 4,
): Suggestion<HarmonyPayload> {
  const seed = 0x01C00;
  const sorted = [...chord].sort((a, b) => a - b);
  let voiced = voiceChord(chord, octave);
  if (sorted.length >= 3) {
    const drop2 = sorted[sorted.length - 2] - 12;
    voiced = [sorted[0], drop2, sorted[sorted.length - 1]];
  }

  return {
    id: suggestionId("harmony", seed), kind: "harmony", label: "Drop-2 Voicing",
    description: "Drop-2 voicing — the 2nd-highest note moves down an octave for a warmer, more open sound.",
    confidence: 0.6, seed,
    payload: { progression: [chord], voicing: [voiced], scale: ctx.harmony.scale, root: ctx.harmony.root },
  };
}

export function suggestModulation(
  ctx: ContextSnapshot, targetRoot: number, targetScale?: ScaleType,
): Suggestion<HarmonyPayload> {
  const seed = 0x0D000;
  const scale = targetScale ?? ctx.harmony.scale;
  const pivotRoot = ctx.harmony.root + 48;
  const targetRootMidi = targetRoot + 48;
  const progression = [
    diatonicChord(pivotRoot, ctx.harmony.scale, 4, true),
    diatonicChord(targetRootMidi, scale, 0, true),
    diatonicChord(targetRootMidi, scale, 3, true),
    diatonicChord(targetRootMidi, scale, 0, true),
  ];
  const voicing = progression.map((c) => voiceChord(c, 4));

  return {
    id: suggestionId("harmony", seed), kind: "harmony", label: "Modulation",
    description: `Pivot-chord modulation → ${targetRoot} ${scale}. V(current) → I(target) → IV → I.`,
    confidence: 0.6, seed,
    payload: { progression, voicing, scale, root: targetRoot },
  };
}

export function harmonyToNotes(
  payload: HarmonyPayload, bars: number, stepsPerBar = 16,
): Omit<Note, "id">[] {
  const notes: Omit<Note, "id">[] = [];
  const chordLen = stepsPerBar;
  for (let bar = 0; bar < bars; bar++) {
    const chord = payload.voicing[bar % payload.voicing.length];
    if (!chord) continue;
    for (const pitch of chord) {
      notes.push({ step: bar * stepsPerBar, pitch, length: chordLen, velocity: 65 });
    }
  }
  return notes;
}