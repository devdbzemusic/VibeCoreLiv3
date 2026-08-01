// Built-in Forge presets — Phase 3 Sound Generator bank.
// Each preset is a small graph: source(s) → env.perc → output, with optional
// pitch / amount automation for sweeps. Categories follow the Master Brief.
//
// Conventions:
//   • Output node is always the EnvPerc — guarantees a silent tail.
//   • durationSec sized to envelope + ~50 ms guard so renderPreset's tail
//     fade doesn't cut audible content.
//   • All gains chosen so peak after env stays ≤ 0.9 (limiter-safe).

import type { ForgePreset, ForgePresetCategory } from "./types";

interface PercSpec {
  name: string;
  category: ForgePresetCategory;
  /** Source layer(s) that feed the env. */
  src: Array<
    | { kind: "fm"; freq: number; ratio: number; amount: number; gain: number;
        /** Optional one-shot pitch sweep to `freqEnd` over `sweepMs`. */
        freqEnd?: number; sweepMs?: number;
        /** Optional amount sweep. */
        amountEnd?: number; amountSweepMs?: number }
    | { kind: "noise"; color: number; gain: number; seed?: number }
  >;
  env: { attack: number; hold?: number; decay: number; curve?: number; level?: number };
  duration: number;
}

function buildPreset(spec: PercSpec): ForgePreset {
  const nodes: ForgePreset["nodes"] = [];
  const edges: ForgePreset["edges"] = [];
  const automation: NonNullable<ForgePreset["automation"]> = [];
  spec.src.forEach((s, i) => {
    const id = `s${i}`;
    if (s.kind === "fm") {
      nodes.push({ id, kind: "source.fm",
        params: { freq: s.freq, ratio: s.ratio, amount: s.amount, gain: s.gain } });
      if (s.freqEnd != null && s.sweepMs != null) {
        automation.push({ atSec: 0.0005, nodeId: id, param: "freq", value: s.freqEnd, rampMs: s.sweepMs });
      }
      if (s.amountEnd != null && s.amountSweepMs != null) {
        automation.push({ atSec: 0.0005, nodeId: id, param: "amount", value: s.amountEnd, rampMs: s.amountSweepMs });
      }
    } else {
      nodes.push({ id, kind: "source.noise",
        params: { gain: s.gain, color: s.color, seed: s.seed ?? 0xc0ffee } });
    }
    edges.push({ from: id, fromPort: 0, to: "env", toPort: 0 });
  });
  nodes.push({ id: "env", kind: "shape.env.perc", params: {
    attack: spec.env.attack, hold: spec.env.hold ?? 0,
    decay: spec.env.decay, curve: spec.env.curve ?? 1,
    level: spec.env.level ?? 1, autoTrigger: 1,
  } });
  return {
    version: 1,
    name: spec.name,
    category: spec.category,
    nodes, edges,
    outputNode: "env",
    durationSec: spec.duration,
    automation,
  };
}

// ─── Kicks ─────────────────────────────────────────────────────────────────
const KICKS: PercSpec[] = [
  { name: "Analog Kick", category: "kick", env: { attack: 0.002, decay: 0.45, curve: 1 },
    src: [{ kind: "fm", freq: 180, ratio: 1, amount: 0,  gain: 0.95, freqEnd: 50, sweepMs: 80 }],
    duration: 0.6 },
  { name: "Deep Kick", category: "kick", env: { attack: 0.003, decay: 0.85, curve: 1 },
    src: [{ kind: "fm", freq: 130, ratio: 1, amount: 0, gain: 0.92, freqEnd: 38, sweepMs: 130 }],
    duration: 1.0 },
  { name: "Punch Kick", category: "kick", env: { attack: 0.001, decay: 0.22, curve: 1 },
    src: [
      { kind: "fm", freq: 240, ratio: 1, amount: 0, gain: 0.85, freqEnd: 62, sweepMs: 50 },
      { kind: "noise", color: 0.1, gain: 0.20 },
    ],
    duration: 0.35 },
  { name: "FM Kick", category: "kick", env: { attack: 0.001, decay: 0.40, curve: 1 },
    src: [{ kind: "fm", freq: 220, ratio: 2.5, amount: 600, gain: 0.85,
            freqEnd: 55, sweepMs: 70, amountEnd: 20, amountSweepMs: 110 }],
    duration: 0.55 },
  { name: "Hybrid Kick", category: "kick", env: { attack: 0.001, decay: 0.55, curve: 1, level: 0.85 },
    src: [
      { kind: "fm", freq: 200, ratio: 1, amount: 0, gain: 0.70, freqEnd: 48, sweepMs: 90 },
      { kind: "fm", freq: 600, ratio: 1, amount: 0, gain: 0.15, freqEnd: 200, sweepMs: 30 },
      { kind: "noise", color: 0.0, gain: 0.10 },
    ],
    duration: 0.7 },
];

