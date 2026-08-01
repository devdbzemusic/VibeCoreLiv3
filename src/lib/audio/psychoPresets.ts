// Psychoacoustic presets — tunable curves for granular grain-length shaping,
// velocity-timbre coupling, and freeze coherence.
//
// Consumed by granular.ts. UI selection lives in the store as `psychoPreset`
// (see lib/store.ts). Per-sample-rate calibration is applied on top of the
// chosen preset by `calibrateForSampleRate(sr)`.

export type PsychoPresetName = "NEUTRAL" | "WARM" | "CRUNCH" | "HI_DEF";

export interface PsychoPreset {
  name: PsychoPresetName;
  /** Multipliers applied per perceived-frequency band (Fletcher-Munson / Bark). */
  bandScale: {
    sub: number;      // <20 Hz   — body-only, longer grains OK
    low: number;      // 20..200
    mid: number;      // 200..2000 (speech / melody)
    presence: number; // 2k..4k    (ear-sensitive)
    air: number;      // 4k..8k
    top: number;      // >8k
  };
  /** Velocity → grain-length factor. shapedSize *= 1 + (0.5 - vel01) * velLenCoupling. */
  velLenCoupling: number;
  /** Velocity → post-gain lift. gain *= 1 + (vel01 - 0.5) * velGainCoupling. */
  velGainCoupling: number;
  /** Freeze coherence: srCoherence = (48000 / sr) ^ srCoherenceExp. */
  srCoherenceExp: number;
  /** Extra hard floor on grain size in ms (Android-safe minimum override). */
  minGrainMs: number;
}

const PRESETS: Record<PsychoPresetName, PsychoPreset> = {
  // Flat reference — closest to the pre-preset behaviour.
  NEUTRAL: {
    name: "NEUTRAL",
    bandScale: { sub: 1.6, low: 1.15, mid: 1.0, presence: 0.75, air: 0.85, top: 0.9 },
    velLenCoupling: 0.5,
    velGainCoupling: 0.3,
    srCoherenceExp: 0.25,
    minGrainMs: 40,
  },
  // Smooth / analog — longer grains, gentle harmonics, low fatigue.
  WARM: {
    name: "WARM",
    bandScale: { sub: 1.8, low: 1.35, mid: 1.15, presence: 0.95, air: 1.0, top: 1.05 },
    velLenCoupling: 0.35,
    velGainCoupling: 0.2,
    srCoherenceExp: 0.35,
    minGrainMs: 50,
  },
  // Aggressive / textured — short grains, hard velocity response, percussive.
  CRUNCH: {
    name: "CRUNCH",
    bandScale: { sub: 1.2, low: 0.95, mid: 0.85, presence: 0.6, air: 0.7, top: 0.75 },
    velLenCoupling: 0.7,
    velGainCoupling: 0.45,
    srCoherenceExp: 0.18,
    minGrainMs: 32,
  },
  // Maximum detail / transient definition — tight grains across the spectrum.
  HI_DEF: {
    name: "HI_DEF",
    bandScale: { sub: 1.4, low: 1.05, mid: 0.9, presence: 0.65, air: 0.75, top: 0.8 },
    velLenCoupling: 0.55,
    velGainCoupling: 0.35,
    srCoherenceExp: 0.22,
    minGrainMs: 36,
  },
};

let active: PsychoPreset = PRESETS.NEUTRAL;
let srCalibration = 1; // multiplicative scaler applied on top of preset

export function listPsychoPresets(): PsychoPresetName[] {
  return Object.keys(PRESETS) as PsychoPresetName[];
}

export function getPsychoPreset(): PsychoPreset { return active; }

export function setPsychoPreset(name: PsychoPresetName) {
  active = PRESETS[name] ?? PRESETS.NEUTRAL;
}

/** Quick calibration per sample rate.
 *  48 kHz → 1.0 (neutral). Lower SR widens grains slightly to keep critical-
 *  band integrity; higher SR tightens them for transient sharpness. */
export function calibrateForSampleRate(sr: number) {
  const ratio = 48000 / Math.max(8000, sr);
  // Bound to ±15% so calibration never overwhelms the preset.
  srCalibration = Math.max(0.85, Math.min(1.15, Math.pow(ratio, 0.3)));
}

export function getSrCalibration(): number { return srCalibration; }

/** Returned multiplier for a perceived fundamental frequency. */
export function psychoacousticGrainScale(perceivedHz: number): number {
  const b = active.bandScale;
  const f = Math.max(1, perceivedHz);
  let m: number;
  if (f < 20)        m = b.sub;
  else if (f < 200)  m = b.low;
  else if (f < 2000) m = b.mid;
  else if (f < 4000) m = b.presence;
  else if (f < 8000) m = b.air;
  else               m = b.top;
  return Math.max(0.5, Math.min(2.0, m * srCalibration));
}
