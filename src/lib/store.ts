// VibeCoreLiv3 — Zustand store (Pattern-Domain v12).
//
// Pattern-Domain Spec (Workspace + User-Prompt):
//   Project → Pattern Parts (1..111) → Scenes (1..8) → Steps (4|8|16)
// Within ONE scene every Stereo Sample Part shares the same step count.
// Polymetry exists between consecutive scenes, never between simultaneous
// parts of the same scene.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  buildDefaultFx, buildDefaultMod, buildDefaultParts, buildDefaultPattern,
  buildScene, defaultFxParams, defaultMaster, defaultSynth,
  emptyStep, MAX_PATTERN_PARTS, MAX_SCENES_PER_PATTERN, nextSceneId, patternTotalSteps,
  resizeScene, snapSceneLength,
  type Channel, type ChainStep, type FxRouting, type FxSlot, type HybridParams,
  type MasterChannel, type ModRoute, type Note, type Part, type Pattern,
  type Scene, type SceneLength, type Slice, type SourceMode, type Step,
  type SynthEngine, type SynthParams, type WaveEdit,
} from "@/lib/model";
import { mulberry32 } from "@/lib/utils/random";
import { defaultSynth3D as _defaultSynth3D, type Synth3DParams } from "@/lib/synth3d/params";
import { defaultBass3D as _defaultBass3D, type Bass3DParams } from "@/lib/bass3d/params";
import { defaultArpConfig, type ArpConfig } from "@/lib/audio/arpEngine";
import { buildGroove } from "@/lib/audio/aiSceneBuild";

export type TabKey = "HOME" | "MIX" | "SEQ" | "ROLL" | "ARP" | "FX" | "SMPL" | "SND" | "BRN" | "SPC" | "AI" | "PROD" | "SYNC" | "SETUP" | "DBG" | "LIB" | "VOICE" | "REMIX" | "PTN" | "PERF" | "SYNTH3D" | "BASS3D";
export type QualityMode = "AUTO" | "LOW" | "MEDIUM" | "HIGH";
export type QualityLevel = "LOW" | "MEDIUM" | "HIGH";
export type PsychoPresetName = "NEUTRAL" | "WARM" | "CRUNCH" | "HI_DEF";
export type ChainMode = "IMMEDIATE" | "BOUNDARY";

// ── AI activity log + global style (Band 8) ─────────────────────────────────
export type AiStyle =
  | "CLASSIC" | "MINIMAL" | "COMPLEX" | "ORGANIC"
  | "DIGITAL" | "CINEMATIC" | "HYPNOTIC" | "GLITCH";

export interface AiHistoryEntry {
  id: string;
  timestamp: number;
  /** Human-readable label: "Generated groove", "Optimized synth", etc. */
  action: string;
  /** Module short-name: "GROOVE", "3D SYNTH", "3D BASS", "FX MIX LAB", etc. */
  module: string;
  description?: string;
}

// ── VibeCore Sync — transport extensions (Band 4 §6.1) ─────────────────────
/** Quantise grid for transport transitions (queued pattern switch / seek). */
export type QuantizeGrid = "off" | "1/16" | "1/8" | "1/4" | "1";

/** External sync source name — mirrors `clock/types::ClockSource` without
 *  importing the clock module (keeps the store free of runtime clock deps). */
export type SyncSourceName = "internal" | "midi" | "link" | "adaptive" | "hybrid";

/** Live external-sync status (transient, not persisted). */
export interface SyncStatus {
  source: SyncSourceName;
  confidence: number;       // 0..1
  externalActive: boolean;
  midiConnected: boolean;
  error: string | null;
}

/** Frozen transport position captured on Stop (Pause), restored on Continue. */
export interface HeldPosition {
  step: number;
  sceneIdx: number;
  songTicks: number;
  beat: number;
}

/** Pending quantised jump target (transient). */
export interface PendingSeek {
  sceneIdx: number;
  step: number;
}

// ── Transport ───────────────────────────────────────────────────────────────
// `currentStep` is shared by all parts of the current scene (spec: same step
// count per scene). `currentSceneIdx` is the active scene inside the current
// pattern; `sceneLoopCount` counts full pattern cycles (chain wraps).
export interface TransportState {
  playing: boolean;
  currentPattern: number;
  chain: number[];
  /** Enhanced Pattern Chain with per-step repeat counts, skip, markers. */
  chainSteps: ChainStep[];
  /** Transition type applied between chainSteps[i] and chainSteps[i+1]. */
  chainStepTransitions: string[];
  /** Current position inside `chainSteps` (transient — scheduler-managed). */
  chainPos?: number;
  /** Remaining repeats for the current chain step (transient). */
  chainRepeatLeft?: number;
  queuedPattern: number | null;
  chainMode: ChainMode;
  currentStep: number;
  currentSceneIdx: number;
  sceneLoopCount: number;
  /** Quantise grid for queued switches / seeks (persisted; default "off"). */
  quantizeGrid?: QuantizeGrid;
  /** Frozen position captured on Pause, restored on Continue (transient). */
  held?: HeldPosition | null;
  /** Pending quantised jump target (transient; consumed by the scheduler). */
  pendingSeek?: PendingSeek | null;
  /** One-shot rewind flag — stops the scheduler from capturing held (transient). */
  rewind?: boolean;
  /** Live external-sync status (transient, not persisted). */
  syncStatus?: SyncStatus;
}

function emptyTransport(currentPattern = 0): TransportState {
  return {
    playing: false,
    currentPattern,
    chain: [],
    chainSteps: [],
    chainStepTransitions: [],
    chainPos: 0,
    chainRepeatLeft: 0,
    queuedPattern: null,
    chainMode: "BOUNDARY",
    currentStep: 0,
    currentSceneIdx: 0,
    sceneLoopCount: 0,
    quantizeGrid: "off",
    held: null,
    pendingSeek: null,
    rewind: false,
    syncStatus: { source: "internal", confidence: 1, externalActive: false, midiConnected: false, error: null },
  };
}

