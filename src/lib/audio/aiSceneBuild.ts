// AI Scenebuild — variable-length, deterministic, SYNC-aware generator.
//
// Sync contract (VibeCore): the ONLY timing authority is the Sync module /
// MasterClock. These generators are PURE — no timers, no clock, no setTempo.
// They consult `beatsPerBar` + `length` (scene step count) and emit BAR-
// ALIGNED step patterns / notes. The existing scheduler plays them in lock-
// step with the clock at the current BPM — so every note lands in sync.
//
// Musicality (v2): bar/beat velocity hierarchy, motif call-&-response for
// melodies, tonal resolution to root on bar lines, stepwise motion with
// chord-tone leaps, bass locked to kick, and CONTEXT MERGING — existing
// user hits are preserved so suggestions FIT the current pattern instead of
// overwriting it. Swing is delegated to the pattern/scheduler (no random
// micro offsets that would fight the global swing).

import type { Step, PartCategory, Note } from "@/lib/model";
import { mulberry32, hashSeed } from "@/lib/utils/random";

export type ScenebuildStyle =
  | "fourFloor" | "boomBap" | "trap" | "breaks" | "techno" | "ambient" | "minimal";

export interface ScenebuildOpts {
  category: PartCategory;
  style?: ScenebuildStyle;
  density?: number;
  swingProb?: number;
  seed?: number;
  length?: number;
  /** Existing steps to preserve (context merge). Optional. */
  existing?: Step[];
}

function emptyStep(): Step {
  return { on: false, velocity: 100, probability: 100, gate: 50, ratchet: 1, micro: 0, accent: false };
}

function newStep(velocity = 100, opts: Partial<Step> = {}): Step {
  return { ...emptyStep(), on: true, velocity, ...opts };
}

const STEPS_PER_BEAT = 4; // 16th-note grid

// 16-step archetype patterns. Indices are scaled to fit any target length.
const PATTERNS: Record<PartCategory, Partial<Record<ScenebuildStyle, number[]>>> = {
  kick: {
    fourFloor: [0, 4, 8, 12], boomBap: [0, 6, 10], trap: [0, 3, 6, 10, 14],
    breaks: [0, 7, 10], techno: [0, 4, 8, 12], ambient: [0, 12], minimal: [0, 8],
  },
  snare: {
    fourFloor: [4, 12], boomBap: [4, 12], trap: [4, 12],
    breaks: [4, 12, 14], techno: [4, 12], ambient: [12], minimal: [4, 12],
  },
  hat: {
    fourFloor: [2, 6, 10, 14], boomBap: [2, 3, 6, 10, 14, 15],
    trap: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15],
    breaks: [2, 5, 8, 11, 14], techno: [2, 6, 10, 14],
    ambient: [6, 14], minimal: [2, 10],
  },
  perc: {
    fourFloor: [3, 11], boomBap: [5, 13], trap: [1, 5, 9, 13],
    breaks: [3, 7, 11, 15], techno: [6, 14], ambient: [7], minimal: [11],
  },
  bass: {
    fourFloor: [0, 4, 8, 12], boomBap: [0, 5, 8, 13], trap: [0, 3, 8, 11],
    breaks: [0, 6, 10, 14], techno: [0, 4, 8, 12], ambient: [0, 8], minimal: [0, 8],
  },
  synth: {
    fourFloor: [0, 8], boomBap: [0, 8], trap: [0, 6, 12],
    breaks: [0, 4, 10], techno: [0, 4, 8, 12], ambient: [0], minimal: [0],
  },
  sample: {
    fourFloor: [0, 8], boomBap: [0, 5], trap: [0, 6],
    breaks: [0, 7], techno: [0, 8], ambient: [0], minimal: [0],
  },
};

const DEFAULT_STYLE: Record<PartCategory, ScenebuildStyle> = {
  kick: "fourFloor", snare: "boomBap", hat: "trap", perc: "techno",
  bass: "fourFloor", synth: "techno", sample: "ambient",
};

// ── Beat hierarchy ────────────────────────────────────────────────────────
type Strength = "down" | "beat" | "off";
function beatStrength(idx: number, barSteps: number): Strength {
  const inBar = idx % barSteps;
  if (inBar === 0) return "down";
  if (inBar % STEPS_PER_BEAT === 0) return "beat";
  return "off";
}
function velForStrength(s: Strength, jitter: number): number {
  const base = s === "down" ? 115 : s === "beat" ? 96 : 74;
  return Math.max(20, Math.min(127, base + jitter));
}

