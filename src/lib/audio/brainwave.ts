// Phase 6+7 — Brainwave + Solfeggio engine.
// Singleton audio chain that hangs off masterInput().
//
// Architecture:
//   ┌─ binauralL (sine) ─ pannerL(-1) ─┐
//   │                                  │── beatBus ─┐
//   └─ binauralR (sine) ─ pannerR(+1) ─┘            │
//                                                   ├── outGain ── master
//   carrier (sine) ─ amGain(iso) ─ stereoPan(LFO) ──┘
//
// Solfeggio bank: 9 parallel BiquadFilter (bandpass, Q tunable) tapping the
// carrier output, mixed back into outGain via solfGain. Acts as either a
// harmonic layer (mode="harmonic") or a resonance ringing (mode="filter").
//
// All parameter setters ramp via setTargetAtTime to stay click-free.

import { ensureAudio, masterInput } from "./engine";
import { masterClock } from "@/lib/clock/masterClock";
import { divisionHz } from "@/lib/clock/divisions";
import type { Division } from "@/lib/clock/types";

export type BrainwaveMode = "binaural" | "isochronic" | "phase";
export type SolfMode = "harmonic" | "filter" | "carrier" | "mod";
/** Phase 3 — Clock coupling mode for the Brainwave engine.
 *  FREE   : independent oscillator frequencies (legacy behaviour).
 *  SYNC   : beatHz / isoRateHz derived from MasterClock division.
 *  HYBRID : carrier+beat free, but a phase LFO follows the clock division. */
export type BrainwaveClockMode = "FREE" | "SYNC" | "HYBRID";

export const SOLFEGGIO_FREQS = [174, 285, 396, 417, 528, 639, 741, 852, 963] as const;

export interface BrainwavePreset {
  name: string;
  carrierHz: number;
  beatHz: number;
  mode: BrainwaveMode;
  isoRateHz: number;
}

export const BRAINWAVE_PRESETS: Record<string, BrainwavePreset> = {
  Delta:  { name: "Delta",  carrierHz: 100, beatHz: 2,  mode: "binaural",   isoRateHz: 2  },
  Theta:  { name: "Theta",  carrierHz: 150, beatHz: 6,  mode: "binaural",   isoRateHz: 6  },
  Alpha:  { name: "Alpha",  carrierHz: 220, beatHz: 10, mode: "binaural",   isoRateHz: 10 },
  Beta:   { name: "Beta",   carrierHz: 300, beatHz: 18, mode: "isochronic", isoRateHz: 18 },
  Gamma:  { name: "Gamma",  carrierHz: 440, beatHz: 40, mode: "isochronic", isoRateHz: 40 },
  Custom: { name: "Custom", carrierHz: 200, beatHz: 8,  mode: "binaural",   isoRateHz: 8  },
};

interface SolfNode {
  filter: BiquadFilterNode;
  gain: GainNode;
  on: boolean;
}

interface Engine {
  ctx: AudioContext;
  // Binaural path
  binauralL: OscillatorNode;
  binauralR: OscillatorNode;
  binauralGainL: GainNode;
  binauralGainR: GainNode;
  pannerL: StereoPannerNode;
  pannerR: StereoPannerNode;
  // Isochronic / phase path
  carrier: OscillatorNode;
  amGain: GainNode;            // iso AM
  amLfo: OscillatorNode;       // iso modulator
  amLfoScale: GainNode;
  phasePan: StereoPannerNode;  // phase mode panner
  phaseLfo: OscillatorNode;
  phaseLfoScale: GainNode;
  carrierGain: GainNode;
  // Solfeggio
  solf: SolfNode[];
  solfMix: GainNode;
  solfTap: GainNode;
  // Output
  outGain: GainNode;
}

let engine: Engine | null = null;
let state = {
  enabled: false,
  mode: "binaural" as BrainwaveMode,
  carrierHz: 220,
  beatHz: 10,
  isoRateHz: 10,
  phaseRateHz: 0.25,
  mix: 0.4,
  solfMode: "harmonic" as SolfMode,
  solfGain: 0.3,
  solfQ: 18,
  solfMask: Array(SOLFEGGIO_FREQS.length).fill(false) as boolean[],
  // Phase 3: clock coupling. Default FREE keeps legacy behaviour.
  clockMode: "FREE" as BrainwaveClockMode,
  syncDiv: "1/4" as Division,
};
let clockUnsub: (() => void) | null = null;

function ramp(p: AudioParam, v: number, t = 0.03) {
  const c = engine?.ctx; if (!c) return;
  p.setTargetAtTime(v, c.currentTime, t);
}

