// VibeCoreLiv3 — Core data model.
//
// Pattern-Domain Spec (Workspace + User-Prompt):
//   Project
//     └── PatternParts[1..111]          ← `Pattern` here = a "Pattern Part".
//         └── Scenes[1..8]              ← Chain of Scene-Parts inside one Pattern.
//             ├── length: 2..16          ← Shared by ALL 16 Stereo Sample Parts.
//             ├── partSteps: Record<partId, Step[]>   ← length-many Steps per part
//             └── partNotes: Record<partId, Note[]>   ← Piano Roll per part
//
// Scenes inside a Pattern can differ in length (e.g. Scene A = 8, Scene B = 16),
// but within ONE scene every part runs the same number of steps. Polymetry
// therefore lives between consecutive scenes, not between simultaneous parts.

import { hashSeed } from "./utils/random";
import type { Synth3DParams } from "@/lib/synth3d/params";
import type { Bass3DParams } from "@/lib/bass3d/params";

export type PartCategory = "kick" | "snare" | "perc" | "hat" | "bass" | "synth" | "sample";

export type DriveType = "soft" | "tape" | "tube";

export interface Channel {
  hpCut: number; hpRes: number; lpCut: number; lpRes: number;
  drive: number; driveType: DriveType;
  eqLow: number; eqMid: number; eqHigh: number;
  outGain: number;
}

export function defaultChannel(): Channel {
  return {
    hpCut: 0, hpRes: 0, lpCut: 100, lpRes: 0,
    drive: 0, driveType: "soft",
    eqLow: 0, eqMid: 0, eqHigh: 0, outGain: 100,
  };
}

export interface MasterChannel {
  eqLow: number; eqMid: number; eqHigh: number;
  width: number; softClip: number; limiter: boolean;
}

export function defaultMaster(): MasterChannel {
  return { eqLow: 0, eqMid: 0, eqHigh: 0, width: 100, softClip: 25, limiter: true };
}

export type SourceMode = "sample" | "synth" | "hybrid";
export type SynthEngine = "Kick" | "Snare" | "Hat" | "Bass" | "Synth" | "3D" | "3D Bass";
export type PlayMode = "forward" | "reverse" | "pingpong";
export type StretchMode = "tape" | "dj" | "granular" | "hybrid";
export type StretchQuality = "low" | "medium" | "high";
export type GrainDir = "fwd" | "rev" | "rnd";

export interface Slice {
  /** Unique id within the slice set. */
  id: string;
  /** Start position in [0..1). */
  start: number;
  /** End position in [0..1]. If undefined, extends to the next slice's start. */
  end?: number;
  /** User-defined label. */
  name?: string;
  /** UI color token or hex. */
  color?: string;
  /** Velocity override for Groove assignment (1..127, default 100). */
  velocity?: number;
}

export interface WaveEdit {
  start: number; end: number; loop: boolean; xfade: number;
  reverse: boolean; playMode: PlayMode; normalize: boolean;
  fadeIn: number; fadeOut: number; slices: number;
  /** Persisted slice metadata (positions, names, colors, velocities).
   *  Undefined = no slices saved; `slices` (count) is the fallback for
   *  equal-spaced slicing when no `sliceData` is present. */
  sliceData?: Slice[];
  grainSize: number; grainDensity: number; grainPos: number; grainSpray: number;
  freeze: boolean; pitchShift: number; timeStretch: number;
  granEnabled: boolean; granDir: GrainDir; granPitch: number;
  granRandPitch: number; granRandPan: number; granWidth: number;
  granGain: number; granFreeze: boolean;
  stretchMode: StretchMode; formant: boolean; stretchQuality: StretchQuality;
  freezePos: number; freezeSize: number; freezeFb: number; freezeMix: number;
}