/** Generate a `length`-step pattern for one part (context-aware merge). */
export function buildScene(opts: ScenebuildOpts): Step[] {
  const cat = opts.category;
  const style = opts.style ?? DEFAULT_STYLE[cat];
  const length = Math.max(1, Math.floor(opts.length ?? 16));
  const density = Math.max(0, Math.min(1, opts.density ?? 0.5));
  const swingProb = Math.max(0, Math.min(1, opts.swingProb ?? 0.4));
  const seed = opts.seed ?? 0xC0FFEE;
  const rng = mulberry32(hashSeed(seed, length));

  // Start from existing hits (preserve user input), else empty.
  const steps: Step[] = opts.existing
    ? opts.existing.slice(0, length).map((s) => ({ ...s }))
    : Array.from({ length }, emptyStep);
  while (steps.length < length) steps.push(emptyStep());

  const barSteps = Math.max(STEPS_PER_BEAT, STEPS_PER_BEAT * 4);
  const base = PATTERNS[cat][style] ?? [0, 8];
  const scale = length / 16;

  for (const idx16 of base) {
    const idx = Math.floor(idx16 * scale);
    if (idx < 0 || idx >= length) continue;
    if (steps[idx].on) continue; // respect existing user hit
    const s = beatStrength(idx, barSteps);
    const isStrong = s === "down";
    steps[idx] = newStep(velForStrength(s, Math.floor((rng() - 0.5) * 12)), { accent: isStrong });
  }

  // Ghost notes on empty off-beats.
  const ghostRate = cat === "hat" ? 0.55 : cat === "perc" ? 0.4 : 0.25;
  for (let i = 1; i < length; i += 2) {
    if (steps[i].on) continue;
    if (rng() < density * ghostRate) {
      const s = beatStrength(i, barSteps);
      steps[i] = newStep(velForStrength(s, -20), { probability: 70 + Math.floor(rng() * 25) });
    }
  }

  // Ratchet rolls — hats only, sparse, musical.
  if (cat === "hat") {
    for (let i = 0; i < length; i++) {
      if (steps[i].on && rng() < density * swingProb * 0.5) {
        steps[i] = { ...steps[i], ratchet: 2 + Math.floor(rng() * 2) };
      }
    }
  }

  // No per-step micro timing: swing is owned by the pattern + scheduler, so
  // AI output stays grid-true and locks to the global groove.
  return steps;
}

// ── Co-Assistant — coordinated groove + melody generators ───────────────────

const RHYTHM_CATS: PartCategory[] = ["kick", "snare", "hat", "perc"];

export interface GrooveOpts {
  style?: ScenebuildStyle;
  density?: number;
  swingProb?: number;
  seed?: number;
  beatsPerBar?: number;
  length?: number;
  /** Existing rhythm steps per category — preserved (context merge). */
  existing?: Partial<Record<PartCategory, Step[]>>;
}

/** Generate a coordinated drum groove across kick / snare / hat / perc.
 *  Meshed: kick anchors the beat grid, snare hits backbeats, hats fill off-
 *  beats, perc adds sparse accents — from a single shared seed so they
 *  groove together. Existing user hits are preserved; only gaps are filled.
 *  Bar-aligned to `beatsPerBar`; no micro timing (swing = scheduler's job). */
export function buildGroove(opts: GrooveOpts): Record<PartCategory, Step[]> {
  const style = opts.style ?? "fourFloor";
  const length = Math.max(1, Math.floor(opts.length ?? 16));
  const density = Math.max(0, Math.min(1, opts.density ?? 0.5));
  const swingProb = Math.max(0, Math.min(1, opts.swingProb ?? 0.4));
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const seed = opts.seed ?? 0xC0FFEE;
  const barSteps = beatsPerBar * STEPS_PER_BEAT;
  const scale = length / Math.max(1, barSteps);
  const rng = mulberry32(hashSeed(seed, length));
  const out = {} as Record<PartCategory, Step[]>;

  for (const cat of RHYTHM_CATS) {
    const existing = opts.existing?.[cat];
    const steps: Step[] = existing
      ? existing.slice(0, length).map((s) => ({ ...s }))
      : Array.from({ length }, emptyStep);
    while (steps.length < length) steps.push(emptyStep());

    const base = PATTERNS[cat][style] ?? [0, 8];
    for (const idx16 of base) {
      const idx = Math.floor(idx16 * scale) % length;
      if (idx < 0 || idx >= length) continue;
      if (steps[idx].on) continue; // respect existing
      const s = beatStrength(idx, barSteps);
      steps[idx] = newStep(
        velForStrength(s, Math.floor((rng() - 0.5) * 12)),
        { accent: s === "down" },
      );
    }

    // Steady 8th-note hats for sustained styles (only fill gaps).
    if (cat === "hat" && (style === "fourFloor" || style === "techno" || style === "breaks")) {
      for (let i = 0; i < length; i += 2) {
        if (!steps[i].on && rng() < 0.5 + density * 0.4) {
          const s = beatStrength(i, barSteps);
          steps[i] = newStep(velForStrength(s, -10), { accent: s === "down" });
        }
      }
    }

    // Ghost notes — category-dependent density.
    const ghostRate = cat === "hat" ? 0.5 : cat === "perc" ? 0.35 : 0.25;
    for (let i = 1; i < length; i += 2) {
      if (!steps[i].on && rng() < density * ghostRate) {
        const s = beatStrength(i, barSteps);
        steps[i] = newStep(velForStrength(s, -22), { probability: 70 + Math.floor(rng() * 25) });
      }
    }

    // Ratchets — hats only.
    if (cat === "hat") {
      for (let i = 0; i < length; i++) {
        if (steps[i].on && rng() < density * swingProb * 0.4) {
          steps[i] = { ...steps[i], ratchet: 2 + Math.floor(rng() * 2) };
        }
      }
    }

    out[cat] = steps;
  }
  return out;
}

