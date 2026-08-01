// VibeCore FX Mix Lab — Type Definitions.
//
// FX Mix Lab is the central mixing, routing, and mastering platform for
// VibeCoreLiv3. It extends — never replaces — the existing Audio Engine,
// DSP Core, Groove, and Sample Forge modules.
//
// All types here are pure data models (JSON-serialisable for VCL3 persistence).
// No runtime audio nodes live in this file.

import type { FxType } from "@/lib/model";

// ── Insert FX ────────────────────────────────────────────────────────────────

/** Insert FX types available per channel. Each maps to a DSP Core factory
 *  (or a composition of DSP Core primitives). No duplicate DSP — all signal
 *  processing uses the existing DSP Core library. */
export type InsertFxType =
  | "EQ" | "Compressor" | "Limiter" | "Gate" | "Expander"
  | "Distortion" | "Saturation" | "Tube" | "Tape" | "Foldback" | "Bitcrush"
  | "Chorus" | "Flanger" | "Phaser" | "Delay" | "Reverb"
  | "Filter LP" | "Filter HP" | "Filter BP" | "Filter Notch"
  | "Stereo Width" | "Ring Mod" | "DC Blocker";

/** Parameters for an insert FX slot. Normalised 0..100 for most, with
 *  type-specific meaning documented in insertChain.ts. */
export interface InsertSlot {
  id: string;
  type: InsertFxType;
  bypass: boolean;
  mix: number;        // 0..100 (dry/wet)
  params: Record<string, number>;
}

// ── Mixer Channels ───────────────────────────────────────────────────────────

/** A part channel's mixing parameters (extends the existing Part model).
 *  `inserts` is the ordered insert-FX chain for this channel. */
export interface MixerChannel {
  partId: number;
  phaseInvert: boolean;
  inserts: InsertSlot[];
  /** Send levels per send-bus (0..100). -1 = pre-fader, 0..100 = post-fader level. */
  sends: { busId: string; level: number; preFader: boolean }[];
  /** Bus routing target — "master" or a bus channel id. */
  busTarget: string;
}

/** A bus channel (subgroup). Receives routed parts, has its own inserts,
 *  and feeds master or another bus. */
export interface BusChannel {
  id: string;
  name: string;
  color?: string;
  volume: number;     // 0..100
  pan: number;        // -50..50
  mute: boolean;
  solo: boolean;
  phaseInvert: boolean;
  inserts: InsertSlot[];
  busTarget: string;  // "master" or another bus id (no loops!)
}

/** A return channel for send FX. Receives from send buses. */
export interface ReturnChannel {
  id: string;
  name: string;
  fxType: FxType | null;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  inserts: InsertSlot[];
}

// ── Automation ───────────────────────────────────────────────────────────────

export type AutomationTarget =
  | "volume" | "pan" | "mute" | "solo" | "phaseInvert"
  | "send" | "insertParam" | "bypass" | "busVolume" | "busPan";

export type AutomationCurve = "lin" | "exp" | "log" | "step" | "snh";

/** A single automation point. `songTicks` is the global transport position
 *  (from VibeCore Sync) — sample-accurate when converted via AudioContext.currentTime. */
export interface AutomationPoint {
  songTicks: number;
  value: number;
  curve: AutomationCurve;
}

/** An automation lane targets one parameter on one channel/bus/return. */
export interface AutomationLane {
  id: string;
  target: AutomationTarget;
  /** Channel target: "part:<id>", "bus:<id>", "return:<id>", "master". */
  channelRef: string;
  /** For send/insertParam/bypass targets: the send bus id or insert slot id. */
  paramRef?: string;
  points: AutomationPoint[];
  enabled: boolean;
}

// ── Analyzer ─────────────────────────────────────────────────────────────────

export interface AnalyzerSnapshot {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  lufsIntegrated: number;
  lufsShortTerm: number;
  crestFactor: number;       // dB
  stereoBalance: number;     // -1 (L) .. +1 (R)
  phaseCorrelation: number;   // -1 (anti) .. +1 (mono)
  headroomDb: number;         // dB below 0 dBFS
  clipping: boolean;
  spectrum?: Float32Array;    // optional FFT bins (0..1 per bin)
}

// ── Mix Preset ───────────────────────────────────────────────────────────────

export interface MixPreset {
  id: string;
  name: string;
  description?: string;
  channels: MixerChannel[];
  buses: BusChannel[];
  returns: ReturnChannel[];
  automation: AutomationLane[];
}

// ── AI Mix Suggestion ─────────────────────────────────────────────────────────

export interface MixSuggestion {
  type: "gain" | "eq" | "dynamics" | "stereo" | "routing" | "fx";
  channelRef: string;
  paramRef?: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
  confidence: number;  // 0..1
}

export interface MixAnalysis {
  suggestions: MixSuggestion[];
  overallLoudness: number;     // LUFS integrated
  stereoWidth: number;         // 0..1
  dynamicRange: number;       // dB crest factor
  clippingRisk: boolean;
}