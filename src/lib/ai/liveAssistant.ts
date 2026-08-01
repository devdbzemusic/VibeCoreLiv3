// VibeCore AI — Live Performance Assistant.
//
// Während der Wiedergabe unterstützt die AI mit Live-Vorschlägen (Fill,
// Variation, Break, FX, Pattern-Switch, Arp). Alle Vorschläge erscheinen als
// Aktionen und werden nur nach Bestätigung übernommen.
//
// Realtime: alle Berechnungen laufen auf dem Control-Thread (rAF / setInterval),
// NIEMALS auf dem Audio-Thread. Die AI blockiert den Audiopfad nie.

import type { ArpConfig } from "@/lib/audio/arpEngine";
import type { ContextSnapshot, Suggestion, LivePayload } from "./types";
import { emptyStep, type Step } from "@/lib/model";
import { makeRng, suggestionId, randInt } from "./engine";
import { suggestFill, suggestVariation } from "./grooveAssistant";

export interface LiveOpts {
  seed?: number;
  position?: number;
}

export function suggestLiveFill(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? (110000 | randInt(makeRng(Date.now() >>> 0, 1), 0, 0xFFFF));
  const fill = suggestFill(ctx, { seed });
  return {
    id: suggestionId("live", seed), kind: "live", label: "Live Fill",
    description: fill.description, confidence: 0.7, seed,
    payload: { action: "fill", description: fill.description, stepsByPart: fill.payload.stepsByPart },
  };
}

export function suggestLiveVariation(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? (120000 | randInt(makeRng(Date.now() >>> 0, 2), 0, 0xFFFF));
  const variation = suggestVariation(ctx, { seed });
  return {
    id: suggestionId("live", seed), kind: "live", label: "Live Variation",
    description: variation.description, confidence: 0.6, seed,
    payload: { action: "variation", description: variation.description, stepsByPart: variation.payload.stepsByPart },
  };
}

export function suggestLiveBreak(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? 130000;
  const length = ctx.sceneLength;
  const rng = makeRng(seed, 21);

  const stepsByPart: Record<number, Step[]> = {};
  for (const part of ctx.parts) {
    if (part.category === "kick" || part.category === "snare" || part.category === "hat") {
      const arr = Array.from({ length }, emptyStep);
      if (rng() > 0.5) {
        const idx = randInt(rng, 0, length - 1);
        arr[idx] = { ...arr[idx], on: true, velocity: 60 };
      }
      stepsByPart[part.id] = arr;
    }
  }

  return {
    id: suggestionId("live", seed), kind: "live", label: "Live Break",
    description: "Strip drums back to near-silence — creates tension before the drop.",
    confidence: 0.65, seed,
    payload: { action: "break", description: "Strip drums back", stepsByPart },
  };
}

export function suggestLiveFX(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? 140000;
  const rng = makeRng(seed, 33);
  const fxIdx = randInt(rng, 0, 5);
  const actions = ["Open filter", "Send to reverb", "Add delay", "Stereo widen", "Drive boost"] as const;
  const action = actions[randInt(rng, 0, actions.length - 1)];

  return {
    id: suggestionId("live", seed), kind: "live", label: `Live FX: ${action}`,
    description: `${action} on FX slot ${String.fromCharCode(65 + fxIdx)} — momentary tweak for energy.`,
    confidence: 0.5, seed,
    payload: { action: "fx", description: action },
  };
}

export function suggestLivePatternSwitch(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? 150000;
  const rng = makeRng(seed, 41);
  const numPatterns = ctx.patterns.length;
  const current = ctx.currentPattern;
  let target = current;
  while (target === current && numPatterns > 1) {
    target = randInt(rng, 0, numPatterns - 1);
  }

  return {
    id: suggestionId("live", seed), kind: "live", label: `Switch to Pattern ${target + 1}`,
    description: `Queue pattern ${target + 1} for the next bar boundary — keeps the energy moving.`,
    confidence: 0.55, seed,
    payload: { action: "pattern_switch", description: `Switch to pattern ${target + 1}`, targetPattern: target },
  };
}

export function suggestLiveArp(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload> {
  const seed = opts.seed ?? 160000;
  const rng = makeRng(seed, 55);
  const modes: ArpConfig["mode"][] = ["UP", "DOWN", "UPDOWN", "SPIRAL"];
  const mode = modes[randInt(rng, 0, modes.length - 1)];
  const arpPatch: Partial<ArpConfig> = {
    enabled: true, mode, complexity: 50 + randInt(rng, 0, 30),
    state: "Smart", vibeControl: 60,
  };

  return {
    id: suggestionId("live", seed), kind: "live", label: `Live Arp: ${mode}`,
    description: `Trigger an arpeggio burst — mode ${mode}, high complexity for energy.`,
    confidence: 0.5, seed,
    payload: { action: "arp", description: `Arp burst: ${mode}`, arpPatch },
  };
}

export function suggestLiveSet(
  ctx: ContextSnapshot, opts: LiveOpts = {},
): Suggestion<LivePayload>[] {
  if (!ctx.playing) return [];
  const baseSeed = opts.seed ?? Date.now() >>> 0;
  return [
    suggestLiveFill(ctx, { ...opts, seed: baseSeed }),
    suggestLiveVariation(ctx, { ...opts, seed: baseSeed + 1 }),
    suggestLiveFX(ctx, { ...opts, seed: baseSeed + 2 }),
    suggestLivePatternSwitch(ctx, { ...opts, seed: baseSeed + 3 }),
  ];
}