async function buildEngine(): Promise<Engine | null> {
  const ctx = await ensureAudio();
  const dest = masterInput();
  if (!dest) return null;

  // Binaural L/R
  const binauralL = ctx.createOscillator(); binauralL.type = "sine";
  const binauralR = ctx.createOscillator(); binauralR.type = "sine";
  const binauralGainL = ctx.createGain(); binauralGainL.gain.value = 0;
  const binauralGainR = ctx.createGain(); binauralGainR.gain.value = 0;
  const pannerL = ctx.createStereoPanner(); pannerL.pan.value = -1;
  const pannerR = ctx.createStereoPanner(); pannerR.pan.value = 1;
  binauralL.connect(binauralGainL).connect(pannerL);
  binauralR.connect(binauralGainR).connect(pannerR);

  // Carrier + AM + phase
  const carrier = ctx.createOscillator(); carrier.type = "sine";
  const amGain = ctx.createGain(); amGain.gain.value = 1;
  const amLfo = ctx.createOscillator(); amLfo.type = "square";
  const amLfoScale = ctx.createGain(); amLfoScale.gain.value = 0; // off until iso mode
  amLfo.connect(amLfoScale).connect(amGain.gain);

  const phasePan = ctx.createStereoPanner(); phasePan.pan.value = 0;
  const phaseLfo = ctx.createOscillator(); phaseLfo.type = "sine";
  const phaseLfoScale = ctx.createGain(); phaseLfoScale.gain.value = 0;
  phaseLfo.connect(phaseLfoScale).connect(phasePan.pan);

  const carrierGain = ctx.createGain(); carrierGain.gain.value = 0;
  carrier.connect(amGain).connect(phasePan).connect(carrierGain);

  // Solfeggio bank — taps carrierGain output
  const solfTap = ctx.createGain(); solfTap.gain.value = 1;
  carrierGain.connect(solfTap);
  const solf: SolfNode[] = SOLFEGGIO_FREQS.map((f) => {
    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = f;
    flt.Q.value = 18;
    const g = ctx.createGain();
    g.gain.value = 0;
    solfTap.connect(flt).connect(g);
    return { filter: flt, gain: g, on: false };
  });
  const solfMix = ctx.createGain(); solfMix.gain.value = 0.3;
  solf.forEach((s) => s.gain.connect(solfMix));

  // Output bus
  const outGain = ctx.createGain(); outGain.gain.value = 0;
  binauralGainL.connect(pannerL).connect(outGain);
  binauralGainR.connect(pannerR).connect(outGain);
  carrierGain.connect(outGain);
  solfMix.connect(outGain);
  outGain.connect(dest);

  // Start oscillators
  const t0 = ctx.currentTime;
  binauralL.start(t0); binauralR.start(t0);
  carrier.start(t0); amLfo.start(t0); phaseLfo.start(t0);

  return {
    ctx, binauralL, binauralR, binauralGainL, binauralGainR, pannerL, pannerR,
    carrier, amGain, amLfo, amLfoScale, phasePan, phaseLfo, phaseLfoScale,
    carrierGain, solf, solfMix, solfTap, outGain,
  };
}

/** Resolve effective rates after applying the active clock-coupling mode. */
function effectiveRates() {
  const bpm = masterClock.getState().bpm;
  const divHz = divisionHz(state.syncDiv, bpm);
  let beat = state.beatHz;
  let iso = state.isoRateHz;
  let phase = state.phaseRateHz;
  if (state.clockMode === "SYNC") {
    // Quantise modulation rates to the chosen division.
    beat = Math.max(0.1, Math.min(50, divHz));
    iso = Math.max(0.1, Math.min(60, divHz));
    phase = Math.max(0.05, Math.min(8, divHz));
  } else if (state.clockMode === "HYBRID") {
    // Carrier+beat untouched, only the phase LFO follows the clock.
    phase = Math.max(0.05, Math.min(8, divHz));
  }
  return { beat, iso, phase };
}

