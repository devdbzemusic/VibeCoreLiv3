// VibeCoreLiv3 — Shared SceneStep ArpEngine.
//
// ARCHITECTURE (VibeCore Sync integration)
//   The arpeggiator is NOT a note generator that lives beside the sequencer.
//   It is part of VibeCore Sync and produces its events on the SceneStep
//   level, so Bass, 3D Synth and every later module share ONE deterministic
//   Arp implementation and stay perfectly sample-synchronous.
//
//   Signal flow (per spec):
//     Keyboard → Chord Detector → Arp Engine → SceneStep Mapper
//       → Bass Voice Allocator → Event Generator → GravLace DSP → 3D Space
//
//   The Arp knows no samples. It only knows:
//     sceneSteps ∈ {2,4,8,16}, currentSceneStep, and the chord/scale pool.
//   It emits ArpEvent objects tagged E_ARP_NOTE. It NEVER touches DSP
//   directly — every downstream event (E_LACE, E_TRANSIENT_GATE, E_WARPER_MICRO)
//   arises from the existing spawn rules once a voice is allocated. This keeps
//   the engine deterministic and block-accurate.
//
// DETERMINISM
//   DNA / RANDOM modes derive their seed from
//     hashSeed(patternPartID, hashSeed(scenePartID, chordHash))
//   so every pattern is reproducible.

import { hashSeed, mulberry32, type Rng } from "@/lib/utils/random";

// ── Event class marker ──────────────────────────────────────────────────────
/** Event class added to the spawn chain alongside E_LACE / E_TRANSIENT_GATE /
 *  E_WARPER_MICRO. The ArpEngine ONLY emits this class. */
export const E_ARP_NOTE = "E_ARP_NOTE";

export type ArpMode =
  | "UP" | "DOWN" | "UPDOWN" | "RANDOM" | "CHORD"
  | "SPIRAL" | "ORBIT" | "DNA";

export type ArpState = "Clean" | "Smart" | "Hard";
export type ArpScale = "minor" | "major" | "phrygian" | "minorPent" | "majorPent";

export const ARP_MODES: ArpMode[] = ["UP", "DOWN", "UPDOWN", "RANDOM", "CHORD", "SPIRAL", "ORBIT", "DNA"];
export const ARP_STATES: ArpState[] = ["Clean", "Smart", "Hard"];
export const ARP_SCALES: ArpScale[] = ["minor", "major", "phrygian", "minorPent", "majorPent"];

export const SCALE_DEGREES: Record<ArpScale, number[]> = {
  minor:     [0, 2, 3, 5, 7, 8, 10],
  major:     [0, 2, 4, 5, 7, 9, 11],
  phrygian:  [0, 1, 3, 5, 7, 8, 10],
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
};

export interface ArpConfig {
  enabled: boolean;
  mode: ArpMode;
  /** 0..100 — steers note density, octave jumps, ratchets, probability, DNA variation. */
  complexity: number;
  /** Root MIDI pitch (bass register). C2 = 36. */
  rootNote: number;
  scale: ArpScale;
  /** 1..4 — octave span of the note pool. */
  octaves: number;
  /** Part ids the shared engine feeds (bass, 3D synth, …). */
  targetParts: number[];
  /** 0..100 — vibeControlFactor in the density formula. */
  vibeControl: number;
  /** Performance state — stateFactor: Clean 0.4, Smart 1.0, Hard 1.6. */
  state: ArpState;
  /** 16-step gate grid. A step only spawns E_ARP_NOTE when its cell is on. */
  gateSteps: boolean[];
}

export function defaultArpConfig(): ArpConfig {
  return {
    enabled: false,
    mode: "UP",
    complexity: 50,
    rootNote: 36,
    scale: "minor",
    octaves: 2,
    targetParts: [6],
    vibeControl: 60,
    state: "Smart",
    gateSteps: [
      true, false, true, false, true, false, true, false,
      true, false, true, false, true, false, true, false,
    ],
  };
}

/** One arpeggiator note. Emitted on the SceneStep level. */
export interface ArpEvent {
  note: number;        // absolute MIDI pitch
  velocity: number;    // 1..127
  accent: boolean;
  probability: number; // 0..100
  tie: boolean;
  slide: boolean;
  /** Index of this note within the current bar (0..3) — drives GravLace coupling. */
  barIndex: number;
}

