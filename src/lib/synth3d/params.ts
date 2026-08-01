// VibeCore 3D Synth — Parameter Types & Defaults.
//
// All parameter types for the 3D Synth voice engine. These types are the
// contract between the UI, the store, the voice engine, and the DSP Core.
//
// The 3D Synth uses exclusively DSP Core primitives for all DSP. No new DSP
// is defined here — only parameter shapes that configure DSP Core factories.
//
// Realtime-safe: pure type definitions, no runtime logic.

// ── Oscillator ───────────────────────────────────────────────────────────────
export type OscType3D = "sine" | "saw" | "square" | "triangle" | "noise" | "wavetable";

export interface OscParams3D {
  type: OscType3D;
  octave: number;       // -3..3
  semitone: number;     // -12..12
  fine: number;         // -50..50 cents
  level: number;        // 0..1
  pan: number;           // -1..1
  phase: number;         // 0..1 (initial phase offset)
  wavetable: number[];   // harmonic amplitudes (0..1 per partial)
  enabled: boolean;
}

// ── Filter ───────────────────────────────────────────────────────────────────
export type FilterType3D = "lp" | "hp" | "bp" | "notch" | "comb" | "morph";

export interface FilterParams3D {
  type: FilterType3D;
  freq: number;          // 20..20000 Hz
  q: number;              // 0.1..20
  gain: number;           // dB (for shelving/morph)
  enabled: boolean;
}

// ── Envelope ─────────────────────────────────────────────────────────────────
export type EnvType3D = "adsr" | "ahdsr" | "multistage";

export interface EnvParams3D {
  type: EnvType3D;
  attack: number;         // 0..10 sec
  hold: number;           // 0..5 sec (AHDSR)
  decay: number;          // 0..10 sec
  sustain: number;        // 0..1
  release: number;        // 0..10 sec
  peak: number;            // 0..1 (peak level before decay)
}

// ── LFO ──────────────────────────────────────────────────────────────────────
export type LFOWaveform3D = "sine" | "triangle" | "saw" | "square" | "samplehold";
export type LFOSyncDiv3D = "off" | "1/16" | "1/8" | "1/4" | "1/2" | "1" | "2";

export interface LFOParams3D {
  waveform: LFOWaveform3D;
  rate: number;            // 0.01..20 Hz (free-run)
  depth: number;            // 0..1
  syncDiv: LFOSyncDiv3D;   // BPM sync division
  phase: number;            // 0..1
  enabled: boolean;
}

// ── Modulation Matrix ─────────────────────────────────────────────────────────
export type ModSource3D =
  | "LFO1" | "LFO2" | "LFO3" | "LFO4"
  | "ENV1" | "ENV2" | "ENV3"
  | "Velocity" | "Aftertouch" | "Keytrack"
  | "CC1" | "CC2" | "CC3" | "CC4"
  | "Macro1" | "Macro2" | "Macro3" | "Macro4"
  | "Macro5" | "Macro6" | "Macro7" | "Macro8"
  | "Random" | "StepMod";

export type ModDest3D =
  | "osc1Pitch" | "osc2Pitch" | "subPitch"
  | "osc1Level" | "osc2Level" | "subLevel" | "noiseLevel"
  | "filter1Freq" | "filter1Q" | "filter2Freq" | "filter2Q"
  | "ampGain" | "pan" | "width" | "azimuth" | "elevation" | "distance"
  | "lfo1Rate" | "lfo2Rate" | "lfo3Rate" | "lfo4Rate";

export interface ModRoute3D {
  source: ModSource3D;
  dest: ModDest3D;
  amount: number;  // -1..1
}

// ── Spatial ──────────────────────────────────────────────────────────────────
export type SpatialMode3D = "stereo" | "ms" | "binaural" | "3d";

export interface SpatialParams3D {
  mode: SpatialMode3D;
  width: number;      // 0..2
  azimuth: number;    // -90..90 deg
  elevation: number;  // -45..45 deg
  distance: number;    // 0..1
  rotation: number;     // auto-rotation rate (Hz, 0 = off)
  enabled: boolean;
}

// ── Unison ───────────────────────────────────────────────────────────────────
export interface UnisonParams3D {
  count: number;        // 1..7
  detune: number;       // 0..100 cents
  spread: number;        // 0..1 stereo spread
  phaseRandom: boolean;
  drift: number;         // 0..1 (drift rate in Hz)
  enabled: boolean;
}