/** Apply current state to the engine (idempotent). */
function applyState() {
  const e = engine; if (!e) return;
  const c = state.carrierHz;
  const r = effectiveRates();
  const b = r.beat;
  // Binaural: L = c - b/2, R = c + b/2
  ramp(e.binauralL.frequency, Math.max(20, c - b / 2));
  ramp(e.binauralR.frequency, Math.max(20, c + b / 2));
  ramp(e.carrier.frequency, c);
  ramp(e.amLfo.frequency, Math.max(0.1, r.iso));
  ramp(e.phaseLfo.frequency, Math.max(0.05, r.phase));

  const onLevel = state.enabled ? state.mix : 0;
  switch (state.mode) {
    case "binaural":
      ramp(e.binauralGainL.gain, onLevel);
      ramp(e.binauralGainR.gain, onLevel);
      ramp(e.carrierGain.gain, 0);
      ramp(e.amLfoScale.gain, 0);
      ramp(e.phaseLfoScale.gain, 0);
      break;
    case "isochronic":
      ramp(e.binauralGainL.gain, 0);
      ramp(e.binauralGainR.gain, 0);
      // square LFO between 0..1 → multiply carrier
      ramp(e.amLfoScale.gain, 0.5);
      ramp(e.amGain.gain, 0.5); // bias so AM swings 0..1
      ramp(e.carrierGain.gain, onLevel);
      ramp(e.phaseLfoScale.gain, 0);
      break;
    case "phase":
      ramp(e.binauralGainL.gain, 0);
      ramp(e.binauralGainR.gain, 0);
      ramp(e.amLfoScale.gain, 0);
      ramp(e.amGain.gain, 1);
      ramp(e.carrierGain.gain, onLevel);
      ramp(e.phaseLfoScale.gain, 1); // ±1 panner sweep
      break;
  }

  // Solfeggio
  ramp(e.solfMix.gain, state.enabled ? state.solfGain : 0);
  e.solf.forEach((s, i) => {
    s.filter.Q.setTargetAtTime(state.solfQ, e.ctx.currentTime, 0.05);
    const want = state.solfMask[i] ? 0.4 : 0;
    ramp(s.gain.gain, want);
  });
  ramp(e.outGain.gain, state.enabled ? 1 : 0);
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function setBrainwaveEnabled(on: boolean): Promise<void> {
  state.enabled = on;
  if (on && !engine) engine = await buildEngine();
  applyState();
}
export function setBrainwaveMode(m: BrainwaveMode) { state.mode = m; applyState(); }
export function setBrainwaveCarrier(hz: number)     { state.carrierHz = Math.max(20, Math.min(2000, hz)); applyState(); }
export function setBrainwaveBeat(hz: number)        { state.beatHz = Math.max(0.1, Math.min(50, hz)); applyState(); }
export function setBrainwaveIsoRate(hz: number)     { state.isoRateHz = Math.max(0.1, Math.min(60, hz)); applyState(); }
export function setBrainwavePhaseRate(hz: number)   { state.phaseRateHz = Math.max(0.05, Math.min(8, hz)); applyState(); }
export function setBrainwaveMix(v: number)          { state.mix = Math.max(0, Math.min(1, v)); applyState(); }
export function applyBrainwavePreset(name: keyof typeof BRAINWAVE_PRESETS) {
  const p = BRAINWAVE_PRESETS[name];
  state.carrierHz = p.carrierHz; state.beatHz = p.beatHz;
  state.mode = p.mode; state.isoRateHz = p.isoRateHz;
  applyState();
}

export function setSolfeggioEnabled(idx: number, on: boolean) {
  if (idx < 0 || idx >= state.solfMask.length) return;
  state.solfMask[idx] = on;
  applyState();
}
export function setSolfeggioGain(v: number) { state.solfGain = Math.max(0, Math.min(1, v)); applyState(); }
export function setSolfeggioQ(v: number)    { state.solfQ = Math.max(1, Math.min(60, v)); applyState(); }
export function setSolfeggioMode(m: SolfMode) { state.solfMode = m; applyState(); }

/** Phase 3 — clock coupling. */
export function setBrainwaveClockMode(m: BrainwaveClockMode) {
  state.clockMode = m;
  ensureClockSubscription();
  applyState();
}
export function setBrainwaveSyncDiv(d: Division) {
  state.syncDiv = d;
  applyState();
}

function ensureClockSubscription() {
  if (state.clockMode === "FREE") {
    if (clockUnsub) { clockUnsub(); clockUnsub = null; }
    return;
  }
  if (clockUnsub) return;
  clockUnsub = masterClock.subscribe(() => { applyState(); });
}

export function getBrainwaveState() { return { ...state, solfMask: [...state.solfMask] }; }

// Test-only: reset state singleton.
export function __resetBrainwaveForTests() {
  engine = null;
  if (clockUnsub) { clockUnsub(); clockUnsub = null; }
  state = {
    enabled: false, mode: "binaural", carrierHz: 220, beatHz: 10, isoRateHz: 10,
    phaseRateHz: 0.25, mix: 0.4, solfMode: "harmonic", solfGain: 0.3, solfQ: 18,
    solfMask: Array(SOLFEGGIO_FREQS.length).fill(false),
    clockMode: "FREE", syncDiv: "1/4",
  };
}