export interface SynthParams {
  engine: SynthEngine;
  kPitch: number; kClick: number; kBody: number; kSub: number; kDrive: number; kDecay: number;
  sNoise: number; sTone: number; sSnap: number; sDecay: number;
  hMetal: number; hNoise: number; hFilter: number; hDecay: number;
  bOsc: number; bSub: number; bFilter: number; bFm: number; bGlide: number; bDecay: number;
  fmAmount: number; fmRatio: number; morph: number; voices: number; detune: number; spread: number;
  fAttack: number; fDecay: number; fSustain: number; fRelease: number;
}

export interface HybridParams {
  sampleMix: number; synthMix: number; subMix: number; subFreq: number;
  samplePhase: boolean; synthPhase: boolean;
}

export interface Part {
  id: number; name: string; category: PartCategory; color: string;
  volume: number; pan: number; pitch: number;
  mute: boolean; solo: boolean;
  /** Dry/main output destination: null = master, 0..5 = FX bus index. */
  busTarget?: number | null;
  sends: number[]; sampleName: string | null;
  channel: Channel; source: SourceMode;
  wave: WaveEdit; synth: SynthParams; hybrid: HybridParams;
  synth3d?: Synth3DParams;
  bass3d?: Bass3DParams;
}

export function defaultWave(): WaveEdit {
  return {
    start: 0, end: 1, loop: false, xfade: 10, reverse: false, playMode: "forward", normalize: false,
    fadeIn: 0, fadeOut: 0, slices: 8,
    grainSize: 35, grainDensity: 35, grainPos: 0, grainSpray: 0, freeze: false,
    pitchShift: 0, timeStretch: 100,
    granEnabled: false, granDir: "fwd", granPitch: 0, granRandPitch: 0,
    granRandPan: 0, granWidth: 100, granGain: 0, granFreeze: false,
    stretchMode: "tape", formant: false, stretchQuality: "medium",
    freezePos: 0, freezeSize: 200, freezeFb: 0, freezeMix: 0,
  };
}

export function defaultSynth(engine: SynthEngine = "Kick"): SynthParams {
  return {
    engine,
    kPitch: 55, kClick: 30, kBody: 65, kSub: 50, kDrive: 20, kDecay: 55,
    sNoise: 60, sTone: 45, sSnap: 55, sDecay: 35,
    hMetal: 60, hNoise: 50, hFilter: 75, hDecay: 25,
    bOsc: 50, bSub: 55, bFilter: 60, bFm: 20, bGlide: 0, bDecay: 70,
    fmAmount: 45, fmRatio: 50, morph: 50, voices: 3, detune: 25, spread: 60,
    fAttack: 5, fDecay: 35, fSustain: 60, fRelease: 40,
  };
}

export function defaultHybrid(): HybridParams {
  return { sampleMix: 80, synthMix: 60, subMix: 40, subFreq: 55, samplePhase: false, synthPhase: false };
}

export function engineForCategory(c: PartCategory): SynthEngine {
  if (c === "kick") return "Kick";
  if (c === "snare" || c === "perc") return "Snare";
  if (c === "hat") return "Hat";
  if (c === "bass") return "Bass";
  return "Synth";
}

export interface Step {
  on: boolean;
  velocity: number;
  probability: number;
  gate: number;
  ratchet: number;
  micro: number;
  accent: boolean;
  condition?: string;
  pitch?: number;
  humanize?: number;
}

export interface Note {
  id: string;
  /** Step index inside the scene (0..length-1). */
  step: number;
  /** MIDI pitch (0..127). C4 = 60. */
  pitch: number;
  /** Duration in steps (gate). >= 0.25 (quarter-step minimum). */
  length: number;
  /** 1..127. */
  velocity: number;
  /** Micro-timing offset in ±% of one step (-50..50). Optional. */
  micro?: number;
}