// ── Density formula ─────────────────────────────────────────────────────────
//
//   arpDensity = sceneStepsFactor * vibeControlFactor * stateFactor
//   notesPerStep = clamp(round(arpDensity * complexityFactor), 1, maxForScene)
//
//   sceneStepsFactor : 2 → 1.0, 4 → 1.5, 8 → 2.5, 16 → 4.0
//   stateFactor      : Clean 0.4, Smart 1.0, Hard 1.6
//   vibeControlFactor: 0.3 + vibe/100 * 1.4   (0.3..1.7)
//   complexityFactor : 0.5 + complexity/100 * 1.5 (0.5..2.0)

const SCENE_STEPS_FACTOR: Record<number, number> = { 2: 1.0, 4: 1.5, 8: 2.5, 16: 4.0 };
const STATE_FACTOR: Record<ArpState, number> = { Clean: 0.4, Smart: 1.0, Hard: 1.6 };

function sceneStepsFactor(sceneSteps: number): number {
  return SCENE_STEPS_FACTOR[sceneSteps] ?? 1.0;
}

/** Maximum notes per sceneStep (spec: 2 → 1, 16 → up to 8). */
function maxNotesForScene(sceneSteps: number): number {
  if (sceneSteps <= 2) return 1;
  if (sceneSteps <= 4) return 2;
  if (sceneSteps <= 8) return 4;
  return 8;
}

export function notesPerStep(cfg: ArpConfig, sceneSteps: number): number {
  const vibe = 0.3 + (cfg.vibeControl / 100) * 1.4;
  const state = STATE_FACTOR[cfg.state];
  const cplx = 0.5 + (cfg.complexity / 100) * 1.5;
  const density = sceneStepsFactor(sceneSteps) * vibe * state;
  const n = Math.round(density * cplx);
  return Math.max(1, Math.min(maxNotesForScene(sceneSteps), n));
}

// ── Note pool ───────────────────────────────────────────────────────────────

/** Build the ascending MIDI note pool: root + octave*12 + scale degree. */
export function buildNotePool(cfg: ArpConfig): number[] {
  const degrees = SCALE_DEGREES[cfg.scale];
  const pool: number[] = [];
  for (let o = 0; o < cfg.octaves; o++) {
    for (const d of degrees) pool.push(cfg.rootNote + o * 12 + d);
  }
  return pool;
}

// ── DNA seed ────────────────────────────────────────────────────────────────
/** Deterministic seed: patternPartID → scenePartID → chordHash. Reproducible. */
export function arpSeed(patternPartId: number, scenePartId: number, chordHash: number): number {
  return hashSeed(patternPartId, hashSeed(scenePartId, chordHash));
}

// ── Mode sequences ──────────────────────────────────────────────────────────
//
// A mode returns the NEXT note for a given cursor position over the pool.
// Cursor advances by one per emitted note. Modes that need randomness take
// the shared rng (seeded for DNA / RANDOM).

function modeNote(
  mode: ArpMode, pool: number[], semis: number[], cursor: number, rng: Rng,
): number {
  const n = pool.length;
  if (n === 0) return 60;
  switch (mode) {
    case "UP":      return pool[cursor % n];
    case "DOWN":    return pool[n - 1 - (cursor % n)];
    case "UPDOWN": {
      // triangle wave over 2*(n-1) indices
      const period = Math.max(2, 2 * (n - 1));
      const k = cursor % period;
      const idx = k < n ? k : period - k;
      return pool[idx];
    }
    case "RANDOM":  return pool[Math.floor(rng() * n)];
    case "CHORD":   return pool[cursor % Math.min(n, 3)]; // triad rotation
    case "SPIRAL": {
      // C E G C+1 E+1 G+1 …  → scale degrees [0,2,4], +12 each full triad cycle
      const triad = [0, 2, 4];
      const d = triad[cursor % 3];
      const oct = Math.floor(cursor / 3);
      return pool[0] + oct * 12 + (semis[d] ?? 0);
    }
    case "ORBIT": {
      // C G E G  C G E G …  → scale degrees [0,4,2,4] over the first octave
      const pat = [0, 4, 2, 4];
      const deg = pat[cursor % 4];
      return pool[0] + (semis[deg % semis.length] ?? 0);
    }
    case "DNA": {
      // deterministic shuffle walk: seeded rng picks a pool index; the
      // sequence is fixed for a given seed (rng is seeded once per pattern).
      return pool[Math.floor(rng() * n)];
    }
    default: return pool[cursor % n];
  }
}

