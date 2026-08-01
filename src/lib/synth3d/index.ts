// VibeCore 3D Synth — Public API.
//
// Single import point for the 3D Synth module. All sound modules and the
// UI import from here — never from individual sub-modules.
//
// Architecture: the 3D Synth is a voice engine that sits on top of the
// Audio Engine and DSP Core. It creates no new DSP — all signal processing
// comes from DSP Core primitives. The Audio Engine's channel strip, FX
// buses, and master bus are unchanged.

// ── Parameters & types ────────────────────────────────────────────────────────
export {
  type Synth3DParams, type OscParams3D, type OscType3D,
  type FilterParams3D, type FilterType3D,
  type EnvParams3D, type EnvType3D,
  type LFOParams3D, type LFOWaveform3D, type LFOSyncDiv3D,
  type ModRoute3D, type ModSource3D, type ModDest3D,
  type SpatialParams3D, type SpatialMode3D,
  type UnisonParams3D,
  type PerformanceParams3D, type VoiceMode3D, type GlideMode3D,
  type MacroState3D, type Synth3DSnapshot,
  defaultSynth3D, defaultOsc, defaultFilter, defaultEnv, defaultLFO,
  defaultMacro, defaultUnison, defaultSpatial, defaultPerformance,
} from "./params";

// ── Macro controls ───────────────────────────────────────────────────────────
export { getMacros, resetMacros, MacroManager } from "./macros";

// ── Spatial engine ──────────────────────────────────────────────────────────
export {
  getSpatialChain, updateSpatialChain,
  clearSpatialChain, clearAllSpatialChains,
} from "./spatialEngine";

// ── Voice engine ─────────────────────────────────────────────────────────────
export { triggerNote3D, killAllNotes3D, clearAll3D } from "./voiceEngine";

// ── Engine integration ────────────────────────────────────────────────────────
export { trigger3DSynth } from "./trigger";

// ── Self-tests ──────────────────────────────────────────────────────────────
export { runSynth3DTests } from "./synth3dSelfTest";