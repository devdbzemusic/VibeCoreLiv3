// Modulation runtime — reads ModRoutes from store, computes per-source values
// and writes additive offsets to per-part AudioParams + FX wet gains + trigger
// offsets. Random source is seeded per-pattern (deterministic).
//
// TODO(RFC): Ribbon and MIDI CC are reserved sources. Their host-side input
// interfaces are not yet wired:
//   - Ribbon needs a touch/pointer surface in the UI that pushes a normalized
//     0..1 value into a ring buffer consumed here.
//   - MIDI CC needs WebMIDI subscription + per-route CC# selection in the
//     route editor. Both should land via a `ModulationInput` interface so the
//     runtime treats them identically to internal sources.

import { useGroove } from "@/lib/store";
import type { ModDestParam, ModRoute, ModSource } from "@/lib/model";
import { getCtx, getFxBuses, getPartChain, modOffsets, grainModOffsets } from "./engine";
import { mulberry32, hashSeed, type Rng } from "@/lib/utils/random";
import { clamp } from "@/lib/dsp";

let started = false;
let randomHold = 0;
let lastRandomBeat = -1;
let randomRng: Rng | null = null;
let randomRngSeed = 0;

// Module-scope reusable accumulators — avoid per-tick heap allocation
// (Band 3 §5: no unnecessary heap allocations in the control path).
// Previously the rAF tick allocated 3 new collections at 60 Hz →
// 180 allocations/sec GC pressure on the main thread.
const _partAcc = new Map<string, number>();
const _fxWetAcc = new Map<number, number>();
const _liveActive = new Set<string>();

/** Future input adapters — kept as types so wiring later is additive. */
export interface RibbonInput { read(): number /* 0..1 */ }
export interface MidiCcInput { read(cc: number): number /* 0..1 */ }
// Runtime defaults — return centred values; real input pushes via setters.
let ribbonInput: RibbonInput | null = null;
let midiInput: MidiCcInput | null = null;
export function setRibbonInput(r: RibbonInput | null) { ribbonInput = r; }
export function setMidiCcInput(m: MidiCcInput | null) { midiInput = m; }

function srcValue(src: ModSource, t: number, currentStep: number, bpm: number): number {
  switch (src) {
    case "LFO 1": return Math.sin(2 * Math.PI * 0.5 * t);
    case "LFO 2": return Math.sin(2 * Math.PI * 0.25 * t + 1.1);
    case "ENV 1": {
      const period = (60 / bpm) * 4;
      const phase = (t % period) / period;
      return 1 - 2 * phase;
    }
    case "ENV 2": {
      const period = (60 / bpm) * 2;
      const phase = (t % period) / period;
      return (Math.exp(-3 * phase) * 2 - 1);
    }
    case "Step LFO": {
      const triPos = (currentStep % 8) / 8;
      return Math.abs(triPos * 2 - 1) * 2 - 1;
    }
    case "Velocity": return 0.5;
    case "Random": {
      const beat = Math.floor(t * (bpm / 60));
      if (beat !== lastRandomBeat) {
        lastRandomBeat = beat;
        const rng = randomRng ?? (randomRng = mulberry32(randomRngSeed || 0xC0FFEE));
        randomHold = rng() * 2 - 1;
      }
      return randomHold;
    }
    case "Ribbon": return ribbonInput ? (ribbonInput.read() * 2 - 1) : 0;
    case "MIDI CC": return midiInput ? (midiInput.read(0) * 2 - 1) : 0;
    default: return 0;
  }
}

function applyCurve(v: number, curve: ModRoute["curve"]): number {
  const sign = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  switch (curve) {
    case "lin": return v;
    case "exp": return sign * a * a;
    case "log": return sign * Math.sqrt(a);
    case "snh": return v;
    default: return v;
  }
}

// Map FX-related dest params → fx slot index whose type matches.
function findFxSlot(destParam: ModDestParam): number | null {
  const fx = useGroove.getState().fx;
  const wanted: Record<string, string[]> = {
    "Delay Wet":      ["BPM Delay", "Short Delay", "Ping Pong"],
    "Reverb Wet":     ["Hall Reverb", "Room Reverb", "Freeze"],
    "Chorus Depth":   ["Chorus"],
    "Flanger Depth":  ["Flanger"],
    "RingMod Amount": ["Ring Mod"],
  };
  const types = wanted[destParam];
  if (!types) return null;
  const i = fx.findIndex((f) => f.type && types.includes(f.type));
  return i >= 0 ? i : null;
}