// ── Performance ───────────────────────────────────────────────────────────────
export type VoiceMode3D = "mono" | "poly" | "legato";
export type GlideMode3D = "off" | "auto" | "always";

export interface PerformanceParams3D {
  mode: VoiceMode3D;
  glideMode: GlideMode3D;
  glideTime: number;   // 0..2 sec
  polyphony: number;    // 1..32
}

// ── Macro ───────────────────────────────────────────────────────────────────
export interface MacroState3D {
  value: number;       // 0..1
  cc: number | null;   // MIDI CC number (null = unassigned)
}

// ── Snapshot ─────────────────────────────────────────────────────────────────
export interface Synth3DSnapshot {
  name: string;
  params: Synth3DParams;
  macros: MacroState3D[];
}

// ── Full 3D Synth Parameters ──────────────────────────────────────────────────
export interface Synth3DParams {
  osc1: OscParams3D;
  osc2: OscParams3D;
  sub: OscParams3D;
  noise: { level: number; type: "white" | "pink" | "brown" };
  filter1: FilterParams3D;
  filter2: FilterParams3D;
  filterRouting: "serial" | "parallel";
  filterEnvAmount: number;  // -1..1
  ampEnv: EnvParams3D;
  filterEnv: EnvParams3D;
  modEnv: EnvParams3D;
  lfos: LFOParams3D[];       // 4 LFOs
  modRoutes: ModRoute3D[];
  spatial: SpatialParams3D;
  unison: UnisonParams3D;
  performance: PerformanceParams3D;
  macros: MacroState3D[];     // 8 macros
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultOsc(type: OscType3D = "saw"): OscParams3D {
  return {
    type, octave: 0, semitone: 0, fine: 0,
    level: 0.8, pan: 0, phase: 0,
    wavetable: [1, 0.5, 0.33, 0.25, 0.2], enabled: true,
  };
}

export function defaultFilter(type: FilterType3D = "lp"): FilterParams3D {
  return { type, freq: 2000, q: 1, gain: 0, enabled: true };
}

export function defaultEnv(type: EnvType3D = "adsr"): EnvParams3D {
  return {
    type, attack: 0.01, hold: 0, decay: 0.3,
    sustain: 0.7, release: 0.3, peak: 1,
  };
}

export function defaultLFO(): LFOParams3D {
  return {
    waveform: "sine", rate: 0.5, depth: 0.5,
    syncDiv: "off", phase: 0, enabled: false,
  };
}

export function defaultMacro(): MacroState3D {
  return { value: 0.5, cc: null };
}

export function defaultUnison(): UnisonParams3D {
  return { count: 3, detune: 15, spread: 0.5, phaseRandom: true, drift: 0.1, enabled: true };
}

export function defaultSpatial(): SpatialParams3D {
  return {
    mode: "stereo", width: 1, azimuth: 0, elevation: 0,
    distance: 0.3, rotation: 0, enabled: true,
  };
}

export function defaultPerformance(): PerformanceParams3D {
  return { mode: "poly", glideMode: "off", glideTime: 0.1, polyphony: 16 };
}

/** Default 3D Synth parameters — a Techno/Dark Ambient oriented starting patch:
 *  2 sawtooth oscillators + sub sine, lowpass filter, 3-voice unison,
 *  stereo spatial, polyphonic. */
export function defaultSynth3D(): Synth3DParams {
  return {
    osc1: defaultOsc("saw"),
    osc2: { ...defaultOsc("saw"), enabled: false },
    sub: { ...defaultOsc("sine"), octave: -1, level: 0.5 },
    noise: { level: 0, type: "white" },
    filter1: defaultFilter("lp"),
    filter2: { ...defaultFilter("hp"), freq: 200, enabled: false },
    filterRouting: "serial",
    filterEnvAmount: 0.5,
    ampEnv: defaultEnv("adsr"),
    filterEnv: { ...defaultEnv("adsr"), decay: 0.5, sustain: 0.3 },
    modEnv: { ...defaultEnv("adsr"), decay: 0.2, sustain: 0.5 },
    lfos: [defaultLFO(), defaultLFO(), defaultLFO(), defaultLFO()],
    modRoutes: [],
    spatial: defaultSpatial(),
    unison: defaultUnison(),
    performance: defaultPerformance(),
    macros: Array.from({ length: 8 }, defaultMacro),
  };
}