// ── Melody ─────────────────────────────────────────────────────────────────

export type MelodyScale = "minorPent" | "majorPent" | "naturalMinor" | "dorian" | "major";

const SCALES: Record<MelodyScale, number[]> = {
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

// Chord-tone scale-degree indices (root, 3rd, 5th) for tonal resolution.
const CHORD_DEGREES = [0, 2, 4];

export interface MelodyOpts {
  scale?: MelodyScale;
  rootMidi?: number;
  density?: number;
  seed?: number;
  beatsPerBar?: number;
  length?: number;
  /** Target category — bass locks to kick, others use motif call-&-response. */
  category?: PartCategory;
  /** Kick hit positions for bass alignment (from existing groove). */
  kickHits?: number[];
}

function degreeToMidi(deg: number, intervals: number[], root: number): number {
  const n = intervals.length;
  const octave = Math.floor(deg / n);
  const idx = ((deg % n) + n) % n;
  return root + octave * 12 + intervals[idx];
}

/** Build a 1-bar motif: rhythm aligned to the beat grid, stepwise pitch
 *  walk with chord-tone leaps, resolving to root on the bar line. */
function buildMotif(
  len: number, intervals: number[], root: number, density: number, rng: () => number,
): Omit<Note, "id">[] {
  const notes: Omit<Note, "id">[] = [];
  // Beat-aligned durations (in 16th steps), weighted toward longer/quarter values.
  const DURS = [4, 4, 4, 2, 2, 2, 3, 6];
  let pos = 0;
  let deg = 0; // start on root

  while (pos < len) {
    const remaining = len - pos;
    let dur = DURS[Math.floor(rng() * DURS.length)];
    if (density > 0.65) dur = Math.min(dur, 2); // busier feel
    // Snap duration so the note ends on a beat boundary when possible.
    if (pos + dur < len && (pos + dur) % STEPS_PER_BEAT !== 0 && rng() < 0.5) {
      dur = STEPS_PER_BEAT - (pos % STEPS_PER_BEAT);
    }
    dur = Math.max(1, Math.min(dur, remaining));

    const isFirst = pos === 0;
    const isLast = pos + dur >= len;

    // Pitch motion: stepwise dominant; leaps land on chord tones.
    let midi: number;
    if (isFirst) {
      midi = degreeToMidi(0, intervals, root);
    } else if (isLast) {
      // Resolve to root (or 5th) — tonal gravity at the bar line.
      midi = degreeToMidi(rng() < 0.7 ? 0 : 4, intervals, root);
    } else {
      const r = rng();
      let move: number;
      if (r < 0.55) move = rng() < 0.5 ? -1 : 1;          // step
      else if (r < 0.78) move = rng() < 0.5 ? -2 : 2;     // third
      else move = 0;                                       // repeat
      deg += move;
      // Keep within ~2 octaves.
      deg = Math.max(-intervals.length, Math.min(intervals.length * 2 - 1, deg));
      // Bias leaps toward chord tones.
      if (Math.abs(move) >= 2 && rng() < 0.6) {
        const target = CHORD_DEGREES[Math.floor(rng() * CHORD_DEGREES.length)];
        deg = target + Math.round(deg / intervals.length) * intervals.length;
        deg = Math.max(-intervals.length, Math.min(intervals.length * 2 - 1, deg));
      }
      midi = degreeToMidi(deg, intervals, root);
    }
    midi = Math.max(24, Math.min(96, midi));

    const strength = beatStrength(pos, Math.max(STEPS_PER_BEAT, STEPS_PER_BEAT * 4));
    const vel = isFirst ? 108 : 70 + Math.floor(rng() * 30) + (strength === "down" ? 8 : 0);
    notes.push({ step: pos, pitch: midi, length: dur, velocity: Math.min(127, vel) });

    pos += dur;
    // Occasional rest (negative space = musical phrasing).
    if (pos < len && rng() > density * 0.9) pos += 2;
  }
  return notes;
}

/** Generate a bar-aligned melodic line. Motif call-&-response across bars;
 *  resolves to root on bar lines. For `bass`, locks note onsets to the
 *  existing kick pattern. Pure — no audio/clock side effects. */
export function buildMelody(opts: MelodyOpts): Omit<Note, "id">[] {
  const scaleName = opts.scale ?? "minorPent";
  const intervals = SCALES[scaleName];
  const root = Math.round(opts.rootMidi ?? 60);
  const density = Math.max(0, Math.min(1, opts.density ?? 0.6));
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const length = Math.max(1, Math.floor(opts.length ?? 16));
  const seed = opts.seed ?? 0xC0FFEE;
  const category = opts.category ?? "synth";
  const rng = mulberry32(hashSeed(seed, length));
  const barSteps = beatsPerBar * STEPS_PER_BEAT;

  // ── Bass: lock to kick hits, root-driven, sparse & solid. ──
  if (category === "bass") {
    const hits = (opts.kickHits ?? []).filter((s) => s >= 0 && s < length);
    const onsets = hits.length ? hits : Array.from({ length: Math.ceil(length / barSteps) }, (_, b) => b * barSteps);
    const bassRoot = root - 12; // bass register
    const notes: Omit<Note, "id">[] = [];
    for (let i = 0; i < onsets.length; i++) {
      const step = onsets[i];
      const next = i + 1 < onsets.length ? onsets[i + 1] : Math.min(length, step + barSteps);
      let dur = Math.max(1, Math.min(next - step, length - step));
      // Shorten to a musical value, keep under the next onset.
      dur = Math.min(dur, Math.max(1, Math.floor(density * 6) + 2));
      // Alternate root / fifth for movement, resolve toward root.
      const deg = i % 4 === 3 ? 4 : 0;
      const midi = Math.max(24, Math.min(72, degreeToMidi(deg, intervals, bassRoot)));
      const vel = beatStrength(step, barSteps) === "down" ? 110 : 88 + Math.floor(rng() * 14);
      notes.push({ step, pitch: midi, length: dur, velocity: vel });
    }
    return notes;
  }

  // ── Lead / sample: motif call & response. ──
  const motifLen = Math.min(barSteps, length);
  const motif = buildMotif(motifLen, intervals, root, density, rng);
  const notes: Omit<Note, "id">[] = [];
  const numBars = Math.ceil(length / motifLen);

  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * motifLen;
    if (barStart >= length) break;
    const isLastBar = bar === numBars - 1;
    // Per-bar variation: small motivic transpose (response), zero on first.
    const respShift = bar === 0 ? 0 : (bar % 2 === 1 ? 2 : -2); // scale-degree shift
    for (const m of motif) {
      const step = barStart + m.step;
      if (step >= length) break;
      let dur = Math.min(m.length, length - step);
      let pitch = m.pitch;
      if (respShift !== 0) {
        // shift pitch by scale degrees, stay in range
        const curDeg = intervals.findIndex((iv) => ((pitch - root) % 12 + 12) % 12 === iv);
        const baseDeg = curDeg >= 0 ? curDeg : 0;
        const newDeg = Math.max(-intervals.length, Math.min(intervals.length, baseDeg + respShift));
        pitch = Math.max(24, Math.min(96, degreeToMidi(newDeg, intervals, root + Math.floor((pitch - root) / 12) * 12)));
      }
      // Resolve the final note of the last bar to root.
      if (isLastBar && step + dur >= length) {
        pitch = Math.max(24, Math.min(96, degreeToMidi(0, intervals, root + Math.floor((pitch - root) / 12) * 12)));
      }
      // Slight velocity lift on downbeats; decay across the bar.
      const strength = beatStrength(step, barSteps);
      const vel = Math.min(127, m.velocity + (strength === "down" ? 6 : 0));
      notes.push({ step, pitch, length: Math.max(1, dur), velocity: vel });
    }
  }
  return notes;
}