// ─── Snares ────────────────────────────────────────────────────────────────
const SNARES: PercSpec[] = [
  { name: "Analog Snare", category: "snare", env: { attack: 0.002, decay: 0.18, curve: 1 },
    src: [
      { kind: "fm", freq: 200, ratio: 1, amount: 0, gain: 0.4 },
      { kind: "fm", freq: 330, ratio: 1, amount: 0, gain: 0.25 },
      { kind: "noise", color: 0.2, gain: 0.55 },
    ], duration: 0.3 },
  { name: "Digital Snare", category: "snare", env: { attack: 0.001, decay: 0.14, curve: 1 },
    src: [
      { kind: "fm", freq: 380, ratio: 3.7, amount: 220, gain: 0.45 },
      { kind: "noise", color: 0.0, gain: 0.5 },
    ], duration: 0.25 },
  { name: "Noise Snare", category: "snare", env: { attack: 0.001, decay: 0.22, curve: 1 },
    src: [{ kind: "noise", color: 0.15, gain: 0.85 }],
    duration: 0.3 },
  { name: "FM Snare", category: "snare", env: { attack: 0.001, decay: 0.20, curve: 1 },
    src: [
      { kind: "fm", freq: 240, ratio: 5.5, amount: 480, gain: 0.55,
        amountEnd: 60, amountSweepMs: 80 },
      { kind: "noise", color: 0.3, gain: 0.35 },
    ], duration: 0.28 },
];

// ─── Hats ──────────────────────────────────────────────────────────────────
const HATS: PercSpec[] = [
  { name: "Closed Hat", category: "hat", env: { attack: 0.0008, decay: 0.05, curve: 1 },
    src: [
      { kind: "fm", freq: 6000, ratio: 1.41, amount: 800, gain: 0.18 },
      { kind: "noise", color: 0.0, gain: 0.55 },
    ], duration: 0.1 },
  { name: "Open Hat", category: "hat", env: { attack: 0.0008, decay: 0.32, curve: 1 },
    src: [
      { kind: "fm", freq: 6500, ratio: 1.71, amount: 900, gain: 0.18 },
      { kind: "noise", color: 0.0, gain: 0.55 },
    ], duration: 0.45 },
  { name: "Metallic Hat", category: "hat", env: { attack: 0.0008, decay: 0.16, curve: 1 },
    src: [
      { kind: "fm", freq: 4200, ratio: 2.41, amount: 1600, gain: 0.28 },
      { kind: "fm", freq: 7800, ratio: 1.91, amount: 1200, gain: 0.22 },
    ], duration: 0.22 },
  { name: "Noise Hat", category: "hat", env: { attack: 0.0008, decay: 0.08, curve: 1 },
    src: [{ kind: "noise", color: 0.0, gain: 0.85 }],
    duration: 0.12 },
];