interface State {
  transport: TransportState;
  /** Live playhead snapshot, written by the scheduler at ~20 Hz. Separate
   *  slice so per-tick writes don't re-render transport-subscribed components. */
  playheads: { step: number; sceneIdx: number; sceneLoop: number; songTicks: number };
  recording: boolean;
  bpm: number;

  // Performance/meters (transient, not persisted)
  cpu: number;
  voices: number;
  activeVoices: number;
  fps: number;
  peakL: number;
  peakR: number;
  partPeaks: number[];
  fxPeaks: number[];
  fxRms: number[];
  fxClip: number[];
  fxFloorDb: number[];
  fxSharedFloor: boolean;

  /** Per-part bus routing: maps part id → engine FX bus index (0–5), or null = direct-to-master. */
  partBusAssignments: Record<number, number | null>;
  /** Per-bus level controls for the 6 engine FX buses.
   *  volume: 0–100 (linear percentage), mute: silences the bus post-FX. */
  busLevels: { volume: number; mute: boolean }[];
  limiterReduction: number;

  audioReady: boolean;
  masterVolume: number;
  master: MasterChannel;

  qualityProfile: QualityMode;
  currentQuality: QualityLevel;
  psychoPreset: PsychoPresetName;

  // Selection (UI only)
  tab: TabKey;
  selectedPart: number;
  selectedPattern: number;
  /** Index into `pattern.scenes` — which Scene-Part the user is editing. */
  selectedSceneIdx: number;
  selectedStep: number | null;
  selectedFxSlot: 0 | 1 | 2 | 3 | 4 | 5;
  selectedMod: string | null;
  showDiag: boolean;
  modActive: number;

  // Data
  parts: Part[];
  patterns: Pattern[];
  fx: FxSlot[];
  fxRouting: FxRouting;
  mod: ModRoute[];

  // Shared SceneStep ArpEngine (VibeCore Sync)
  arp: ArpConfig;

  // ── Actions — UI ──────────────────────────────────────────────────────────
  setTab: (t: TabKey) => void;
  selectPart: (id: number) => void;
  selectPattern: (id: number) => void;
  selectSceneIdx: (idx: number) => void;
  selectStep: (idx: number | null) => void;
  toggleDiag: () => void;
  selectFx: (i: 0 | 1 | 2 | 3 | 4 | 5) => void;

  // ── Actions — transport ──────────────────────────────────────────────────
  togglePlay: () => void;
  toggleRec: () => void;
  setBpm: (n: number) => void;
  queuePattern: (id: number | null) => void;
  setChain: (chain: number[]) => void;
  setChainMode: (mode: ChainMode) => void;
  // ── Pattern Chain (enhanced — Song Mode) ───────────────────────────────
  setChainSteps: (steps: ChainStep[]) => void;
  addToChain: (patternId: number, repeat?: number) => void;
  removeFromChain: (idx: number) => void;
  setChainStepRepeat: (idx: number, repeat: number) => void;
  toggleChainStepSkip: (idx: number) => void;
  setChainStepMarker: (idx: number, marker: string) => void;
  clearChain: () => void;
  moveChainStep: (fromIdx: number, toIdx: number) => void;
  setChainStepTransition: (idx: number, t: string) => void;
  // ── Pattern management ─────────────────────────────────────────────────
  copyPattern: (id: number) => number | null;
  duplicatePattern: (id: number) => number | null;
  clearPattern: (id: number) => void;
  randomizePattern: (id: number) => void;
  renamePattern: (id: number, name: string) => void;
  setPatternColor: (id: number, color: string) => void;
  setPatternTags: (id: number, tags: string[]) => void;
  resetTransport: () => void;
  setPlayhead: (step: number, sceneIdx: number, sceneLoop: number, songTicks?: number) => void;

  // ── VibeCore Sync — quantise / seek / external sync (Band 4 §6.1) ────────
  seekTo: (sceneIdx: number, step: number) => void;
  setQuantizeGrid: (g: QuantizeGrid) => void;
  setSyncStatus: (patch: Partial<SyncStatus>) => void;

  // ── Actions — audio ──────────────────────────────────────────────────────
  setMasterVolume: (v: number) => void;
  setAudioReady: (b: boolean) => void;
  setQualityProfile: (q: QualityMode) => void;
  setPsychoPreset: (p: PsychoPresetName) => void;

  // ── Actions — pattern parts / scenes ─────────────────────────────────────
  addPatternPart: () => number | null;
  removePatternPart: (id: number) => void;
  addScene: (patternId: number, length?: SceneLength) => number | null;
  removeScene: (patternId: number, sceneIdx: number) => void;
  setSceneLength: (patternId: number, sceneIdx: number, len: SceneLength) => void;

  // ── Actions — scene management (copy / paste / duplicate / move) ────────
  copyScene: (patternId: number, sceneIdx: number) => void;
  pasteScene: (patternId: number, afterIdx: number) => void;
  duplicateScene: (patternId: number, sceneIdx: number) => void;
  moveScene: (patternId: number, fromIdx: number, toIdx: number) => void;

  // ── Actions — pattern clipboard (cross-pattern copy / paste) ────────────
  copyPatternToClipboard: (id: number) => void;
  pastePatternFromClipboard: () => number | null;

  // ── Actions — sequencer (per part, current scene) ────────────────────────
  toggleStep: (partId: number, idx: number) => void;
  updateStep: (partId: number, idx: number, patch: Partial<Step>) => void;
  setPatternSteps: (partId: number, steps: Step[]) => void;
  setSwing: (n: number) => void;
  setPatternSeed: (seed: number) => void;

