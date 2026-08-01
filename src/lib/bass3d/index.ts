// VibeCore 3D Bass — Public API.
//
// Single import point for the 3D Bass module. All sound modules and the
// UI import from here — never from individual sub-modules.
//
// Architecture: the 3D Bass is a specialized bass voice engine that sits on
// top of the Audio Engine and DSP Core. It creates no new DSP — all signal
// processing comes from DSP Core primitives. The Audio Engine's channel
// strip, FX buses, and master bus are unchanged. The spatial chain is
// reused from the 3D Synth's spatial engine (shared per-part).

// ── Parameters & types ───────────────────────────────────────────────────────
export {
  type Bass3DParams, type BassDriveParams, type BassDriveType,
  type BassDynamicsParams, type BassSpatialParams,
  type ModDestBass, type ModRouteBass,
  defaultBass3D,
} from "./params";

// ── Voice engine ─────────────────────────────────────────────────────────────
export { triggerNote3DBass, killAllNotes3DBass, clearAll3DBass } from "./voiceEngine";

// ── Engine integration ───────────────────────────────────────────────────────
export { trigger3DBass } from "./trigger";

// ── Self-tests ───────────────────────────────────────────────────────────────
export { runBass3DTests } from "./bass3dSelfTest";