// ─── Percussion ────────────────────────────────────────────────────────────
const PERC: PercSpec[] = [
  { name: "Click", category: "perc", env: { attack: 0.0005, decay: 0.015, curve: 1 },
    src: [
      { kind: "fm", freq: 2200, ratio: 1, amount: 0, gain: 0.7 },
      { kind: "noise", color: 0.0, gain: 0.35 },
    ], duration: 0.04 },
  { name: "Rim", category: "perc", env: { attack: 0.0006, decay: 0.06, curve: 1 },
    src: [
      { kind: "fm", freq: 1400, ratio: 4.1, amount: 320, gain: 0.55 },
      { kind: "noise", color: 0.2, gain: 0.25 },
    ], duration: 0.1 },
  { name: "Tom", category: "perc", env: { attack: 0.002, decay: 0.42, curve: 1 },
    src: [{ kind: "fm", freq: 220, ratio: 1, amount: 0, gain: 0.85, freqEnd: 110, sweepMs: 60 }],
    duration: 0.55 },
  { name: "Wood", category: "perc", env: { attack: 0.0005, decay: 0.10, curve: 1 },
    src: [
      { kind: "fm", freq: 850, ratio: 2.05, amount: 280, gain: 0.65 },
      { kind: "noise", color: 0.6, gain: 0.1 },
    ], duration: 0.15 },
  { name: "Metallic", category: "perc", env: { attack: 0.001, decay: 0.55, curve: 1 },
    src: [
      { kind: "fm", freq: 1200, ratio: 3.93, amount: 1800, gain: 0.35 },
      { kind: "fm", freq: 2350, ratio: 2.71, amount: 1500, gain: 0.25 },
    ], duration: 0.7 },
];

// ─── Basses ────────────────────────────────────────────────────────────────
const BASSES: PercSpec[] = [
  { name: "Sub Bass", category: "bass", env: { attack: 0.005, hold: 0.15, decay: 0.4, curve: 1 },
    src: [{ kind: "fm", freq: 55, ratio: 1, amount: 0, gain: 0.95 }],
    duration: 0.7 },
  { name: "FM Bass", category: "bass", env: { attack: 0.003, hold: 0.10, decay: 0.35, curve: 1 },
    src: [{ kind: "fm", freq: 65, ratio: 2, amount: 220, gain: 0.85, amountEnd: 60, amountSweepMs: 200 }],
    duration: 0.6 },
  { name: "Neuro Bass", category: "bass", env: { attack: 0.002, hold: 0.05, decay: 0.45, curve: 1 },
    src: [
      { kind: "fm", freq: 55, ratio: 1, amount: 0, gain: 0.55 },
      { kind: "fm", freq: 110, ratio: 7.1, amount: 950, gain: 0.45, amountEnd: 200, amountSweepMs: 250 },
    ], duration: 0.7 },
  { name: "Acid Bass", category: "bass", env: { attack: 0.002, hold: 0.06, decay: 0.30, curve: 1 },
    src: [{ kind: "fm", freq: 82, ratio: 1, amount: 850, gain: 0.7, amountEnd: 100, amountSweepMs: 180 }],
    duration: 0.5 },
  { name: "Hybrid Bass", category: "bass", env: { attack: 0.004, hold: 0.12, decay: 0.40, curve: 1 },
    src: [
      { kind: "fm", freq: 55, ratio: 1, amount: 0, gain: 0.55 },
      { kind: "fm", freq: 110, ratio: 3.1, amount: 420, gain: 0.30 },
      { kind: "noise", color: 0.7, gain: 0.08 },
    ], duration: 0.7 },
];

// ─── Synths (longer envelopes) ─────────────────────────────────────────────
const SYNTHS: PercSpec[] = [
  { name: "Lead", category: "synth", env: { attack: 0.01, hold: 0.4, decay: 0.5, curve: 0.6 },
    src: [{ kind: "fm", freq: 440, ratio: 2, amount: 300, gain: 0.7 }],
    duration: 1.1 },
  { name: "Pad", category: "synth", env: { attack: 0.6, hold: 1.2, decay: 1.2, curve: 0.4 },
    src: [
      { kind: "fm", freq: 220, ratio: 1.5, amount: 80, gain: 0.45 },
      { kind: "fm", freq: 330, ratio: 2.01, amount: 60, gain: 0.30 },
    ], duration: 3.5 },
  { name: "Pluck", category: "synth", env: { attack: 0.001, decay: 0.28, curve: 1 },
    src: [{ kind: "fm", freq: 440, ratio: 3.5, amount: 380, gain: 0.7, amountEnd: 30, amountSweepMs: 220 }],
    duration: 0.4 },
  { name: "Drone", category: "synth", env: { attack: 1.0, hold: 2.0, decay: 1.5, curve: 0.3 },
    src: [
      { kind: "fm", freq: 110, ratio: 1.01, amount: 40, gain: 0.5 },
      { kind: "fm", freq: 220, ratio: 1.5, amount: 30, gain: 0.30 },
    ], duration: 4.8 },
  { name: "Atmosphere", category: "synth", env: { attack: 0.8, hold: 1.4, decay: 1.4, curve: 0.4 },
    src: [
      { kind: "fm", freq: 660, ratio: 3.71, amount: 220, gain: 0.30 },
      { kind: "noise", color: 1.0, gain: 0.10 },
    ], duration: 4.0 },
];

