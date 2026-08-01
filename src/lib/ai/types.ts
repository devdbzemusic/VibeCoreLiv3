// VibeCore AI — Shared Types.
//
// VibeCore AI ist KEIN Chatbot und KEINE eigene Engine. Es besitzt keine
// eigene Audio Engine, keinen DSP Core, keinen Sequencer, keine Clock und
// keine eigene Projektverwaltung. Alle Assistenzfunktionen sind PURE,
// DETERMINISTISCHE Funktionen, die Vorschläge (Suggestions) erzeugen, die
// der Nutzer bestätigt und die über bestehende Store-Actions angewendet
// werden (setNotes, setPatternSteps, setChainSteps, setArp, setSend, …).
//
// Jede Suggestion ist:
//   • deterministisch reproduzierbar (seed-basiert)
//   • musikalisch nachvollziehbar (liefert label/description/reason)
//   • jederzeit rückgängig (angewendet über immutable Store-Actions)
//   • ausschließlich assistierend (keine automatischen Mutationen)

import type { Step, Note, Part, Pattern, Scene, ChainStep, FxSlot, MasterChannel } from "@/lib/model";
import type { AutomationLane } from "@/lib/fxmixlab/types";
import type { ArpConfig } from "@/lib/audio/arpEngine";

// ── Scale / Harmony ──────────────────────────────────────────────────────────

export type ScaleType =
  | "major" | "minor" | "dorian" | "phrygian" | "lydian" | "mixolydian"
  | "harmonicMinor" | "minorPent" | "majorPent" | "blues" | "chromatic";

export interface HarmonyContext {
  /** Root pitch class 0..11 (C=0). */
  root: number;
  scale: ScaleType;
  /** Optional chord progression as scale-degree indices (0 = I/i). */
  progression?: number[];
}

// ── Context Snapshot (pure read from store — never touches audio path) ────────

export interface ContextSnapshot {
  bpm: number;
  playing: boolean;
  currentPattern: number;
  selectedPattern: number;
  selectedSceneIdx: number;
  sceneLength: number;
  swing: number;
  parts: Part[];
  patterns: Pattern[];
  currentScene?: Scene;
  harmony: HarmonyContext;
  /** Musical energy 0..1 (inferred from step density + velocity). */
  energy: number;
  /** Rhythmic density 0..1 (active steps / total). */
  density: number;
  genre?: string;
  fx: FxSlot[];
  master: MasterChannel;
  chainSteps: ChainStep[];
  songTicks: number;
  arp: ArpConfig;
}

// ── Suggestion (the unified AI proposal format) ───────────────────────────────

export type SuggestionKind =
  | "groove" | "melody" | "harmony" | "automation" | "arrangement"
  | "mix" | "sample" | "voice" | "remix" | "live" | "preset";

export interface Suggestion<T = unknown> {
  /** Deterministic id (seed-derived). Same seed + kind + index → same id. */
  id: string;
  kind: SuggestionKind;
  /** Short human-readable label. */
  label: string;
  /** Musical rationale (why this suggestion fits the context). */
  description: string;
  /** 0..1 — AI confidence in the suggestion. */
  confidence: number;
  /** Deterministic reproduction key. Same seed + context → identical payload. */
  seed: number;
  /** Data payload — the UI applies this via existing Store actions. */
  payload: T;
}

// ── Payload types (what each suggestion carries for the UI to apply) ──────────

/** Groove payload: per-part step arrays (applied via setPatternSteps). */
export interface GroovePayload {
  stepsByPart: Record<number, Step[]>;
}

/** Melody payload: notes for a target part (applied via setNotes/replaceNotes). */
export interface MelodyPayload {
  partId: number;
  notes: Omit<Note, "id">[];
}

/** Harmony payload: chord pitches + progression (applied via setNotes on pad/synth part). */
export interface HarmonyPayload {
  progression: number[][];   // midi pitches per chord
  voicing: number[][];       // voiced chords
  scale: ScaleType;
  root: number;
}

/** Automation payload: automation lanes (applied via FX Mix Lab automation). */
export interface AutomationPayload {
  lanes: AutomationLane[];
}

/** Arrangement payload: song-mode chain steps (applied via setChainSteps). */
export interface ArrangementPayload {
  chainSteps: ChainStep[];
  structure: ArrangementSection[];
}

export interface ArrangementSection {
  name: string;
  patternId: number;
  repeat: number;
  bars: number;
}

/** Mix payload: mix suggestions (applied via setPartVolume/setSend/setMaster). */
export interface MixPayload {
  partId?: number;
  param: "volume" | "pan" | "send" | "master_eqLow" | "master_eqMid" | "master_eqHigh" | "master_width" | "fx_param";
  fxIdx?: number;
  fxParamKey?: string;
  value: number;
  reason: string;
}

/** Sample payload: slice/loop/classify metadata (applied via setPartSlices/setWaveEdit). */
export interface SamplePayload {
  partId?: number;
  slices?: Array<{ start: number; end?: number; name?: string; velocity?: number }>;
  loop?: { startNorm: number; endNorm: number; bpm: number; bars: number };
  tags?: string[];
  classification?: string;
}

/** Voice payload: vocal notes (applied via setNotes). */
export interface VoicePayload {
  partId: number;
  notes: Omit<Note, "id">[];
  harmony?: Omit<Note, "id">[];
}

/** Remix payload: remix structure idea (applied via chain/pattern actions). */
export interface RemixPayload {
  idea: string;
  chainSteps?: ChainStep[];
  variations?: Array<{ partId: number; description: string }>;
}

/** Live payload: live performance suggestion (confirmed by user during playback). */
export interface LivePayload {
  action: "fill" | "variation" | "break" | "fx" | "pattern_switch" | "arp";
  description: string;
  stepsByPart?: Record<number, Step[]>;
  notes?: Omit<Note, "id">[];
  arpPatch?: Partial<ArpConfig>;
  targetPattern?: number;
}

/** Preset payload: genre preset (applied via multiple store actions). */
export interface PresetPayload {
  genre: string;
  bpm: number;
  swing: number;
  scale: ScaleType;
  root: number;
  density: number;
  energy: number;
  arp: Partial<ArpConfig>;
  structure?: ArrangementSection[];
}