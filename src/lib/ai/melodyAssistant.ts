// VibeCore AI — Melody Assistant.
//
// Erweitert die bestehende `aiSceneBuild.buildMelody` Engine um Melodie-,
// Bass-, Pad-, Counter-Melody-, Hook- und Arpeggio-Vorschläge. Alle Funktionen
// sind pure + deterministisch (seed-basiert). Vorschläge werden über `setNotes`
// / `replaceNotes` angewendet (immutable → vollständig rückgängig).

import { buildMelody, type MelodyScale } from "@/lib/audio/aiSceneBuild";
import type { Note } from "@/lib/model";
import type { ArpConfig, ArpScale } from "@/lib/audio/arpEngine";
import type { ContextSnapshot, Suggestion, MelodyPayload, ScaleType } from "./types";
import { voiceChord, diatonicChord, makeRng, suggestionId, randInt, randRange } from "./engine";
import { kickHitsInScene } from "./context";

/** Map AI ScaleType → ArpEngine ArpScale (scales without an arp equivalent map to "minor"). */
const SCALE_TO_ARP: Record<ScaleType, ArpScale> = {
  minor: "minor", major: "major", dorian: "minor", phrygian: "phrygian",
  lydian: "major", mixolydian: "major", harmonicMinor: "minor",
  minorPent: "minorPent", majorPent: "majorPent", blues: "minorPent", chromatic: "minor",
};

const SCALE_TO_MELODY: Record<ScaleType, MelodyScale> = {
  major: "major", minor: "naturalMinor", dorian: "dorian", phrygian: "phrygian",
  lydian: "major", mixolydian: "major", harmonicMinor: "naturalMinor",
  minorPent: "minorPent", majorPent: "majorPent", blues: "minorPent", chromatic: "minorPent",
};

export interface MelodyOpts {
  seed?: number;
  density?: number;
  scale?: ScaleType;
  rootMidi?: number;
}

function findSynthPart(ctx: ContextSnapshot): number {
  return ctx.parts.find((p) => p.category === "synth")?.id
    ?? ctx.parts.find((p) => p.category === "sample")?.id ?? 8;
}

function findBassPart(ctx: ContextSnapshot): number {
  return ctx.parts.find((p) => p.category === "bass")?.id ?? 6;
}

export function suggestMelody(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<MelodyPayload> {
  const seed = opts.seed ?? 0xE1000;
  const partId = findSynthPart(ctx);
  const scale = opts.scale ?? ctx.harmony.scale;
  const rootMidi = (opts.rootMidi ?? 60) + ctx.harmony.root;
  const density = opts.density ?? 0.6;

  const notes = buildMelody({
    seed, scale: SCALE_TO_MELODY[scale] ?? "minorPent",
    rootMidi, density, length: ctx.sceneLength, category: "synth",
  });

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Lead Melody",
    description: `Motif call & response over ${ctx.sceneLength} steps. Resolves to root on bar lines.`,
    confidence: 0.7, seed, payload: { partId, notes },
  };
}

export function suggestBassline(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<MelodyPayload> {
  const seed = opts.seed ?? 0xBA550;
  const partId = findBassPart(ctx);
  const scale = opts.scale ?? ctx.harmony.scale;
  const rootMidi = (opts.rootMidi ?? 36) + ctx.harmony.root;
  const kickHits = kickHitsInScene(ctx);

  const notes = buildMelody({
    seed, scale: SCALE_TO_MELODY[scale] ?? "minorPent",
    rootMidi, density: 0.5, length: ctx.sceneLength, category: "bass", kickHits,
  });

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Bassline",
    description: `Bass locked to ${kickHits.length} kick hits — root-driven, sparse, groove-solid.`,
    confidence: 0.75, seed, payload: { partId, notes },
  };
}

export function suggestPad(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<MelodyPayload> {
  const seed = opts.seed ?? 0xAD000;
  const partId = findSynthPart(ctx);
  const rng = makeRng(seed, 42);
  const root = ctx.harmony.root + 48;
  const chord = diatonicChord(root, ctx.harmony.scale, 0, true);
  const voiced = voiceChord(chord, 4);
  const length = ctx.sceneLength;

  const notes: Omit<Note, "id">[] = voiced.map((pitch) => ({
    step: 0, pitch, length, velocity: Math.round(60 + randRange(rng, 0, 15)),
  }));

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Sustained Pad",
    description: `Held ${voiced.length}-note chord across the full scene with a gentle velocity swell.`,
    confidence: 0.6, seed, payload: { partId, notes },
  };
}

export function suggestCounterMelody(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<MelodyPayload> {
  const seed = (opts.seed ?? 0xE1000) ^ 0xC0FFEE;
  const partId = ctx.parts.find((p) => p.category === "synth" && p.id !== findSynthPart(ctx))?.id
    ?? ctx.parts.find((p) => p.category === "sample")?.id ?? 10;
  const scale = opts.scale ?? ctx.harmony.scale;
  const rootMidi = ((opts.rootMidi ?? 67) + ctx.harmony.root);

  const notes = buildMelody({
    seed, scale: SCALE_TO_MELODY[scale] ?? "minorPent",
    rootMidi, density: 0.4, length: ctx.sceneLength, category: "synth",
  });

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Counter Melody",
    description: "Complementary melodic line in a higher register — call & response with the lead.",
    confidence: 0.6, seed, payload: { partId, notes },
  };
}

export function suggestHook(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<MelodyPayload> {
  const seed = opts.seed ?? 0xA0C00;
  const partId = findSynthPart(ctx);
  const scale = opts.scale ?? ctx.harmony.scale;
  const rootMidi = (opts.rootMidi ?? 64) + ctx.harmony.root;

  const notes = buildMelody({
    seed: seed ^ 0xABCD, scale: SCALE_TO_MELODY[scale] ?? "minorPent",
    rootMidi, density: 0.75, length: ctx.sceneLength, category: "synth",
  });

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Hook",
    description: "Short, high-density melodic phrase designed to be memorable and energetic.",
    confidence: 0.65, seed, payload: { partId, notes },
  };
}

export function suggestArpeggio(
  ctx: ContextSnapshot, opts: MelodyOpts = {},
): Suggestion<Partial<ArpConfig>> {
  const seed = opts.seed ?? 0xA8A00;
  const rng = makeRng(seed, 13);
  const modes: ArpConfig["mode"][] = ["UP", "DOWN", "UPDOWN", "SPIRAL", "ORBIT", "DNA"];
  const mode = modes[randInt(rng, 0, modes.length - 1)];

  const arpPatch: Partial<ArpConfig> = {
    enabled: true, mode,
    complexity: Math.round(30 + randRange(rng, 0, 50)),
    rootNote: 36 + ctx.harmony.root,
    scale: SCALE_TO_ARP[ctx.harmony.scale] ?? "minor",
    octaves: randInt(rng, 2, 3),
    vibeControl: Math.round(40 + randRange(rng, 0, 30)),
    state: "Smart",
  };

  return {
    id: suggestionId("melody", seed), kind: "melody", label: "Arpeggio",
    description: `Arp config — mode: ${mode}, complexity: ${arpPatch.complexity}, ${arpPatch.octaves} octaves.`,
    confidence: 0.65, seed, payload: arpPatch,
  };
}