export function startModulationLoop() {
  if (started) return;
  started = true;

  const tick = () => {
    const c = getCtx();
    if (!c) { requestAnimationFrame(tick); return; }
    const state = useGroove.getState();
    const t = c.currentTime;
    const now = t;
    const fxBuses = getFxBuses();

    // Reuse module-scope accumulators — cleared in-place, no per-tick
    // allocation (Band 3 §5).
    _partAcc.clear();
    _fxWetAcc.clear();
    _liveActive.clear();
    const partAcc = _partAcc;
    const fxWetAcc = _fxWetAcc;
    const liveActive = _liveActive;
    let activeCount = 0;

    // Use the route's target part's current step for the Step-LFO source.
    // Re-seed the Random source from the active pattern so generation is
    // reproducible per (pattern.seed).
    const pat = state.patterns[state.transport.currentPattern];
    if (pat && pat.seed !== randomRngSeed) {
      randomRngSeed = pat.seed;
      randomRng = mulberry32(pat.seed);
    }
    state.mod.forEach((r) => {
      if (!r.enabled) return;
      const partStep = state.playheads.step ?? 0;
      const raw = srcValue(r.source, now, partStep, state.bpm);
      const shaped = applyCurve(raw, r.curve);
      const scaled = shaped * (r.amount / 100); // -1..1
      const key = `${r.partId}|${r.destParam}`;
      partAcc.set(key, (partAcc.get(key) ?? 0) + scaled);
      liveActive.add(r.id);
      activeCount++;
    });

    // Clear stale trigger-time offsets
    modOffsets.pitch.clear();
    modOffsets.sampleStart.clear();
    modOffsets.sampleEnd.clear();
    // Clear continuous grain offsets — they will be re-summed below
    grainModOffsets.size.clear();
    grainModOffsets.density.clear();
    grainModOffsets.pos.clear();
    grainModOffsets.spray.clear();
    grainModOffsets.width.clear();
    grainModOffsets.freezePos.clear();
    grainModOffsets.freezeMix.clear();
    grainModOffsets.stretch.clear();

    partAcc.forEach((val, key) => {
      const [pidStr, ...rest] = key.split("|");
      const partId = Number(pidStr);
      const dest = rest.join("|") as ModDestParam;
      const chain = getPartChain(partId);
      if (!chain) return;
      const tau = 0.03;
      switch (dest) {
        case "Filter Cutoff": {
          // multiplicative on top of base lp freq.
          // Sub-20Hz rule: LFO modulations must not pull cutoff into the
          // body-resonance band (<20Hz) — that band conflicts with sub
          // content and produces inaudible thumps + DC drift.
          const base = chain.lp.frequency.value;
          const next = clamp(base * Math.pow(2, val * 3), 20, 20000);
          chain.lp.frequency.setTargetAtTime(next, t, tau);
          break;
        }
        case "Resonance": {
          const base = chain.lp.Q.value;
          const next = clamp(base + val * 6, 0.5, 18);
          chain.lp.Q.setTargetAtTime(next, t, tau);
          break;
        }
        case "Volume": {
          const part = state.parts[partId];
          const base = (part?.volume ?? 78) / 100;
          const next = clamp(base + val * 0.5, 0, 1.5);
          chain.volume.gain.setTargetAtTime(next, t, tau);
          break;
        }
        case "Pan": {
          const part = state.parts[partId];
          const base = clamp((part?.pan ?? 0) / 50, -1, 1);
          chain.pan.pan.setTargetAtTime(clamp(base + val, -1, 1), t, tau);
          break;
        }
        case "Pitch": {
          modOffsets.pitch.set(partId, val * 12); // ±1 octave
          break;
        }
        case "Sample Start": {
          modOffsets.sampleStart.set(partId, clamp(0.5 + val * 0.5, 0, 0.95));
          break;
        }
        case "Sample End": {
          modOffsets.sampleEnd.set(partId, clamp(0.5 + val * 0.5, 0.05, 1));
          break;
        }
        case "Delay Wet":
        case "Reverb Wet":
        case "Chorus Depth":
        case "Flanger Depth":
        case "RingMod Amount": {
          const slot = findFxSlot(dest);
          if (slot == null) break;
          fxWetAcc.set(slot, (fxWetAcc.get(slot) ?? 0) + val);
          break;
        }
        // Continuous grain/freeze/stretch — additive normalized offsets
        case "Grain Size":      grainModOffsets.size.set(partId, (grainModOffsets.size.get(partId) ?? 0) + val); break;
        case "Grain Density":   grainModOffsets.density.set(partId, (grainModOffsets.density.get(partId) ?? 0) + val); break;
        case "Grain Position":  grainModOffsets.pos.set(partId, (grainModOffsets.pos.get(partId) ?? 0) + val * 0.5); break;
        case "Spray":           grainModOffsets.spray.set(partId, (grainModOffsets.spray.get(partId) ?? 0) + val); break;
        case "Stereo Width":    grainModOffsets.width.set(partId, (grainModOffsets.width.get(partId) ?? 0) + val); break;
        case "Freeze Position": grainModOffsets.freezePos.set(partId, (grainModOffsets.freezePos.get(partId) ?? 0) + val * 0.5); break;
        case "Freeze Mix":      grainModOffsets.freezeMix.set(partId, (grainModOffsets.freezeMix.get(partId) ?? 0) + val); break;
        case "Stretch Amount":  grainModOffsets.stretch.set(partId, (grainModOffsets.stretch.get(partId) ?? 0) + val); break;
      }
    });

    fxWetAcc.forEach((val, slot) => {
      const bus = fxBuses[slot];
      if (!bus) return;
      const f = state.fx[slot];
      const base = (f.mix / 100) * (f.bypass ? 0 : 1);
      const next = clamp(base + val, 0, 1.5);
      bus.wet.gain.setTargetAtTime(next, t, 0.03);
    });

    // expose live active count for UI highlighting
    const prev = state.modActive ?? 0;
    if (prev !== activeCount) useGroove.setState({ modActive: activeCount });

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}