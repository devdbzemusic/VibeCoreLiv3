// VibeCore FX Mix Lab — Public API.
//
// Single import point for all FX Mix Lab functionality. Sound modules,
// UI components, and the Groove scheduler import from here — never from
// individual sub-modules.
//
// FX Mix Lab extends — never replaces — the existing Audio Engine, DSP Core,
// Groove, and Sample Forge modules.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  InsertFxType, InsertSlot,
  MixerChannel, BusChannel, ReturnChannel,
  AutomationTarget, AutomationCurve, AutomationPoint, AutomationLane,
  AnalyzerSnapshot,
  MixPreset,
  MixSuggestion, MixAnalysis,
} from "./types";

// ── Insert Chains ─────────────────────────────────────────────────────────────
// buildInsert is an internal factory — only buildInsertChain is public API.
export {
  type InsertChainNode, type BuiltInsertChain,
  buildInsertChain,
} from "./insertChain";

// ── Routing ───────────────────────────────────────────────────────────────────
export {
  type RoutingEdge, type RoutingGraph,
  buildRoutingGraph, detectCycle, validateRouting, topologicalSort,
  wouldCreateCycle, partsForBus, busesToMaster, sendsForPart,
} from "./routing";

// ── Automation ────────────────────────────────────────────────────────────────
export {
  type AutomationBinding, type AutomationScheduler,
  sortLanePoints, interpolateValue, createAutomationScheduler,
  addPoint, removePoint, clearLane, ticksToAudioTime,
} from "./automation";

// ── Analyzer ──────────────────────────────────────────────────────────────────
export {
  computePeakRMS, linToDb,
  computeStereoBalance, computePhaseCorrelation,
  computeCrestFactor, computeHeadroom, detectClipping,
  downsampleSpectrum, buildSnapshot,
  getIntegratedLufs, getShortTermLufs, resetLufs, feedLufsIntegrated,
} from "./analyzer";

// ── AI Assistant ──────────────────────────────────────────────────────────────
export {
  suggestGainStaging, suggestEQ, suggestDynamics, suggestStereoBalance,
  suggestRouting, analyzeMix,
} from "./aiAssistant";

// ── Presets ───────────────────────────────────────────────────────────────────
export {
  defaultMixerChannel, defaultBus, defaultReturn,
  getPresetTemplates, buildPreset,
  type PresetTemplate,
} from "./presets";

// ── Self-Test ─────────────────────────────────────────────────────────────────
export { runFxMixLabTests } from "./selfTest";