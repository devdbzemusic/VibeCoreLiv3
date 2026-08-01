// VibeCore 3D Bass — Parameter Types & Defaults.
//
// Bass-specific parameter types for the 3D Bass voice engine. Reuses the
// 3D Synth's type vocabulary (OscParams3D, FilterParams3D, EnvParams3D,
// LFOParams3D, ModSource3D, SpatialParams3D, UnisonParams3D, PerformanceParams3D,
// MacroState3D) and adds bass-specific extensions:
//   • BassDriveParams — 6 drive types with bass-stability flag
//   • BassDynamicsParams — compressor + limiter + bass punch
//   • BassSpatialParams — extends spatial with mono-compat crossover
//   • ModDestBass — extends modulation destinations with bass targets
//
// No DSP is defined here — only parameter shapes that configure DSP Core
// factories. Realtime-safe: pure type definitions, no runtime logic.

import {
  defaultOsc, defaultFilter, defaultEnv,
  type OscParams3D, type FilterParams3D, type EnvParams3D,
  type LFOParams3D, type ModSource3D, type ModDest3D,
  type SpatialParams3D, type UnisonParams3D,
  type PerformanceParams3D, type MacroState3D,
} from "@/lib/synth3d";

// ── Bass Drive ──────────────────────────────────────────────────────────────────
export type BassDriveType = "saturation" | "tube" | "tape" | "softclip" | "foldback" | "drive";

export interface BassDriveParams {
  type: BassDriveType;
  amount: number;        // 0..1+
  preGain: number;       // dB (drives the shaper harder)
  postGain: number;      // dB (compensates output level)
  /** When true, a HP filter before the drive protects the sub from intermodulation. */
  bassStable: boolean;
  enabled: boolean;
}

// ── Bass Dynamics ───────────────────────────────────────────────────────────────
export interface BassDynamicsParams {
  compressor: {
    enabled: boolean;
    threshold: number;    // dB (-100..0)
    ratio: number;        // 1..20
    attack: number;       // sec
    release: number;      // sec
    makeup: number;       // dB
  };
  limiter: {
    enabled: boolean;
    threshold: number;    // dB
    release: number;       // sec
  };
  bassPunch: {
    enabled: boolean;
    amount: number;        // 0..1 (transient boost at note-on)
    attack: number;       // sec (time to peak boost)
    release: number;      // sec (decay back to unity)
  };
}

// ── Bass Spatial (mono-compat) ──────────────────────────────────────────────────
export interface BassSpatialParams extends SpatialParams3D {
  /** Crossover frequency (Hz) — sub below this is summed to mono. Default 120. */
  monoCrossover: number;
  /** When true, sub frequencies bypass spatial processing (mono-compatible). */
  monoEnabled: boolean;
}

// ── Bass Modulation Destinations ───────────────────────────────────────────────
export type ModDestBass =
  | ModDest3D
  | "driveAmount"      // drive pre-gain (modulates drive intensity)
  | "compThreshold"    // compressor threshold
  | "bassPunch"        // bass punch transient amount
  | "monoCrossover"   // mono-compat crossover frequency
  | "acidResonance";   // filter Q boost for acid sweeps

export interface ModRouteBass {
  source: ModSource3D;
  dest: ModDestBass;
  amount: number;  // -1..1
}

// ── Full Bass3D Parameters ─────────────────────────────────────────────────────
export interface Bass3DParams {
  // Oscillators
  osc1: OscParams3D;
  osc2: OscParams3D;
  sub: OscParams3D;
  noise: { level: number; type: "white" | "pink" | "brown" };

  // Filter (with acid / bass compensation)
  filter1: FilterParams3D;
  filter2: FilterParams3D;
  filterRouting: "serial" | "parallel";
  filterEnvAmount: number;    // -1..1
  acidResonance: number;       // 0..1 (adds Q for acid sweeps)
  bassCompensation: number;   // 0..1 (low-shelf boost to preserve sub under resonance)

  // Drive (bass-stable)
  drive: BassDriveParams;

  // Dynamics
  dynamics: BassDynamicsParams;

  // Envelopes
  ampEnv: EnvParams3D;
  filterEnv: EnvParams3D;
  modEnv: EnvParams3D;

