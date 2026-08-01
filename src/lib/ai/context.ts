// VibeCore AI — Context System.
//
// Builds a pure, serialisable snapshot of the current project state for AI
// assistants to reason about. This is a READ-ONLY operation — it never
// touches the audio path, never mutates the store, and never blocks the
// audio thread. The snapshot is computed on the control thread (UI / rAF).
//
// Harmony context is derived from the existing ArpEngine config (rootNote +
// scale), which is the canonical harmonic reference shared across all VibeCore
// Sync modules. This avoids a second source of truth for key/scale.

import { useGroove } from "@/lib/store";
import type { ContextSnapshot, HarmonyContext, ScaleType } from "./types";
import { inferDensity, inferEnergy } from "./engine";
import type { ArpScale } from "@/lib/audio/arpEngine";

/** Map ArpEngine scale names to AI ScaleType. */
const ARP_SCALE_MAP: Record<ArpScale, ScaleType> = {
  minor: "minor",
  major: "major",
  phrygian: "phrygian",
  minorPent: "minorPent",
  majorPent: "majorPent",
};

/** Build a HarmonyContext from the shared ArpEngine config. */
export function harmonyFromArp(rootNote: number, scale: ArpScale): HarmonyContext {
  return {
    root: ((Math.round(rootNote) % 12) + 12) % 12,
    scale: ARP_SCALE_MAP[scale] ?? "minorPent",
  };
}

/** Build a full ContextSnapshot from the live store. Pure read — no mutation. */
export function buildContext(): ContextSnapshot {
  const s = useGroove.getState();
  const pat = s.patterns[s.selectedPattern];
  const scene = pat?.scenes[s.selectedSceneIdx];
  const sceneLength = scene?.length ?? 16;

  // Infer density/energy from the current scene's kick/hat parts.
  const kickSteps = scene?.partSteps?.[0] ?? [];
  const density = inferDensity(kickSteps);
  const energy = inferEnergy(kickSteps);

  return {
    bpm: s.bpm,
    playing: s.transport.playing,
    currentPattern: s.transport.currentPattern,
    selectedPattern: s.selectedPattern,
    selectedSceneIdx: s.selectedSceneIdx,
    sceneLength,
    swing: pat?.swing ?? 54,
    parts: s.parts,
    patterns: s.patterns,
    currentScene: scene,
    harmony: harmonyFromArp(s.arp.rootNote, s.arp.scale),
    energy,
    density,
    genre: undefined,
    fx: s.fx,
    master: s.master,
    chainSteps: s.transport.chainSteps,
    songTicks: s.playheads.songTicks,
    arp: s.arp,
  };
}

/** Find a part by category (first match). Returns undefined if none. */
export function findPartByCategory(
  ctx: ContextSnapshot, category: string,
): { id: number; name: string } | undefined {
  const p = ctx.parts.find((pt) => pt.category === category);
  return p ? { id: p.id, name: p.name } : undefined;
}

/** Get the kick hit positions in the current scene (for bass alignment). */
export function kickHitsInScene(ctx: ContextSnapshot): number[] {
  const scene = ctx.currentScene;
  if (!scene) return [];
  const kickPart = ctx.parts.find((p) => p.category === "kick");
  if (!kickPart) return [];
  const steps = scene.partSteps[kickPart.id] ?? [];
  return steps.reduce<number[]>((acc, st, i) => (st.on ? [...acc, i] : acc), []);
}