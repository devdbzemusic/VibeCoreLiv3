// VibeCore AI — Remix Assistant.
//
// Erzeugt Remix-Ideen, Stem-Variationen, Mashups und Übergänge. Die AI kennt
// keine Stems direkt — sie schlägt Arrangement-Strukturen und Variationen vor,
// die über `setChainSteps` / `setNotes` / `setPatternSteps` angewendet werden.

import type { ChainStep } from "@/lib/model";
import type { ContextSnapshot, Suggestion, RemixPayload } from "./types";
import { makeRng, suggestionId, randInt } from "./engine";

export interface RemixOpts {
  seed?: number;
  genre?: string;
}

export function suggestRemixIdea(
  ctx: ContextSnapshot, opts: RemixOpts = {},
): Suggestion<RemixPayload> {
  const seed = opts.seed ?? 110100;
  const rng = makeRng(seed, 1);
  const genre = opts.genre ?? "techno";
  const numPatterns = ctx.patterns.length;

  const approaches = [
    "Strip the arrangement to drums + bass, rebuild with new melodies.",
    "Chop the vocal into a rhythmic stutter and layer over a new groove.",
    "Reverse the original progression and build a new drop on the turnaround.",
    "Layer the original stems over a new drum pattern for a genre flip.",
    "Create a dub version — heavy delays, sparse arrangement, filtered drops.",
  ];
  const idea = approaches[randInt(rng, 0, approaches.length - 1)];

  const chainSteps: ChainStep[] = [
    { patternId: 0, repeat: 4, marker: "INTRO" },
    { patternId: Math.min(1, numPatterns - 1), repeat: 4, marker: "BUILD" },
    { patternId: Math.min(2, numPatterns - 1), repeat: 8, marker: "DROP" },
    { patternId: Math.min(1, numPatterns - 1), repeat: 4, marker: "BREAK" },
    { patternId: Math.min(2, numPatterns - 1), repeat: 8, marker: "DROP 2" },
  ];

  return {
    id: suggestionId("remix", seed), kind: "remix", label: `${genre} Remix Idea`,
    description: idea, confidence: 0.6, seed,
    payload: { idea, chainSteps },
  };
}

export function suggestStemVariation(
  ctx: ContextSnapshot, partId: number, opts: RemixOpts = {},
): Suggestion<RemixPayload> {
  const seed = opts.seed ?? 120100 + partId;
  const rng = makeRng(seed, 5);
  const variations = [
    "Octave-shift the part for a new register.",
    "Add rhythmic chopping / gating for a stutter effect.",
    "Reverse the part and layer under the original.",
    "Filter-sweep the part for textural movement.",
    "Humanize the timing and velocity for a looser feel.",
  ];
  const desc = variations[randInt(rng, 0, variations.length - 1)];

  return {
    id: suggestionId("remix", seed), kind: "remix", label: `Stem Variation (Part ${partId + 1})`,
    description: desc, confidence: 0.55, seed,
    payload: { idea: desc, variations: [{ partId, description: desc }] },
  };
}

export function suggestMashup(
  ctx: ContextSnapshot, patternA: number, patternB: number, opts: RemixOpts = {},
): Suggestion<RemixPayload> {
  const seed = opts.seed ?? 130100;
  const numPatterns = ctx.patterns.length;
  // Clamp pattern indices to valid range — prevents orphan chain references
  // that would point to non-existent patterns after setChainSteps.
  const a = Math.max(0, Math.min(numPatterns - 1, patternA));
  const b = Math.max(0, Math.min(numPatterns - 1, patternB));

  const chainSteps: ChainStep[] = [
    { patternId: a, repeat: 4, marker: "A" },
    { patternId: b, repeat: 4, marker: "B" },
    { patternId: a, repeat: 2, marker: "A'" },
    { patternId: b, repeat: 2, marker: "B'" },
    { patternId: Math.min(numPatterns - 1, a + 1), repeat: 4, marker: "MASH" },
  ];

  return {
    id: suggestionId("remix", seed), kind: "remix", label: "Mashup",
    description: `Alternating A/B structure — pattern ${a + 1} and ${b + 1} layered into a mashup drop.`,
    confidence: 0.6, seed,
    payload: { idea: `Mashup of patterns ${a + 1} + ${b + 1}`, chainSteps },
  };
}

export function suggestRemixTransition(
  ctx: ContextSnapshot, opts: RemixOpts = {},
): Suggestion<RemixPayload> {
  const seed = opts.seed ?? 140100;
  const rng = makeRng(seed, 11);
  const transitions = [
    "Filter sweep down + reverse reverb swell into the next section.",
    "Beat-roll buildup (16th snare roll) into a drop.",
    "Silence (1 bar) then full-energy re-entry.",
    "Vocal chop stutter building in intensity.",
    "White-noise riser + kick drum buildup.",
  ];
  const desc = transitions[randInt(rng, 0, transitions.length - 1)];

  return {
    id: suggestionId("remix", seed), kind: "remix", label: "Remix Transition",
    description: desc, confidence: 0.55, seed,
    payload: { idea: desc },
  };
}