  // LFOs + Mod Matrix
  lfos: LFOParams3D[];        // 4 LFOs
  modRoutes: ModRouteBass[];

  // Spatial (with mono-compat)
  spatial: BassSpatialParams;

  // Unison (bass-optimized: fewer copies, less detune)
  unison: UnisonParams3D;

  // Performance (default mono — bass is typically mono)
  performance: PerformanceParams3D;

  // Macros (8)
  macros: MacroState3D[];
}

// ── Defaults ────────────────────────────────────────────────────────────────────

/** Default 3D Bass parameters — a Techno/Hard Techno oriented starting patch:
 *  saw + sub sine, lowpass filter with mild acid resonance, saturation drive,
 *  compressor + limiter + punch, mono-compat spatial at 120 Hz, 3-voice unison
 *  with light detune, mono performance mode. */
export function defaultBass3D(): Bass3DParams {
  return {
    // Oscillators — saw primary + sub sine one octave down
    osc1: { ...defaultOsc("saw"), level: 0.7 },
    osc2: { ...defaultOsc("square"), enabled: false, level: 0.4 },
    sub: { type: "sine", octave: -1, semitone: 0, fine: 0, level: 0.65, pan: 0, phase: 0, wavetable: [1], enabled: true },
    noise: { level: 0, type: "white" },

    // Filter — LP at 800 Hz with acid resonance + bass compensation
    filter1: { type: "lp", freq: 800, q: 2, gain: 0, enabled: true },
    filter2: { type: "hp", freq: 30, q: 0.7, gain: 0, enabled: false },
    filterRouting: "serial",
    filterEnvAmount: 0.6,
    acidResonance: 0.3,
    bassCompensation: 0.5,

    // Drive — gentle saturation, bass-stable
    drive: { type: "saturation", amount: 0.3, preGain: 0, postGain: 0, bassStable: true, enabled: true },

    // Dynamics — compressor + limiter + punch for tight bass
    dynamics: {
      compressor: { enabled: true, threshold: -20, ratio: 3, attack: 0.005, release: 0.1, makeup: 2 },
      limiter: { enabled: true, threshold: -1, release: 0.05 },
      bassPunch: { enabled: true, amount: 0.4, attack: 0.001, release: 0.08 },
    },

    // Envelopes — tight amp, filter sweep
    ampEnv: { type: "adsr", attack: 0.005, hold: 0, decay: 0.2, sustain: 0.8, release: 0.15, peak: 1 },
    filterEnv: { type: "adsr", attack: 0.005, hold: 0, decay: 0.3, sustain: 0.3, release: 0.2, peak: 1 },
    modEnv: { type: "adsr", attack: 0.005, hold: 0, decay: 0.15, sustain: 0.5, release: 0.1, peak: 1 },

    // LFOs — 4, all disabled by default
    lfos: [
      { waveform: "sine", rate: 0.3, depth: 0.5, syncDiv: "1/16", phase: 0, enabled: false },
      { waveform: "sine", rate: 0.5, depth: 0.5, syncDiv: "off", phase: 0, enabled: false },
      { waveform: "sine", rate: 0.5, depth: 0.5, syncDiv: "off", phase: 0, enabled: false },
      { waveform: "sine", rate: 0.5, depth: 0.5, syncDiv: "off", phase: 0, enabled: false },
    ],
    modRoutes: [],

    // Spatial — stereo width 0.8, mono-compat at 120 Hz
    spatial: {
      mode: "stereo", width: 0.8, azimuth: 0, elevation: 0,
      distance: 0.3, rotation: 0, enabled: true,
      monoCrossover: 120, monoEnabled: true,
    },

    // Unison — 3 voices, light detune (bass doesn't need wide detuning)
    unison: { count: 3, detune: 12, spread: 0.3, phaseRandom: true, drift: 0.05, enabled: true },

    // Performance — mono by default, auto glide
    performance: { mode: "mono", glideMode: "auto", glideTime: 0.08, polyphony: 8 },

    // Macros — 8, centered
    macros: Array.from({ length: 8 }, () => ({ value: 0.5, cc: null as number | null })),
  };
}