// ── GravLace coupling ───────────────────────────────────────────────────────
//
//   Arp ↔ GravLace: each arp note (barIndex 0..3) drives the downstream
//   texture without LFOs:
//     LaceDensity  → ratchet count (denser texture)
//     GateIntensity→ gate length factor (tighter gates as arp intensifies)
//     WarperChance → micro-timing jitter probability
//   Spec example: Note1 20%, Note2 35%, Note3 55%, Note4 75%.

export interface ArpCoupling {
  laceRatchet: number;   // 1..4 — ratchet count (LaceDensity)
  gateFactor: number;   // 0.3..1.0 — multiplies stepDur (GateIntensity)
  warperChance: number; // 0..100 — micro-timing jitter probability
}

export function arpCoupling(barIndex: number, complexity: number): ArpCoupling {
  const i = Math.max(0, Math.min(3, barIndex));
  const c = complexity / 100;
  // Lace density ramps 20% → 75% across notes 1..4, scaled by complexity.
  const lace01 = (0.20 + i * 0.183) * (0.5 + c * 0.8);
  const laceRatchet = Math.max(1, Math.min(4, 1 + Math.round(lace01 * 3)));
  // Gate intensity: tighter (shorter) as the arp intensifies.
  const gateFactor = Math.max(0.3, 0.95 - i * 0.12 - c * 0.1);
  // Warper chance grows with note index + complexity.
  const warperChance = Math.max(0, Math.min(100, (0.30 + i * 0.15) * 100 * c));
  return { laceRatchet, gateFactor, warperChance };
}

// ── Cursor (shared across all target modules — keeps them synchronous) ─────
let arpCursor = 0;

/** Reset the arp cursor. Called on transport (re)start and pattern switch. */
export function resetArpCursors(): void { arpCursor = 0; }

// ── Per-SceneStep event generation ──────────────────────────────────────────

export interface ArpStepContext {
  patternPartId: number;
  scenePartId: number;
  chordHash: number;
  sceneStep: number;
  sceneSteps: number;
  /** Absolute monotonic tick (for accent cadence). */
  globalTick: number;
}

/**
 * Generate the E_ARP_NOTE events for one sceneStep.
 * Pure given the config + context + cursor state. Returns [] when disabled
 * or the step gate is off.
 */
export function generateArpEventsForStep(
  cfg: ArpConfig,
  ctx: ArpStepContext,
): ArpEvent[] {
  if (!cfg.enabled) return [];
  if (cfg.targetParts.length === 0) return [];
  const gateIdx = ((ctx.sceneStep % 16) + 16) % 16;
  if (!cfg.gateSteps[gateIdx]) return [];

  const pool = buildNotePool(cfg);
  if (pool.length === 0) return [];

  const semis = SCALE_DEGREES[cfg.scale];
  const rng = mulberry32(arpSeed(ctx.patternPartId, ctx.scenePartId, ctx.chordHash));
  const count = notesPerStep(cfg, ctx.sceneSteps);
  const events: ArpEvent[] = [];

  for (let i = 0; i < count; i++) {
    const cursor = arpCursor++;
    const barIndex = cursor % 4;
    let note = modeNote(cfg.mode, pool, semis, cursor, rng);

    // Complexity-driven octave jumps.
    if (cfg.complexity > 50 && rng() < (cfg.complexity - 50) / 150) {
      note += 12 * (1 + Math.floor(rng() * cfg.octaves));
    }

    const accent = (cursor % 4) === 0;
    // Higher complexity → lower certainty (more variation / rests).
    const probability = Math.max(35, Math.round(100 - cfg.complexity * 0.3 * rng()));
    const slide = cfg.complexity > 60 && rng() < 0.3;
    // Long scenes (meditation/ambient) tie notes together.
    const tie = ctx.sceneSteps <= 4 && i < count - 1;
    const velocity = accent ? 110 : 78 + Math.round(24 * rng());

    events.push({ note, velocity, accent, probability, tie, slide, barIndex });
  }
  return events;
}