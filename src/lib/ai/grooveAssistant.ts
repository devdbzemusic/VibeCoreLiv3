// VibeCore AI — Groove Assistant.
//
// Erweitert die bestehende `aiSceneBuild.buildGroove` Engine (VibeCore Sync)
// um koordinierte Groove-Vorschläge, Fills, Variationen, Mutationen, Humanize
// und Genre-Anpassung. Die AI erzeugt ausschließlich Vorschläge (Suggestions) —
// keine direkten Mutationen. Der Nutzer bestätigt, die UI wendet über
// `setPatternSteps` an (immutable → rückgängig).
//
// Determinismus: jede Funktion nimmt einen `seed`. Gleicher Seed + gleicher
// Kontext → identischer Output (mulberry32 / hashSeed).

import { buildGroove, type ScenebuildStyle } from "@/lib/audio/aiSceneBuild";
import { emptyStep, type Step, type PartCategory } from "@/lib/model";
import type { ContextSnapshot, Suggestion, GroovePayload } from "./types";
import { makeRng, suggestionId, randInt } from "./engine";

export interface GrooveOpts {
  seed?: number;
  density?: number;
  style?: ScenebuildStyle;
  existing?: Partial<Record<PartCategory, Step[]>>;
}

const RHYTHM_CATS: PartCategory[] = ["kick", "snare", "hat", "perc"];

export function suggestGroove(
  ctx: ContextSnapshot, opts: GrooveOpts = {},
): Suggestion<GroovePayload> {
  const seed = opts.seed ?? 0xA1004E;
  const density = opts.density ?? ctx.density;
  const length = ctx.sceneLength;

  const existing: Partial<Record<PartCategory, Step[]>> = {};
  if (ctx.currentScene) {
    for (const cat of RHYTHM_CATS) {
      const part = ctx.parts.find((p) => p.category === cat);
      if (part) existing[cat] = ctx.currentScene.partSteps[part.id] ?? [];
    }
  }

  const groove = buildGroove({ seed, density, length, style: opts.style, existing: opts.existing ?? existing });

  const stepsByPart: Record<number, Step[]> = {};
  for (const cat of RHYTHM_CATS) {
    const part = ctx.parts.find((p) => p.category === cat);
    if (part) stepsByPart[part.id] = groove[cat] ?? Array.from({ length }, emptyStep);
  }

  return {
    id: suggestionId("groove", seed), kind: "groove", label: "Coordinated Groove",
    description: `Drum groove for ${RHYTHM_CATS.length} parts at density ${(density * 100).toFixed(0)}% — kick anchors, snare backbeats, hats fill, perc accents.`,
    confidence: 0.75, seed, payload: { stepsByPart },
  };
}

export function suggestFill(
  ctx: ContextSnapshot, opts: GrooveOpts = {},
): Suggestion<GroovePayload> {
  const seed = opts.seed ?? 0xF110;
  const length = ctx.sceneLength;
  const rng = makeRng(seed, 77);
  const fillLen = Math.min(4, length);
  const fillStart = length - fillLen;

  const stepsByPart: Record<number, Step[]> = {};
  const snarePart = ctx.parts.find((p) => p.category === "snare");
  const hatPart = ctx.parts.find((p) => p.category === "hat");

  if (snarePart) {
    const existing = ctx.currentScene?.partSteps[snarePart.id] ?? Array.from({ length }, emptyStep);
    const arr = existing.map((s) => ({ ...s }));
    for (let i = fillStart; i < length; i++) {
      arr[i] = { ...arr[i], on: true, velocity: 90 + randInt(rng, 0, 30), accent: i === length - 1 };
    }
    stepsByPart[snarePart.id] = arr;
  }
  if (hatPart) {
    const existing = ctx.currentScene?.partSteps[hatPart.id] ?? Array.from({ length }, emptyStep);
    const arr = existing.map((s) => ({ ...s }));
    for (let i = fillStart; i < length; i++) {
      if (rng() > 0.3) arr[i] = { ...arr[i], on: true, velocity: 70 + randInt(rng, 0, 20), ratchet: rng() > 0.5 ? 2 : 1 };
    }
    stepsByPart[hatPart.id] = arr;
  }

  return {
    id: suggestionId("groove", seed), kind: "groove", label: "Snare Fill",
    description: `Fill in the last ${fillLen} steps — dense snare roll with hat ratchets leading into the next bar.`,
    confidence: 0.7, seed, payload: { stepsByPart },
  };
}

export function suggestVariation(
  ctx: ContextSnapshot, opts: GrooveOpts = {},
): Suggestion<GroovePayload> {
  const seed = opts.seed ?? 0x4A100;
  const length = ctx.sceneLength;
  const rng = makeRng(seed, 99);
  const mutationRate = 0.15;

  const stepsByPart: Record<number, Step[]> = {};
  for (const cat of RHYTHM_CATS) {
    const part = ctx.parts.find((p) => p.category === cat);
    if (!part) continue;
    const existing = ctx.currentScene?.partSteps[part.id] ?? Array.from({ length }, emptyStep);
    stepsByPart[part.id] = existing.map((s) => {
      const ns = { ...s };
      if (rng() < mutationRate) ns.on = !ns.on;
      if (ns.on && rng() < 0.3) ns.velocity = Math.max(20, Math.min(127, ns.velocity + randInt(rng, -12, 12)));
      return ns;
    });
  }

  return {
    id: suggestionId("groove", seed), kind: "groove", label: "Groove Variation",
    description: `Stochastic mutation (${(mutationRate * 100).toFixed(0)}% step toggle + velocity jitter).`,
    confidence: 0.6, seed, payload: { stepsByPart },
  };
}

export function suggestHumanize(
  ctx: ContextSnapshot, opts: GrooveOpts = {},
): Suggestion<GroovePayload> {
  const seed = opts.seed ?? 0xA8001;
  const length = ctx.sceneLength;
  const rng = makeRng(seed, 55);
  const stepsByPart: Record<number, Step[]> = {};

  for (const cat of RHYTHM_CATS) {
    const part = ctx.parts.find((p) => p.category === cat);
    if (!part) continue;
    const existing = ctx.currentScene?.partSteps[part.id] ?? Array.from({ length }, emptyStep);
    stepsByPart[part.id] = existing.map((s) => {
      if (!s.on) return s;
      return { ...s, velocity: Math.max(20, Math.min(127, s.velocity + randInt(rng, -8, 8))) };
    });
  }

  return {
    id: suggestionId("groove", seed), kind: "groove", label: "Humanize Velocities",
    description: "Subtle per-hit velocity jitter (±8). Timing unchanged — swing stays with the scheduler.",
    confidence: 0.65, seed, payload: { stepsByPart },
  };
}

export function suggestGenreAdaptation(
  ctx: ContextSnapshot, genre: string, opts: GrooveOpts = {},
): Suggestion<GroovePayload> {
  const seed = opts.seed ?? (0x40000 | (genre.charCodeAt(0) << 8));
  const styleMap: Record<string, ScenebuildStyle> = {
    techno: "techno", house: "fourFloor", minimal: "minimal", trap: "trap",
    breaks: "breaks", ambient: "ambient", dnb: "breaks", acid: "techno",
  };
  const style = styleMap[genre] ?? "fourFloor";
  const density = genre === "ambient" ? 0.2 : genre === "minimal" ? 0.3 : 0.6;
  return suggestGroove(ctx, { ...opts, seed, density, style });
}