  // Mix / channel / FX / synth / wave
  setPartVolume: (id: number, v: number) => void;
  setPartPan: (id: number, v: number) => void;
  setPartPitch: (id: number, v: number) => void;
  setPartSampleName: (id: number, name: string | null) => void;
  toggleMute: (id: number) => void;
  toggleSolo: (id: number) => void;
  setSend: (partId: number, fxIdx: number, v: number) => void;
  setFxRouting: (r: FxRouting) => void;
  setFxMix: (slot: number, v: number) => void;
  setFxBoost: (slot: number, v: number) => void;
  toggleFxBypass: (slot: number) => void;
  toggleFxSharedFloor: () => void;
  /** Route a part's dry (main) output to a numbered FX bus, or null to return it to master. */
  setPartBusAssignment: (partId: number, busIdx: number | null) => void;
  /** Update the volume/mute for one of the 6 engine FX buses. volume: 0–100. */
  setBusLevelAction: (busIdx: number, volume: number, mute: boolean) => void;
  /** Toggle one bus mute state without changing its current volume. */
  toggleBusMute: (busIdx: number) => void;
  setFxType: (slot: number, t: FxSlot["type"]) => void;
  setFxParam: (slot: number, key: string, v: number) => void;
  setChannel: (id: number, patch: Partial<Channel>) => void;
  setMaster: (patch: Partial<MasterChannel>) => void;
  setPartSource: (id: number, src: SourceMode) => void;
  setWaveEdit: (id: number, patch: Partial<WaveEdit>) => void;
  /** Persist slice metadata (positions, names, colors, velocities) for a part.
   *  Also updates `wave.slices` (count) to stay in sync. */
  setPartSlices: (id: number, slices: Slice[]) => void;
  setSynthEngine: (id: number, engine: SynthEngine) => void;
  setSynthParam: (id: number, key: keyof SynthParams, v: number) => void;
  setSynth3D: (id: number, patch: Partial<Synth3DParams>) => void;
  setBass3D: (id: number, patch: Partial<Bass3DParams>) => void;
  setHybridParam: (id: number, patch: Partial<HybridParams>) => void;

  // Notes (per part in current scene)
  addNote: (partId: number, n: Omit<Note, "id">) => string;
  updateNote: (partId: number, id: string, patch: Partial<Note>) => void;
  removeNote: (partId: number, id: string) => void;
  /** Replace all notes of a part in the current scene (AI co-assistant melody write). */
  setNotes: (partId: number, notes: Omit<Note, "id">[]) => void;
  /** Replace all notes of a part in the current scene, preserving IDs (undo/redo restore). */
  replaceNotes: (partId: number, notes: Note[]) => void;
  quantizeNotes: (partId: number, grid?: number) => void;

  // Modulation
  addModRoute: (r?: Partial<ModRoute>) => string;
  updateModRoute: (id: string, patch: Partial<ModRoute>) => void;
  removeModRoute: (id: string) => void;
  toggleModRoute: (id: string) => void;
  selectMod: (id: string | null) => void;

  // ── Actions — ArpEngine ─────────────────────────────────────────────────
  setArp: (patch: Partial<ArpConfig>) => void;
  toggleArpStep: (idx: number) => void;

  // ── AI activity log + global style (Band 8) ──────────────────────────────
  aiHistory: AiHistoryEntry[];
  aiStyle: AiStyle;
  addAiHistoryEntry: (entry: Omit<AiHistoryEntry, "id" | "timestamp">) => void;
  clearAiHistory: () => void;
  setAiStyle: (s: AiStyle) => void;
}

const parts0 = buildDefaultParts();
const patterns0: Pattern[] = Array.from({ length: 8 }, (_, i) => buildDefaultPattern(i, parts0));

// Mutate the active Scene (selectedSceneIdx) inside the currently-edited Pattern.
function withCurrentScene(
  state: State,
  fn: (sc: Scene) => Scene,
): Partial<State> {
  const patIdx = state.selectedPattern;
  const pat = state.patterns[patIdx];
  if (!pat) return {};
  const sIdx = Math.min(state.selectedSceneIdx, pat.scenes.length - 1);
  const sc = pat.scenes[sIdx];
  if (!sc) return {};
  const nextSc = fn(sc);
  if (nextSc === sc) return {};
  const scenes = pat.scenes.slice();
  scenes[sIdx] = nextSc;
  const patterns = state.patterns.slice();
  patterns[patIdx] = { ...pat, scenes };
  return { patterns };
}