// ── Scene / Pattern domain ─────────────────────────────────────────────────
// SceneLength: any integer 2..16 (per user-prompt). Shared by all 16 Stereo
// Sample Parts inside the same scene. Piano-Roll grid maps 1:1 to this value.
export const SCENE_LEN_MIN = 2;
export const SCENE_LEN_MAX = 16;
export type SceneLength = number;
export const SCENE_LENGTHS: SceneLength[] =
  Array.from({ length: SCENE_LEN_MAX - SCENE_LEN_MIN + 1 }, (_, i) => i + SCENE_LEN_MIN);

/** Coerce any value into the allowed scene-length range [2..16] (integer). */
export function snapSceneLength(n: unknown): SceneLength {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 16;
  if (v < SCENE_LEN_MIN) return SCENE_LEN_MIN;
  if (v > SCENE_LEN_MAX) return SCENE_LEN_MAX;
  return v;
}

/** Project-wide hard limit on Pattern Parts (spec: 1..111). */
/** Project-wide hard limit on Pattern Parts. Groove spec: up to 256 patterns. */
export const MAX_PATTERN_PARTS = 256;
/** Hard limit on Scenes inside one Pattern Part (spec: 1..8). */
export const MAX_SCENES_PER_PATTERN = 8;

export interface Scene {
  id: string;
  length: SceneLength;
  /** Step arrays keyed by Part.id — exactly `length` entries per part. */
  partSteps: Record<number, Step[]>;
  /** Piano-Roll notes per part. Step indices are 0..length-1. */
  partNotes: Record<number, Note[]>;
}

/** One step in the enhanced Pattern Chain (Song Mode). */
export interface ChainStep {
  patternId: number;
  /** How many times to play this pattern before advancing (1 = once). */
  repeat: number;
  /** If true, skip this step entirely during chain playback. */
  skip?: boolean;
  /** Optional user marker / label for the chain step. */
  marker?: string;
}

