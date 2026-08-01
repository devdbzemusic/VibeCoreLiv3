// VibeCore AI — Arrangement Assistant.
//
// Erzeugt Songstruktur-, Pattern-Chain- und Song-Mode-Vorschläge. Arbeitet
// mit ChainStep[] (enhanced Pattern Chain), die über `setChainSteps` angewendet
// werden (immutable → rückgängig). Die AI kennt keine Patterns selbst — sie
// schlägt eine Anordnung bestehender Patterns vor.

import type { ChainStep } from "@/lib/model";
import type { ContextSnapshot, Suggestion, ArrangementPayload, ArrangementSection } from "./types";
import { makeRng, suggestionId, randInt } from "./engine";
import { GENRE_PRESETS } from "./presets";

export interface ArrangementOpts {
  seed?: number;
  genre?: string;
  bars?: number;
}

/** Standard song structures per genre. */
const STRUCTURES: Record<string, Array<{ name: string; bars: number; energy: number }>> = {
  techno: [
    { name: "INTRO", bars: 8, energy: 0.3 },
    { name: "BUILD", bars: 8, energy: 0.6 },
    { name: "DROP", bars: 16, energy: 0.9 },
    { name: "BREAK", bars: 8, energy: 0.4 },
    { name: "DROP", bars: 16, energy: 0.9 },
    { name: "OUTRO", bars: 8, energy: 0.3 },
  ],
  house: [
    { name: "INTRO", bars: 8, energy: 0.3 },
    { name: "GROOVE", bars: 16, energy: 0.6 },
    { name: "DROP", bars: 16, energy: 0.85 },
    { name: "BREAK", bars: 8, energy: 0.4 },
    { name: "OUTRO", bars: 8, energy: 0.3 },
  ],
  dnb: [
    { name: "INTRO", bars: 8, energy: 0.4 },
    { name: "BUILD", bars: 8, energy: 0.7 },
    { name: "DROP", bars: 16, energy: 0.9 },
    { name: "LIQUID", bars: 16, energy: 0.6 },
    { name: "DROP", bars: 16, energy: 0.9 },
  ],
  ambient: [
    { name: "DRIFT", bars: 16, energy: 0.2 },
    { name: "RISE", bars: 16, energy: 0.4 },
    { name: "SETTLE", bars: 16, energy: 0.3 },
  ],
  pop: [
    { name: "VERSE", bars: 8, energy: 0.5 },
    { name: "CHORUS", bars: 8, energy: 0.8 },
    { name: "VERSE", bars: 8, energy: 0.5 },
    { name: "CHORUS", bars: 8, energy: 0.8 },
    { name: "BRIDGE", bars: 8, energy: 0.6 },
    { name: "CHORUS", bars: 8, energy: 0.85 },
  ],
};

/** Suggest a song structure for a genre (maps existing patterns to sections). */
export function suggestSongStructure(
  ctx: ContextSnapshot, opts: ArrangementOpts = {},
): Suggestion<ArrangementPayload> {
  const seed = opts.seed ?? 180000;
  const genre = opts.genre ?? "techno";
  const rng = makeRng(seed, 21);
  const structure = STRUCTURES[genre] ?? STRUCTURES.techno;
  const numPatterns = ctx.patterns.length;

  // Map patterns to sections — cycle through available patterns, preferring
  // higher-indexed patterns for high-energy sections.
  const sections: ArrangementSection[] = structure.map((sec) => {
    const energyIdx = Math.floor(sec.energy * numPatterns);
    const patternId = Math.max(0, Math.min(numPatterns - 1, energyIdx + randInt(rng, -1, 1)));
    return { name: sec.name, patternId, repeat: 1, bars: sec.bars };
  });

  const chainSteps: ChainStep[] = sections.map((s) => ({
    patternId: s.patternId,
    repeat: s.repeat,
    marker: s.name,
  }));

  return {
    id: suggestionId("arrangement", seed), kind: "arrangement",
    label: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Arrangement`,
    description: `${sections.length}-section arrangement: ${sections.map((s) => s.name).join(" → ")}. Uses ${numPatterns} existing patterns.`,
    confidence: 0.7, seed,
    payload: { chainSteps, structure: sections },
  };
}

/** Suggest a chain arrangement from a genre preset's structure. */
export function suggestChainArrangement(
  ctx: ContextSnapshot, opts: ArrangementOpts = {},
): Suggestion<ArrangementPayload> {
  const seed = opts.seed ?? 190000;
  const genre = opts.genre ?? "techno";
  const preset = GENRE_PRESETS.find((p) => p.name === genre);
  const presetStructure = preset?.payload.structure;

  if (presetStructure && presetStructure.length) {
    const chainSteps: ChainStep[] = presetStructure.map((s) => ({
      patternId: Math.min(s.patternId, ctx.patterns.length - 1),
      repeat: s.repeat,
      marker: s.name,
    }));
    return {
      id: suggestionId("arrangement", seed), kind: "arrangement",
      label: `${preset.label} Chain`,
      description: `Chain from the ${preset.label} preset — ${presetStructure.length} sections.`,
      confidence: 0.7, seed,
      payload: { chainSteps, structure: presetStructure },
    };
  }

  return suggestSongStructure(ctx, { ...opts, seed });
}

/** Suggest a transition between two patterns (short bridge). */
export function suggestTransition(
  ctx: ContextSnapshot, fromPattern: number, toPattern: number, opts: ArrangementOpts = {},
): Suggestion<ArrangementPayload> {
  const seed = opts.seed ?? 200000;
  const rng = makeRng(seed, 44);
  const bridgeBars = randInt(rng, 2, 4);
  const bridgePattern = Math.min(fromPattern, toPattern);

  const sections: ArrangementSection[] = [
    { name: "TRANSITION", patternId: bridgePattern, repeat: 1, bars: bridgeBars },
  ];
  const chainSteps: ChainStep[] = [
    { patternId: fromPattern, repeat: 1, marker: "OUT" },
    { patternId: bridgePattern, repeat: 1, marker: "BRIDGE" },
    { patternId: toPattern, repeat: 1, marker: "IN" },
  ];

  return {
    id: suggestionId("arrangement", seed), kind: "arrangement",
    label: "Pattern Transition",
    description: `${bridgeBars}-bar bridge transition from pattern ${fromPattern + 1} → ${toPattern + 1}.`,
    confidence: 0.6, seed,
    payload: { chainSteps, structure: sections },
  };
}