let _idCounter = 0;
let _sceneClipboard: Scene | null = null;
let _patternClipboard: Pattern | null = null;
function nextId(prefix: string): string {
  _idCounter = (_idCounter + 1) >>> 0;
  return `${prefix}${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}

export const useGroove = create<State>()(persist((set) => ({
  transport: emptyTransport(0),
  playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks: 0 },
  recording: false,
  bpm: 124,

  cpu: 34,
  voices: 32,
  activeVoices: 0,
  fps: 60,
  peakL: 0, peakR: 0,
  partPeaks: Array.from({ length: 16 }, () => 0),
  fxPeaks: Array.from({ length: 6 }, () => 0),
  fxRms: Array.from({ length: 6 }, () => 0),
  fxClip: Array.from({ length: 6 }, () => 0),
  fxFloorDb: Array.from({ length: 6 }, () => -60),
  fxSharedFloor: false,
  partBusAssignments: {},
  busLevels: Array.from({ length: 6 }, () => ({ volume: 100, mute: false })),
  limiterReduction: 0,

  audioReady: false,
  masterVolume: 82,
  master: defaultMaster(),

  qualityProfile: "AUTO",
  currentQuality: "HIGH",
  psychoPreset: "NEUTRAL",

  tab: "HOME" as TabKey,
  selectedPart: 0,
  selectedPattern: 0,
  selectedSceneIdx: 0,
  selectedStep: null,
  selectedFxSlot: 0,
  selectedMod: null,
  showDiag: false,
  modActive: 0,

  parts: parts0,
  patterns: patterns0,
  fx: buildDefaultFx(),
  fxRouting: "hybrid",
  mod: buildDefaultMod(),
  arp: defaultArpConfig(),
  aiHistory: [],
  aiStyle: "CLASSIC" as AiStyle,

  // ── UI ───────────────────────────────────────────────────────────────────
  setTab: (t) => set({ tab: t }),
  selectPart: (id) => set({ selectedPart: id, selectedStep: null }),
  selectPattern: (id) => set((s) => {
    if (s.transport.playing && id !== s.transport.currentPattern) {
      return {
        selectedPattern: id,
        selectedSceneIdx: 0,
        selectedStep: null,
        transport: { ...s.transport, queuedPattern: id },
      };
    }
    return {
      selectedPattern: id,
      selectedSceneIdx: 0,
      selectedStep: null,
      transport: { ...s.transport, currentPattern: id, queuedPattern: null,
                   currentStep: 0, currentSceneIdx: 0, sceneLoopCount: 0 },
    };
  }),
  selectSceneIdx: (idx) => set((s) => {
    const pat = s.patterns[s.selectedPattern];
    if (!pat) return {};
    const clamped = Math.max(0, Math.min(pat.scenes.length - 1, Math.floor(idx)));
    return { selectedSceneIdx: clamped, selectedStep: null };
  }),
  selectStep: (idx) => set({ selectedStep: idx }),
  toggleDiag: () => set((s) => ({ showDiag: !s.showDiag })),
  selectFx: (i) => set({ selectedFxSlot: i }),

  // ── Transport ────────────────────────────────────────────────────────────
  togglePlay: () => set((s) => {
    if (s.transport.playing) {
      // Stop / Pause — the scheduler captures the held position (unless a
      // rewind flag is set, in which case stopScheduler discards it).
      return { transport: { ...s.transport, playing: false, queuedPattern: null } };
    }
    // Play — Start from 0 OR Continue from held. The scheduler reads
    // transport.held in startScheduler to decide; if a Stop/Rewind cleared
    // held, playback restarts at beat 0, otherwise it resumes in place.
    const held = s.transport.held;
    return {
      transport: {
        ...s.transport,
        playing: true,
        currentPattern: s.selectedPattern,
        queuedPattern: null,
        currentStep: held ? held.step : 0,
        currentSceneIdx: held ? held.sceneIdx : 0,
      },
    };
  }),
  toggleRec: () => set((s) => ({ recording: !s.recording })),
  setBpm: (n) => set({ bpm: Math.max(40, Math.min(240, n)) }),
  queuePattern: (id) => set((s) => ({ transport: { ...s.transport, queuedPattern: id } })),
  setChain: (chain) => set((s) => ({ transport: { ...s.transport, chain: chain.slice() } })),
  setChainMode: (mode) => set((s) => ({ transport: { ...s.transport, chainMode: mode } })),

  // ── Pattern Chain (enhanced) ────────────────────────────────────────────
  setChainSteps: (steps) => set((s) => ({
    // Reset transitions when a whole new chain is applied (AI structure, etc.)
    transport: {
      ...s.transport,
      chainSteps: steps.slice(),
      chainStepTransitions: [],
      chainPos: 0,
      chainRepeatLeft: 0,
    },
  })),
  addToChain: (patternId, repeat = 1) => set((s) => ({
    transport: { ...s.transport, chainSteps: [...s.transport.chainSteps, { patternId, repeat }] },
  })),
  removeFromChain: (idx) => set((s) => ({
    transport: {
      ...s.transport,
      chainSteps: s.transport.chainSteps.filter((_, i) => i !== idx),
      chainStepTransitions: (s.transport.chainStepTransitions ?? []).filter((_, i) => i !== idx),
    },
  })),
  setChainStepRepeat: (idx, repeat) => set((s) => ({
    transport: {
      ...s.transport,
      chainSteps: s.transport.chainSteps.map((st, i) => i === idx ? { ...st, repeat: Math.max(1, repeat) } : st),
    },
  })),
  toggleChainStepSkip: (idx) => set((s) => ({
    transport: {
      ...s.transport,
      chainSteps: s.transport.chainSteps.map((st, i) => i === idx ? { ...st, skip: !st.skip } : st),
    },
  })),
  setChainStepMarker: (idx, marker) => set((s) => ({
    transport: {
      ...s.transport,
      chainSteps: s.transport.chainSteps.map((st, i) => i === idx ? { ...st, marker } : st),
    },
  })),
  clearChain: () => set((s) => ({
    transport: { ...s.transport, chainSteps: [], chainStepTransitions: [], chainPos: 0, chainRepeatLeft: 0 },
  })),
  moveChainStep: (fromIdx, toIdx) => set((s) => {
    const steps = s.transport.chainSteps.slice();
    if (fromIdx < 0 || fromIdx >= steps.length || toIdx < 0 || toIdx >= steps.length) return {};
    const [moved] = steps.splice(fromIdx, 1);
    steps.splice(toIdx, 0, moved);
    // Keep transitions aligned with reordered steps
    const trans = [...(s.transport.chainStepTransitions ?? [])];
    const [movedTrans] = trans.splice(fromIdx, 1);
    trans.splice(toIdx, 0, movedTrans ?? "CUT");
    return { transport: { ...s.transport, chainSteps: steps, chainStepTransitions: trans } };
  }),

  // ── Pattern management ──────────────────────────────────────────────────
  copyPattern: (id) => {
    let newId: number | null = null;
    set((s) => {
      if (s.patterns.length >= MAX_PATTERN_PARTS) return {};
      const src = s.patterns[id];
      if (!src) return {};
      newId = s.patterns.length;
      const clone: Pattern = {
        ...src,
        id: newId,
        name: `${src.name} COPY`,
        seed: (src.seed ^ 0xABCD) >>> 0,
        scenes: src.scenes.map((sc) => ({
          ...sc,
          id: nextSceneId(),
          partSteps: Object.fromEntries(
            Object.entries(sc.partSteps).map(([k, v]) => [k, v.map((st) => ({ ...st }))]),
          ),
          partNotes: Object.fromEntries(
            Object.entries(sc.partNotes).map(([k, v]) => [k, (v as Note[]).map((n) => ({ ...n }))]),
          ),
        })),
      };
      return { patterns: [...s.patterns, clone] };
    });
    return newId;
  },
  duplicatePattern: (id) => {
    let newId: number | null = null;
    set((s) => {
      if (s.patterns.length >= MAX_PATTERN_PARTS) return {};
      const src = s.patterns[id];
      if (!src) return {};
      newId = s.patterns.length;
      const clone: Pattern = {
        ...src,
        id: newId,
        name: `${src.name} DUP`,
        seed: (src.seed ^ 0x1234) >>> 0,
        scenes: src.scenes.map((sc) => ({
          ...sc,
          id: nextSceneId(),
          partSteps: Object.fromEntries(
            Object.entries(sc.partSteps).map(([k, v]) => [k, v.map((st) => ({ ...st }))]),
          ),
          partNotes: Object.fromEntries(
            Object.entries(sc.partNotes).map(([k, v]) => [k, (v as Note[]).map((n) => ({ ...n }))]),
          ),
        })),
      };
      return { patterns: [...s.patterns, clone], selectedPattern: newId };
    });
    return newId;
  },
  clearPattern: (id) => set((s) => {
    const pat = s.patterns[id];
    if (!pat) return {};
    const scenes = pat.scenes.map((sc) => ({
      ...sc,
      partSteps: Object.fromEntries(
        Object.entries(sc.partSteps).map(([k, v]) => [k, v.map(() => emptyStep())]),
      ),
      partNotes: Object.fromEntries(
        Object.entries(sc.partNotes).map(([k]) => [k, []]),
      ),
    }));
    const patterns = s.patterns.slice();
    patterns[id] = { ...pat, scenes };
    return { patterns };
  }),
  randomizePattern: (id) => set((s) => {
    const pat = s.patterns[id];
    if (!pat) return {};
    // Use the AI groove generator to fill all rhythm parts in all scenes.
    const scenes = pat.scenes.map((sc) => {
      const groove = buildGroove({
        seed: (pat.seed ^ (sc.id.charCodeAt(0) || 0xC0FFEE)) >>> 0,
        length: sc.length,
        density: 0.5 + (pat.seed % 30) / 100,
      });
      const partSteps = { ...sc.partSteps };
      for (const p of s.parts) {
        const cat = p.category;
        if (groove[cat]) {
          const arr = groove[cat].slice(0, sc.length);
          while (arr.length < sc.length) arr.push(emptyStep());
          partSteps[p.id] = arr;
        }
      }
      return { ...sc, partSteps };
    });
    const patterns = s.patterns.slice();
    patterns[id] = { ...pat, scenes };
    return { patterns };
  }),
  renamePattern: (id, name) => set((s) => ({
    patterns: s.patterns.map((p) => p.id === id ? { ...p, name } : p),
  })),
  setPatternColor: (id, color) => set((s) => ({
    patterns: s.patterns.map((p) => p.id === id ? { ...p, color } : p),
  })),
  setPatternTags: (id, tags) => set((s) => ({
    patterns: s.patterns.map((p) => p.id === id ? { ...p, tags: tags.slice() } : p),
  })),
  resetTransport: () => set((s) => ({
    transport: {
      ...emptyTransport(s.selectedPattern),
      quantizeGrid: s.transport.quantizeGrid ?? "off",
      syncStatus: s.transport.syncStatus ?? { source: "internal", confidence: 1, externalActive: false, midiConnected: false, error: null },
      // Rewind flag: only meaningful if currently playing (stopScheduler then
      // discards held instead of capturing it). When stopped, we simply zero.
      rewind: s.transport.playing,
    },
  })),
  setPlayhead: (step, sceneIdx, sceneLoop, songTicks = 0) => set({ playheads: { step, sceneIdx, sceneLoop, songTicks } }),

  // ── VibeCore Sync — quantise / seek / external sync (Band 4 §6.1) ────────
  seekTo: (sceneIdx, step) => set((s) => ({
    transport: {
      ...s.transport,
      pendingSeek: { sceneIdx: Math.max(0, Math.floor(sceneIdx)), step: Math.max(0, Math.floor(step)) },
    },
  })),
  setQuantizeGrid: (g) => set((s) => ({ transport: { ...s.transport, quantizeGrid: g } })),
  setSyncStatus: (patch) => set((s) => ({
    transport: {
      ...s.transport,
      syncStatus: {
        source: "internal", confidence: 1, externalActive: false, midiConnected: false, error: null,
        ...(s.transport.syncStatus ?? {}),
        ...patch,
      },
    },
  })),

  // ── Audio ────────────────────────────────────────────────────────────────
  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(100, v)) }),
  setAudioReady: (b) => set({ audioReady: b }),
  setQualityProfile: (q) => set({ qualityProfile: q }),
  setPsychoPreset: (p) => {
    set({ psychoPreset: p });
    import("@/lib/audio/psychoPresets").then((m) => m.setPsychoPreset(p));
  },

  // ── Pattern Parts / Scenes ──────────────────────────────────────────────
  addPatternPart: () => {
    let assigned: number | null = null;
    set((s) => {
      if (s.patterns.length >= MAX_PATTERN_PARTS) return {};
      const id = s.patterns.length;
      assigned = id;
      const next = [...s.patterns, buildDefaultPattern(id, s.parts)];
      return { patterns: next };
    });
    return assigned;
  },
  removePatternPart: (id) => set((s) => {
    if (s.patterns.length <= 1) return {};
    // B-3 fix: removing a pattern re-indexes all pattern IDs (id: i).
    // chainSteps[] and chain[] contain patternId references that become stale
    // after re-indexing — a step referencing patternId 5 would now point to
    // a different pattern (or an out-of-bounds index). Build an ID map and
    // remap all chain references. Steps referencing the deleted pattern are
    // removed entirely to prevent orphan chain entries.
    const idMap = new Map<number, number>();
    s.patterns.forEach((p, i) => {
      if (i !== id) idMap.set(i, i < id ? i : i - 1);
    });
    const chainSteps = s.transport.chainSteps
      .filter((st) => st.patternId !== id)
      .map((st) => ({ ...st, patternId: idMap.get(st.patternId) ?? st.patternId }));
    const chain = s.transport.chain
      .filter((pid) => pid !== id)
      .map((pid) => idMap.get(pid) ?? pid);
    const patterns = s.patterns.filter((_, i) => i !== id).map((p, i) => ({ ...p, id: i }));
    const selectedPattern = Math.min(s.selectedPattern, patterns.length - 1);
    const currentPattern = s.transport.currentPattern >= patterns.length
      ? patterns.length - 1
      : idMap.get(s.transport.currentPattern) ?? s.transport.currentPattern;
    return {
      patterns,
      selectedPattern,
      selectedSceneIdx: 0,
      transport: { ...s.transport, chainSteps, chain, currentPattern },
    };
  }),
  addScene: (patternId, length) => {
    let assignedIdx: number | null = null;
    set((s) => {
      const pat = s.patterns[patternId];
      if (!pat || pat.scenes.length >= MAX_SCENES_PER_PATTERN) return {};
      const len = snapSceneLength(length ?? 16);
      const nextScene = buildScene(len, s.parts);
      const scenes = [...pat.scenes, nextScene];
      assignedIdx = scenes.length - 1;
      const patterns = s.patterns.slice();
      patterns[patternId] = { ...pat, scenes };
      return { patterns };
    });
    return assignedIdx;
  },
  removeScene: (patternId, sceneIdx) => set((s) => {
    const pat = s.patterns[patternId];
    if (!pat || pat.scenes.length <= 1) return {};
    const scenes = pat.scenes.filter((_, i) => i !== sceneIdx);
    const patterns = s.patterns.slice();
    patterns[patternId] = { ...pat, scenes };
    const selectedSceneIdx = s.selectedPattern === patternId
      ? Math.min(s.selectedSceneIdx, scenes.length - 1)
      : s.selectedSceneIdx;
    return { patterns, selectedSceneIdx };
  }),
  setSceneLength: (patternId, sceneIdx, len) => set((s) => {
    const pat = s.patterns[patternId];
    if (!pat) return {};
    const sc = pat.scenes[sceneIdx];
    if (!sc) return {};
    const safe = snapSceneLength(len);
    if (sc.length === safe) return {};
    const scenes = pat.scenes.slice();
    scenes[sceneIdx] = resizeScene(sc, safe);
    const patterns = s.patterns.slice();
    patterns[patternId] = { ...pat, scenes };
    return { patterns };
  }),

  // ── Scene management (copy / paste / duplicate / move) ────────────────────
  copyScene: (patternId, sceneIdx) => set((s) => {
    const sc = s.patterns[patternId]?.scenes[sceneIdx];
    if (sc) _sceneClipboard = JSON.parse(JSON.stringify(sc)) as Scene;
    return {};
  }),
  pasteScene: (patternId, afterIdx) => set((s) => {
    if (!_sceneClipboard) return {};
    const pat = s.patterns[patternId];
    if (!pat || pat.scenes.length >= MAX_SCENES_PER_PATTERN) return {};
    const clone: Scene = { ...JSON.parse(JSON.stringify(_sceneClipboard)), id: nextSceneId() };
    const scenes = pat.scenes.slice();
    scenes.splice(afterIdx + 1, 0, clone);
    const patterns = s.patterns.slice();
    patterns[patternId] = { ...pat, scenes };
    return { patterns };
  }),
  duplicateScene: (patternId, sceneIdx) => set((s) => {
    const pat = s.patterns[patternId];
    if (!pat || pat.scenes.length >= MAX_SCENES_PER_PATTERN) return {};
    const sc = pat.scenes[sceneIdx];
    if (!sc) return {};
    const clone: Scene = { ...JSON.parse(JSON.stringify(sc)), id: nextSceneId() };
    const scenes = pat.scenes.slice();
    scenes.splice(sceneIdx + 1, 0, clone);
    const patterns = s.patterns.slice();
    patterns[patternId] = { ...pat, scenes };
    return { patterns };
  }),
  moveScene: (patternId, fromIdx, toIdx) => set((s) => {
    const pat = s.patterns[patternId];
    if (!pat) return {};
    const scenes = pat.scenes.slice();
    if (fromIdx < 0 || fromIdx >= scenes.length || toIdx < 0 || toIdx >= scenes.length) return {};
    const [moved] = scenes.splice(fromIdx, 1);
    scenes.splice(toIdx, 0, moved);
    const patterns = s.patterns.slice();
    patterns[patternId] = { ...pat, scenes };
    return { patterns };
  }),

  // ── Pattern clipboard (cross-pattern copy / paste) ────────────────────────
  copyPatternToClipboard: (id) => set((s) => {
    const pat = s.patterns[id];
    if (pat) _patternClipboard = JSON.parse(JSON.stringify(pat)) as Pattern;
    return {};
  }),
  pastePatternFromClipboard: () => {
    if (!_patternClipboard) return null;
    let newId: number | null = null;
    set((s) => {
      if (s.patterns.length >= MAX_PATTERN_PARTS) return {};
      newId = s.patterns.length;
      const src = _patternClipboard!;
      const clone: Pattern = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        name: `${src.name} PASTE`,
        seed: (src.seed ^ 47806) >>> 0,
        scenes: src.scenes.map((sc) => ({ ...JSON.parse(JSON.stringify(sc)), id: nextSceneId() })),
      };
      return { patterns: [...s.patterns, clone], selectedPattern: newId };
    });
    return newId;
  },

  // ── Sequencer ────────────────────────────────────────────────────────────
  toggleStep: (partId, idx) => set((s) => withCurrentScene(s, (sc) => {
    const arr = sc.partSteps[partId];
    if (!arr || idx < 0 || idx >= arr.length) return sc;
    const next = arr.slice();
    next[idx] = { ...next[idx], on: !next[idx].on };
    return { ...sc, partSteps: { ...sc.partSteps, [partId]: next } };
  })),

  updateStep: (partId, idx, patch) => set((s) => withCurrentScene(s, (sc) => {
    const arr = sc.partSteps[partId];
    if (!arr || idx < 0 || idx >= arr.length) return sc;
    const next = arr.slice();
    next[idx] = { ...next[idx], ...patch };
    return { ...sc, partSteps: { ...sc.partSteps, [partId]: next } };
  })),

  setPatternSteps: (partId, steps) => set((s) => withCurrentScene(s, (sc) => {
    const target = steps.slice(0, sc.length);
    while (target.length < sc.length) target.push(emptyStep());
    return { ...sc, partSteps: { ...sc.partSteps, [partId]: target } };
  })),

  setSwing: (n) => set((s) => {
    const patterns = s.patterns.slice();
    const pat = patterns[s.selectedPattern];
    if (!pat) return {};
    patterns[s.selectedPattern] = { ...pat, swing: n };
    return { patterns };
  }),

  setPatternSeed: (seed) => set((s) => {
    const patterns = s.patterns.slice();
    const pat = patterns[s.selectedPattern];
    if (!pat) return {};
    patterns[s.selectedPattern] = { ...pat, seed: seed >>> 0 };
    return { patterns };
  }),

  // ── Mix ───────────────────────────────────────────────────────────────────
  setPartVolume: (id, v) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, volume: v } : p) })),
  setPartPan: (id, v) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, pan: v } : p) })),
  setPartPitch: (id, v) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, pitch: Math.max(-24, Math.min(24, v)) } : p) })),
  setPartSampleName: (id, name) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, sampleName: name } : p) })),
  toggleMute: (id) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, mute: !p.mute } : p) })),
  toggleSolo: (id) => set((s) => ({ parts: s.parts.map((p) => p.id === id ? { ...p, solo: !p.solo } : p) })),

  setSend: (partId, fxIdx, v) => set((s) => ({
    parts: s.parts.map((p) => {
      if (p.id !== partId) return p;
      const sends = p.sends.slice();
      sends[fxIdx] = v;
      return { ...p, sends };
    }),
  })),

  setFxRouting: (r) => set({ fxRouting: r }),
  setFxMix: (slot, v) => set((s) => ({ fx: s.fx.map((f, i) => i === slot ? { ...f, mix: Math.max(0, Math.min(100, v)) } : f) })),
  setFxBoost: (slot, v) => set((s) => ({ fx: s.fx.map((f, i) => i === slot ? { ...f, boost: Math.max(0, Math.min(100, v)) } : f) })),
  toggleFxBypass: (slot) => set((s) => ({ fx: s.fx.map((f, i) => i === slot ? { ...f, bypass: !f.bypass } : f) })),
  toggleFxSharedFloor: () => set((s) => ({ fxSharedFloor: !s.fxSharedFloor })),
  setPartBusAssignment: (partId, busIdx) => set((s) => ({
    parts: s.parts.map((p) => p.id === partId ? { ...p, busTarget: busIdx } : p),
    partBusAssignments: { ...s.partBusAssignments, [partId]: busIdx },
  })),
  setBusLevelAction: (busIdx, volume, mute) => set((s) => {
    if (busIdx < 0 || busIdx >= s.busLevels.length) return {};
    const next = s.busLevels.slice();
    next[busIdx] = { volume: Math.max(0, Math.min(100, volume)), mute };
    return { busLevels: next };
  }),
  toggleBusMute: (busIdx) => set((s) => {
    if (busIdx < 0 || busIdx >= s.busLevels.length) return {};
    const next = s.busLevels.slice();
    next[busIdx] = { ...next[busIdx], mute: !next[busIdx].mute };
    return { busLevels: next };
  }),
  setFxType: (slot, t) => set((s) => ({ fx: s.fx.map((f, i) => i === slot ? { ...f, type: t, params: defaultFxParams(t) } : f) })),
  setFxParam: (slot, key, v) => set((s) => ({
    fx: s.fx.map((f, i) => i === slot ? { ...f, params: { ...f.params, [key]: v } } : f),
  })),

  setChannel: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, channel: { ...p.channel, ...patch } } : p),
  })),
  setMaster: (patch) => set((s) => ({ master: { ...s.master, ...patch } })),

  setPartSource: (id, src) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, source: src } : p),
  })),
  setWaveEdit: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, wave: clampWavePatch({ ...p.wave, ...patch }) } : p),
  })),
  setPartSlices: (id, slices) => set((s) => ({
    parts: s.parts.map((p) => p.id === id
      ? { ...p, wave: { ...p.wave, sliceData: slices.map((sl) => ({ ...sl })), slices: slices.length } }
      : p),
  })),
  setSynthEngine: (id, engine) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, synth: defaultSynth(engine) } : p),
  })),
  setSynthParam: (id, key, v) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, synth: { ...p.synth, [key]: v } } : p),
  })),
  setSynth3D: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => p.id === id
      ? { ...p, synth3d: { ...(p.synth3d ?? _defaultSynth3D()), ...patch } }
      : p),
  })),
  setBass3D: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => p.id === id
      ? { ...p, bass3d: { ...(p.bass3d ?? _defaultBass3D()), ...patch } }
      : p),
  })),
  setHybridParam: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => p.id === id ? { ...p, hybrid: { ...p.hybrid, ...patch } } : p),
  })),

  addNote: (partId, n) => {
    const id = nextId("n");
    set((s) => withCurrentScene(s, (sc) => {
      const list = (sc.partNotes[partId] ?? []).slice();
      list.push({ ...n, id });
      return { ...sc, partNotes: { ...sc.partNotes, [partId]: list } };
    }));
    return id;
  },
  updateNote: (partId, id, patch) => set((s) => withCurrentScene(s, (sc) => {
    const list = (sc.partNotes[partId] ?? []).map((n: Note) => (n.id === id ? { ...n, ...patch } : n));
    return { ...sc, partNotes: { ...sc.partNotes, [partId]: list } };
  })),
  removeNote: (partId, id) => set((s) => withCurrentScene(s, (sc) => {
    const list = (sc.partNotes[partId] ?? []).filter((n: Note) => n.id !== id);
    return { ...sc, partNotes: { ...sc.partNotes, [partId]: list } };
  })),
  setNotes: (partId, notes) => set((s) => withCurrentScene(s, (sc) => {
    const list: Note[] = notes.map((n) => ({ ...n, id: nextId("n") }));
    return { ...sc, partNotes: { ...sc.partNotes, [partId]: list } };
  })),
  replaceNotes: (partId, notes) => set((s) => withCurrentScene(s, (sc) => ({
    ...sc,
    partNotes: { ...sc.partNotes, [partId]: notes.map((n: Note) => ({ ...n })) },
  }))),
  quantizeNotes: (partId, grid = 1) => set((s) => withCurrentScene(s, (sc) => {
    const g = grid > 0 ? grid : 1;
    const list = (sc.partNotes[partId] ?? []).map((n: Note) => {
      // absolute position in steps including micro offset (micro = ±50 % of one step)
      const pos = n.step + (n.micro ?? 0) / 100;
      const snapped = Math.round(pos / g) * g;
      const step = Math.max(0, Math.floor(snapped + 1e-6));
      const micro = Math.max(-50, Math.min(50, Math.round((snapped - step) * 100)));
      // snap length to grid as well, but never below the grid value itself
      const lenSnapped = Math.max(g, Math.round(n.length / g) * g);
      return { ...n, step, micro, length: lenSnapped };
    });
    return { ...sc, partNotes: { ...sc.partNotes, [partId]: list } };
  })),

  addModRoute: (r) => {
    const id = nextId("m");
    const source = r?.source ?? "LFO 1";
    const cc = r?.cc === undefined ? 0 : Math.max(0, Math.min(127, Math.round(r.cc)));
    const route: ModRoute = {
      id,
      source,
      destParam: r?.destParam ?? "Filter Cutoff",
      partId: r?.partId ?? 0,
      amount: r?.amount ?? 50,
      curve: r?.curve ?? "lin",
      enabled: r?.enabled ?? true,
      ...(source === "MIDI CC" ? { cc } : {}),
    };
    set((s) => ({ mod: [...s.mod, route], selectedMod: id }));
    return id;
  },
  updateModRoute: (id, patch) => set((s) => ({
    mod: s.mod.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      if (next.cc !== undefined) next.cc = Math.max(0, Math.min(127, Math.round(next.cc)));
      return next;
    }),
  })),
  removeModRoute: (id) => set((s) => ({
    mod: s.mod.filter((r) => r.id !== id),
    selectedMod: s.selectedMod === id ? null : s.selectedMod,
  })),
  toggleModRoute: (id) => set((s) => ({
    mod: s.mod.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
  })),
  selectMod: (id) => set({ selectedMod: id }),

  setChainStepTransition: (idx, t) => set((s) => {
    const arr = [...(s.transport.chainStepTransitions ?? [])];
    arr[idx] = t;
    return { transport: { ...s.transport, chainStepTransitions: arr } };
  }),

  // ── ArpEngine ───────────────────────────────────────────────────────────
  setArp: (patch) => set((s) => ({ arp: { ...s.arp, ...patch } })),
  toggleArpStep: (idx) => set((s) => {
    const i = Math.max(0, Math.min(15, Math.floor(idx)));
    const gateSteps = s.arp.gateSteps.slice();
    gateSteps[i] = !gateSteps[i];
    return { arp: { ...s.arp, gateSteps } };
  }),

  // ── AI activity log ──────────────────────────────────────────────────────
  addAiHistoryEntry: (entry) => set((s) => ({
    aiHistory: [
      { ...entry, id: nextId("ai"), timestamp: Date.now() },
      ...s.aiHistory,
    ].slice(0, 10),
  })),
  clearAiHistory: () => set({ aiHistory: [] }),
  setAiStyle: (aiStyle) => set({ aiStyle }),
}), {
  name: "vibecore-liv3-project",
  // v12 — Pattern-Domain migration: PatternPart → Scenes[1..8], step counts
  // shared per scene (SceneLength ∈ {4,8,16}). Pre-v12 schemas are discarded.
  version: 12,
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({
    bpm: s.bpm,
    masterVolume: s.masterVolume,
    master: s.master,
    parts: s.parts,
    patterns: s.patterns,
    fx: s.fx,
    fxRouting: s.fxRouting,
    fxSharedFloor: s.fxSharedFloor,
    partBusAssignments: s.partBusAssignments,
    busLevels: s.busLevels,
    mod: s.mod,
    arp: s.arp,
    selectedPattern: s.selectedPattern,
    selectedSceneIdx: s.selectedSceneIdx,
    qualityProfile: s.qualityProfile,
    psychoPreset: s.psychoPreset,
    aiStyle: s.aiStyle,
    transport: {
      chain: s.transport.chain,
      chainSteps: s.transport.chainSteps,
      chainStepTransitions: s.transport.chainStepTransitions ?? [],
      chainMode: s.transport.chainMode,
      currentPattern: s.transport.currentPattern,
      playing: false,
      queuedPattern: null,
      currentStep: 0,
      currentSceneIdx: 0,
      sceneLoopCount: 0,
      quantizeGrid: s.transport.quantizeGrid ?? "off",
    },
  }),
  migrate: (persisted: unknown, fromVersion: number) => {
    // The v11→v12 break replaces `partScenes` with `scenes[]`. We discard
    // old state to keep the codebase simple — users get a fresh default project.
    if (fromVersion < 12) return undefined as unknown;
    return persisted;
  },
}));

function clampWavePatch(w: WaveEdit): WaveEdit {
  return {
    ...w,
    grainSize: Math.max(0, Math.min(100, w.grainSize)),
    grainDensity: Math.max(0, Math.min(100, w.grainDensity)),
    grainSpray: Math.max(0, Math.min(50, w.grainSpray)),
    granRandPitch: Math.max(0, Math.min(25, w.granRandPitch)),
    granRandPan: Math.max(0, Math.min(25, w.granRandPan)),
  };
}

export { patternTotalSteps as patternLength };

// ── Transient-state throttle ────────────────────────────────────────────────
const TRANSIENT_THROTTLE_MS = 50;
let _lastTransientSet = 0;
export function setTransientState(patch: Partial<State>): void {
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (now - _lastTransientSet < TRANSIENT_THROTTLE_MS) return;
  _lastTransientSet = now;
  useGroove.setState(patch as Parameters<typeof useGroove.setState>[0]);
}

// ── Convenience selectors ───────────────────────────────────────────────────
export function rngForPattern(p: Pattern) { return mulberry32(p.seed); }

/** Resolve the currently-selected Scene for the editor. May be undefined. */
export function getEditingScene(): Scene | undefined {
  const s = useGroove.getState();
  return s.patterns[s.selectedPattern]?.scenes[s.selectedSceneIdx];
}

// Silence unused-import warning under strict mode (re-exported for tests).
void nextSceneId;