export interface Pattern {
  id: number;
  name: string;
  seed: number;
  swing: number;
  /** Ordered scene chain (1..8). Plays sequentially Scene 0 → 1 → ... → end → loop. */
  scenes: Scene[];
  /** Optional UI color token (e.g. "part-bass") or hex string. */
  color?: string;
  /** Optional user-defined tags for categorisation / search. */
  tags?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function emptyStep(): Step {
  return { on: false, velocity: 100, probability: 100, gate: 50, ratchet: 1, micro: 0, accent: false, pitch: 0, humanize: 0 };
}

let _sceneIdCounter = 0;
export function nextSceneId(): string {
  _sceneIdCounter = (_sceneIdCounter + 1) >>> 0;
  return `sc_${Date.now().toString(36)}_${_sceneIdCounter.toString(36)}`;
}

export function buildDefaultSteps(length: number, partId = 0): Step[] {
  const arr: Step[] = Array.from({ length }, () => emptyStep());
  if (length >= 16) {
    if (partId === 0) [0, 4, 8, 12].forEach((i) => i < length && (arr[i].on = true));
    if (partId === 2) [4, 12].forEach((i) => i < length && (arr[i].on = true));
    if (partId === 5) arr.forEach((s, i) => { if (i % 2 === 1) { s.on = true; s.velocity = 80; } });
    if (partId === 6) [0, 3, 6, 10, 14].forEach((i) => { if (i < length) { arr[i].on = true; arr[i].accent = i === 0; } });
  } else if (length >= 4) {
    if (partId === 0) arr[0].on = true;
    if (partId === 2 && length >= 8) arr[Math.floor(length / 2)].on = true;
  }
  return arr;
}

/** Build a Scene populated with default step arrays for every Part. */
export function buildScene(length: SceneLength, parts: Part[]): Scene {
  const partSteps: Record<number, Step[]> = {};
  const partNotes: Record<number, Note[]> = {};
  for (const p of parts) {
    partSteps[p.id] = buildDefaultSteps(length, p.id);
    partNotes[p.id] = [];
  }
  return { id: nextSceneId(), length, partSteps, partNotes };
}

/** Resize all per-part step arrays in a scene to the new length (truncate/pad). */
export function resizeScene(sc: Scene, len: SceneLength): Scene {
  const partSteps: Record<number, Step[]> = {};
  for (const k of Object.keys(sc.partSteps)) {
    const partId = Number(k);
    const arr = sc.partSteps[partId].slice(0, len);
    while (arr.length < len) arr.push(emptyStep());
    partSteps[partId] = arr;
  }
  const partNotes: Record<number, Note[]> = {};
  for (const k of Object.keys(sc.partNotes)) {
    const partId = Number(k);
    partNotes[partId] = (sc.partNotes[partId] ?? []).filter((n) => n.step < len);
  }
  return { ...sc, length: len, partSteps, partNotes };
}

export function buildDefaultPattern(id: number, parts: Part[]): Pattern {
  return {
    id,
    name: `PTN ${String(id + 1).padStart(3, "0")}`,
    seed: hashSeed(id, 0xC0FFEE),
    swing: 54,
    scenes: [buildScene(16, parts)],
  };
}

/** Total step count across the scene chain (= one full pattern cycle). */
export function patternTotalSteps(p: Pattern): number {
  let sum = 0;
  for (const sc of p.scenes) sum += sc.length;
  return sum;
}

/** Back-compat shim — callers that asked for "pattern length" want the total cycle. */
export function patternLength(p: Pattern): number {
  return patternTotalSteps(p);
}

// ── FX / Mod (unchanged) ───────────────────────────────────────────────────
export type FxType =
  | "Chorus" | "Flanger" | "Ring Mod"
  | "BPM Delay" | "Short Delay" | "Ping Pong"
  | "Hall Reverb" | "Room Reverb" | "Freeze"
  | "Pitch Shift" | "Voice Mod"
  | "EQ" | "Compressor" | "Saturator"
  | "Limiter" | "Stereo Width" | "3D Matrix";

export const SLOT_FX_OPTIONS: FxType[][] = [
  ["Chorus", "Flanger", "Ring Mod"],
  ["BPM Delay", "Short Delay", "Ping Pong"],
  ["Hall Reverb", "Room Reverb", "Freeze"],
  ["Pitch Shift", "Voice Mod"],
  ["EQ", "Compressor", "Saturator"],
  ["Limiter", "Stereo Width", "3D Matrix"],
];

export const FX_PARAM_LABELS: Record<FxType, [string, string, string, string]> = {
  "Chorus":      ["RATE", "DEPTH", "FBK", "TONE"],
  "Flanger":     ["RATE", "DEPTH", "FBK", "DELAY"],
  "Ring Mod":    ["FREQ", "SHAPE", "TONE", "BIAS"],
  "BPM Delay":   ["DIV", "FBK", "TONE", "SPREAD"],
  "Short Delay": ["TIME", "FBK", "TONE", "SPREAD"],
  "Ping Pong":   ["TIME", "FBK", "TONE", "WIDTH"],
  "Hall Reverb": ["SIZE", "DECAY", "DAMP", "PREDLY"],
  "Room Reverb": ["SIZE", "DECAY", "DAMP", "PREDLY"],
  "Freeze":      ["SIZE", "DAMP", "TONE", "HOLD"],
  "Pitch Shift": ["PITCH", "FINE", "FBK", "TONE"],
  "Voice Mod":   ["VOWEL", "Q", "RATE", "TONE"],
  "EQ":          ["LOW", "LO-MID", "HI-MID", "HIGH"],
  "Compressor":  ["THRESH", "RATIO", "ATTACK", "REL"],
  "Saturator":   ["DRIVE", "TYPE", "TONE", "BIAS"],
  "Limiter":     ["THRESH", "REL", "CEIL", "LOOKAH"],
  "Stereo Width":["WIDTH", "BASS", "TILT", "PHASE"],
  "3D Matrix":   ["WIDTH", "HAAS", "ROT", "DEPTH"],
};

export function defaultFxParams(type: FxType | null): Record<string, number> {
  switch (type) {
    case "Chorus":      return { A: 25, B: 40, C: 30, D: 70 };
    case "Flanger":     return { A: 20, B: 50, C: 65, D: 30 };
    case "Ring Mod":    return { A: 40, B: 0, C: 60, D: 50 };
    case "BPM Delay":   return { A: 50, B: 55, C: 60, D: 50 };
    case "Short Delay": return { A: 35, B: 40, C: 60, D: 40 };
    case "Ping Pong":   return { A: 50, B: 55, C: 60, D: 80 };
    case "Hall Reverb": return { A: 70, B: 65, C: 40, D: 20 };
    case "Room Reverb": return { A: 35, B: 40, C: 55, D: 10 };
    case "Freeze":      return { A: 90, B: 30, C: 60, D: 100 };
    case "Pitch Shift": return { A: 50, B: 50, C: 30, D: 60 };
    case "Voice Mod":   return { A: 40, B: 55, C: 25, D: 60 };
    case "EQ":          return { A: 50, B: 50, C: 50, D: 50 };
    case "Compressor":  return { A: 55, B: 40, C: 20, D: 40 };
    case "Saturator":   return { A: 45, B: 0, C: 55, D: 50 };
    case "Limiter":     return { A: 80, B: 30, C: 90, D: 50 };
    case "Stereo Width":return { A: 65, B: 30, C: 50, D: 50 };
    case "3D Matrix":   return { A: 75, B: 40, C: 35, D: 55 };
    default:            return { A: 50, B: 50, C: 50, D: 50 };
  }
}

export type FxRouting = "serial" | "parallel" | "hybrid";

export interface FxSlot {
  slot: "A" | "B" | "C" | "D" | "E" | "F";
  type: FxType | null;
  mix: number;
  boost: number;
  bypass: boolean;
  params: Record<string, number>;
}

export type ModSource = "LFO 1" | "LFO 2" | "ENV 1" | "ENV 2" | "Step LFO" | "Velocity" | "Random" | "Ribbon" | "MIDI CC";
export const MOD_SOURCES: ModSource[] = ["LFO 1", "LFO 2", "ENV 1", "ENV 2", "Step LFO", "Velocity", "Random", "Ribbon", "MIDI CC"];

export type ModDestParam =
  | "Pitch" | "Filter Cutoff" | "Resonance" | "Volume" | "Pan"
  | "Delay Wet" | "Reverb Wet" | "Chorus Depth" | "Flanger Depth" | "RingMod Amount"
  | "Sample Start" | "Sample End"
  | "Grain Size" | "Grain Density" | "Grain Position" | "Spray" | "Stereo Width"
  | "Freeze Position" | "Freeze Mix" | "Stretch Amount";
export const MOD_DEST_PARAMS: ModDestParam[] = [
  "Pitch", "Filter Cutoff", "Resonance", "Volume", "Pan",
  "Delay Wet", "Reverb Wet", "Chorus Depth", "Flanger Depth", "RingMod Amount",
  "Sample Start", "Sample End",
  "Grain Size", "Grain Density", "Grain Position", "Spray", "Stereo Width",
  "Freeze Position", "Freeze Mix", "Stretch Amount",
];

export type ModCurve = "lin" | "exp" | "log" | "snh";
export const MOD_CURVES: ModCurve[] = ["lin", "exp", "log", "snh"];

export interface ModRoute {
  id: string;
  source: ModSource;
  destParam: ModDestParam;
  partId: number;
  amount: number;
  curve: ModCurve;
  enabled: boolean;
  /** MIDI CC number (0–127) used when source === "MIDI CC". Defaults to 0. */
  cc?: number;
}

export const PART_PRESETS: Pick<Part, "name" | "category" | "color">[] = [
  { name: "KICK 1", category: "kick", color: "part-kick" },
  { name: "KICK 2", category: "kick", color: "part-kick" },
  { name: "SNARE 1", category: "snare", color: "part-snare" },
  { name: "SNARE 2", category: "snare", color: "part-snare" },
  { name: "PERC", category: "perc", color: "part-perc" },
  { name: "HAT", category: "hat", color: "part-hat" },
  { name: "BASS 1", category: "bass", color: "part-bass" },
  { name: "BASS 2", category: "bass", color: "part-bass" },
  { name: "SYNTH 1", category: "synth", color: "part-synth" },
  { name: "SYNTH 2", category: "synth", color: "part-synth" },
  { name: "SMPL 1", category: "sample", color: "part-sample" },
  { name: "SMPL 2", category: "sample", color: "part-sample" },
  { name: "SMPL 3", category: "sample", color: "part-sample" },
  { name: "SMPL 4", category: "sample", color: "part-sample" },
  { name: "SMPL 5", category: "sample", color: "part-sample" },
  { name: "SMPL 6", category: "sample", color: "part-sample" },
];

export function buildDefaultParts(): Part[] {
  return PART_PRESETS.map((p, i) => {
    const engine = engineForCategory(p.category);
    const isSample = p.category === "sample";
    return {
      ...p,
      id: i,
      volume: 78, pan: 0, pitch: 0,
      mute: false, solo: false,
      busTarget: null,
      sends: [0, 0, 0, 0, 0, 0],
      sampleName: null,
      channel: defaultChannel(),
      source: isSample ? "sample" : "synth",
      wave: defaultWave(),
      synth: defaultSynth(engine),
      hybrid: defaultHybrid(),
    } as Part;
  });
}

export const SAMPLE_LIBRARY: Record<PartCategory, string[]> = {
  kick:   ["Kick 01", "Kick 02", "Kick 03", "Kick 04", "Kick 05", "Kick 06", "Kick 07", "Kick 08"],
  snare:  ["Snare 01", "Snare 02", "Snare 03", "Snare 04", "Snare 05", "Snare 06"],
  perc:   ["Perc 01", "Perc 02", "Perc 03", "Perc 04", "Perc 05"],
  hat:    ["Hat 01", "Hat 02", "Hat 03", "Hat 04", "Hat 05", "Hat 06"],
  bass:   ["Bass 01", "Bass 02", "Bass 03", "Bass 04"],
  synth:  ["Synth 01", "Synth 02", "Synth 03", "Synth 04"],
  sample: ["User 01", "User 02", "User 03", "User 04"],
};

export function buildDefaultFx(): FxSlot[] {
  const slots: FxSlot["slot"][] = ["A", "B", "C", "D", "E", "F"];
  const defaults: FxType[] = ["Chorus", "BPM Delay", "Hall Reverb", "Pitch Shift", "EQ", "Limiter"];
  return slots.map((s, i) => ({
    slot: s,
    type: defaults[i],
    mix: i === 5 ? 70 : 30 + i * 6,
    boost: 0,
    bypass: false,
    params: defaultFxParams(defaults[i]),
  }));
}

export function buildDefaultMod(): ModRoute[] {
  return [
    { id: "m1", source: "LFO 1",    destParam: "Filter Cutoff", partId: 6, amount: 45,  curve: "lin", enabled: true },
    { id: "m2", source: "ENV 1",    destParam: "Pitch",         partId: 0, amount: -32, curve: "exp", enabled: true },
    { id: "m3", source: "Velocity", destParam: "Volume",        partId: 2, amount: 28,  curve: "lin", enabled: true },
    { id: "m4", source: "Step LFO", destParam: "Resonance",     partId: 8, amount: 60,  curve: "snh", enabled: true },
    { id: "m5", source: "Ribbon",   destParam: "Delay Wet",     partId: 8, amount: 80,  curve: "lin", enabled: false },
  ];
}

export function partAndParamLabel(parts: Part[], r: ModRoute): string {
  const p = parts[r.partId];
  return `${p?.name ?? `PART ${r.partId + 1}`} ▸ ${r.destParam}`;
}