// ─── Experimental ──────────────────────────────────────────────────────────
const EXP: PercSpec[] = [
  { name: "Granular", category: "experimental", env: { attack: 0.05, hold: 0.4, decay: 0.6, curve: 0.5 },
    src: [
      { kind: "fm", freq: 500, ratio: 1.41, amount: 280, gain: 0.4, amountEnd: 60, amountSweepMs: 800 },
      { kind: "noise", color: 0.7, gain: 0.18 },
    ], duration: 1.3 },
  { name: "Spectral", category: "experimental", env: { attack: 0.3, hold: 0.8, decay: 0.9, curve: 0.4 },
    src: [
      { kind: "fm", freq: 880, ratio: 4.71, amount: 360, gain: 0.35 },
      { kind: "fm", freq: 1320, ratio: 5.71, amount: 280, gain: 0.25 },
    ], duration: 2.3 },
  { name: "Texture", category: "experimental", env: { attack: 0.4, hold: 1.0, decay: 1.0, curve: 0.4 },
    src: [
      { kind: "noise", color: 0.8, gain: 0.45 },
      { kind: "fm", freq: 220, ratio: 7.01, amount: 600, gain: 0.20 },
    ], duration: 2.6 },
  { name: "Cloud", category: "experimental", env: { attack: 0.7, hold: 1.4, decay: 1.4, curve: 0.4 },
    src: [
      { kind: "noise", color: 1.0, gain: 0.35 },
      { kind: "fm", freq: 1500, ratio: 2.07, amount: 400, gain: 0.18 },
    ], duration: 3.8 },
  { name: "Swarm", category: "experimental", env: { attack: 0.2, hold: 0.6, decay: 0.8, curve: 0.5 },
    src: [
      { kind: "fm", freq: 440, ratio: 1.007, amount: 80, gain: 0.32 },
      { kind: "fm", freq: 442, ratio: 1.013, amount: 80, gain: 0.30 },
      { kind: "fm", freq: 438, ratio: 0.991, amount: 80, gain: 0.30 },
    ], duration: 1.8 },
];

const ALL_SPECS = [...KICKS, ...SNARES, ...HATS, ...PERC, ...BASSES, ...SYNTHS, ...EXP];

export const BUILTIN_FORGE_PRESETS: ForgePreset[] = ALL_SPECS.map(buildPreset);

/** Group presets by category for UI rendering. */
export function presetsByCategory(): Record<ForgePresetCategory, ForgePreset[]> {
  const groups = {
    kick: [], snare: [], hat: [], perc: [], bass: [], synth: [], experimental: [],
  } as Record<ForgePresetCategory, ForgePreset[]>;
  for (const p of BUILTIN_FORGE_PRESETS) {
    if (p.category) groups[p.category].push(p);
  }
  return groups;
}

// Backwards-compat exports used by tests written in Sprint 1.
export const FM_BELL_PRESET: ForgePreset = BUILTIN_FORGE_PRESETS.find((p) => p.name === "Pluck") ?? BUILTIN_FORGE_PRESETS[0];
export const SAMPLE_LOOP_PRESET: ForgePreset = {
  version: 1, name: "Sample Loop",
  nodes: [{ id: "smp1", kind: "source.sample", params: { gain: 1, speed: 1, loop: 1 } }],
  edges: [],
};
export const DUAL_FM_PRESET: ForgePreset = BUILTIN_FORGE_PRESETS.find((p) => p.name === "Pad") ?? BUILTIN_FORGE_PRESETS[0];
