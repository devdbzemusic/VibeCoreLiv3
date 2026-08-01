// VibeCore FX Mix Lab — Insert FX Chain Builder.
//
// Builds per-channel insert FX chains using DSP Core primitives.
// Each insert chain is a series of Web Audio nodes that connects into
// the existing PartChain (between chain.input and chain.hp).
//
// Architecture: FX Mix Lab does NOT create its own audio graph. It inserts
// DSP Core nodes into the existing Audio Engine graph by disconnecting
// `chain.input → chain.hp` and re-routing through the insert chain.
//
// Realtime-safe: all node creation happens on the control thread during
// setup. Parameter updates use setTargetAtTime (no per-sample allocation).
// DSP Core factories do NOT have `update` methods — we update AudioParams
// directly on the created nodes.

import {
  createCompressor, createLimiter, createGate, createExpander,
  createDistortion, createDCBlocker,
  createDelay,
  createHallReverb,
  createStereoWidth,
  createLP, createHP, createBP, createNotch,
  type CompressorParams,
} from "@/lib/dsp";
import type { InsertFxType, InsertSlot } from "./types";

export interface InsertChainNode {
  input: AudioNode;
  output: AudioNode;
  update: (params: Record<string, number>, bpm: number) => void;
  dispose: () => void;
}

function expScale(min: number, max: number, t: number): number {
  return min * Math.pow(max / min, Math.max(0, Math.min(1, t / 100)));
}

// ── Factory: create one insert FX node from a slot ─────────────────────────────

function buildInsert(c: AudioContext, type: InsertFxType): InsertChainNode {
  switch (type) {
    case "EQ": {
      const low = c.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 200;
      const mid = c.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 1;
      const high = c.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 5000;
      low.connect(mid).connect(high);
      return {
        input: low, output: high,
        update: (p) => {
          low.gain.setTargetAtTime(((p.A ?? 50) - 50) / 50 * 12, c.currentTime, 0.02);
          mid.gain.setTargetAtTime(((p.B ?? 50) - 50) / 50 * 12, c.currentTime, 0.02);
          mid.frequency.setTargetAtTime(expScale(200, 5000, p.C ?? 50), c.currentTime, 0.02);
          high.gain.setTargetAtTime(((p.D ?? 50) - 50) / 50 * 12, c.currentTime, 0.02);
        },
        dispose: () => { [low, mid, high].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); },
      };
    }
    case "Compressor": {
      const cp = createCompressor(c, { threshold: -20, knee: 6, ratio: 4, attack: 0.003, release: 0.1 } as CompressorParams);
      return {
        input: cp.input, output: cp.output,
        update: (p) => {
          cp.comp.threshold.setTargetAtTime(-60 + (p.A ?? 50) / 100 * 60, c.currentTime, 0.02);
          cp.comp.ratio.setTargetAtTime(1 + (p.B ?? 50) / 100 * 19, c.currentTime, 0.02);
          cp.comp.attack.setTargetAtTime(0.001 + (p.C ?? 50) / 100 * 0.099, c.currentTime, 0.02);
          cp.comp.release.setTargetAtTime(0.01 + (p.D ?? 50) / 100 * 0.59, c.currentTime, 0.02);
        },
        dispose: () => { try { cp.input.disconnect(); } catch { /**/ } try { cp.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Limiter": {
      const lim = createLimiter(c, { threshold: -1, release: 0.05 });
      const inG = c.createGain();
      inG.connect(lim);
      return {
        input: inG, output: lim,
        update: (p) => {
          lim.threshold.setTargetAtTime(-12 + (p.A ?? 80) / 100 * 12, c.currentTime, 0.02);
          lim.release.setTargetAtTime(0.01 + (p.B ?? 30) / 100 * 0.29, c.currentTime, 0.02);
        },
        dispose: () => { try { inG.disconnect(); lim.disconnect(); } catch { /**/ } },
      };
    }
    case "Gate": {
      const gate = createGate(c, { threshold: -40, attack: 0.001, release: 0.05 });
      return {
        input: gate, output: gate,
        update: (p) => {
          gate.threshold.setTargetAtTime(-80 + (p.A ?? 30) / 100 * 70, c.currentTime, 0.02);
          gate.release.setTargetAtTime(0.01 + (p.B ?? 30) / 100 * 0.49, c.currentTime, 0.02);
        },
        dispose: () => { try { gate.disconnect(); } catch { /**/ } },
      };
    }
    case "Expander": {
      const exp = createExpander(c, { threshold: -30, ratio: 2, attack: 0.003, release: 0.1 });
      return {
        input: exp, output: exp,
        update: (p) => {
          exp.threshold.setTargetAtTime(-60 + (p.A ?? 40) / 100 * 50, c.currentTime, 0.02);
          exp.ratio.setTargetAtTime(1 + (p.B ?? 30) / 100 * 9, c.currentTime, 0.02);
        },
        dispose: () => { try { exp.disconnect(); } catch { /**/ } },
      };
    }
    case "Distortion": {
      const dist = createDistortion(c, { type: "drive", amount: 0.5 });
      return {
        input: dist.input, output: dist.output,
        update: (p) => {
          // Update pre/post gain for live drive control
          const drive = (p.A ?? 50) / 100;
          dist.input.gain.setTargetAtTime(1 + drive * 4, c.currentTime, 0.02);
          dist.output.gain.setTargetAtTime(1 / (1 + drive * 2), c.currentTime, 0.02);
        },
        dispose: () => { try { dist.input.disconnect(); } catch { /**/ } try { dist.shaper.disconnect(); } catch { /**/ } try { dist.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Saturation": {
      const sat = createDistortion(c, { type: "saturation", amount: 0.3 });
      return {
        input: sat.input, output: sat.output,
        update: (p) => {
          sat.input.gain.setTargetAtTime(1 + (p.A ?? 30) / 100 * 2, c.currentTime, 0.02);
        },
        dispose: () => { try { sat.input.disconnect(); sat.shaper.disconnect(); sat.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Tube": {
      const tube = createDistortion(c, { type: "tube", amount: 0.4 });
      return {
        input: tube.input, output: tube.output,
        update: (p) => {
          tube.input.gain.setTargetAtTime(1 + (p.A ?? 40) / 100 * 2, c.currentTime, 0.02);
        },
        dispose: () => { try { tube.input.disconnect(); tube.shaper.disconnect(); tube.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Tape": {
      const tape = createDistortion(c, { type: "tape", amount: 0.35 });
      return {
        input: tape.input, output: tape.output,
        update: (p) => {
          tape.input.gain.setTargetAtTime(1 + (p.A ?? 35) / 100 * 1.5, c.currentTime, 0.02);
        },
        dispose: () => { try { tape.input.disconnect(); tape.shaper.disconnect(); tape.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Foldback": {
      const fb = createDistortion(c, { type: "foldback", amount: 1, threshold: 0.5 });
      return {
        input: fb.input, output: fb.output,
        update: (p) => {
          fb.input.gain.setTargetAtTime(1 + (p.A ?? 50) / 100 * 3, c.currentTime, 0.02);
        },
        dispose: () => { try { fb.input.disconnect(); fb.shaper.disconnect(); fb.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Bitcrush": {
      const bc = createDistortion(c, { type: "bitcrush", amount: 1, threshold: 8, oversample: "none" });
      return {
        input: bc.input, output: bc.output,
        update: () => { /* bitcrush curve is baked — would need rebuild for live bit changes */ },
        dispose: () => { try { bc.input.disconnect(); bc.shaper.disconnect(); bc.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Chorus": {
      const delay = c.createDelay(0.05); delay.delayTime.value = 0.025;
      const lfo = c.createOscillator(); lfo.frequency.value = 1.5;
      const lfoG = c.createGain(); lfoG.gain.value = 0.005;
      const fb = c.createGain(); fb.gain.value = 0.3;
      const wet = c.createGain(); wet.gain.value = 0.5;
      const dry = c.createGain(); dry.gain.value = 1;
      const out = c.createGain();
      lfo.connect(lfoG).connect(delay.delayTime); lfo.start();
      dry.connect(out);
      dry.connect(delay);
      delay.connect(wet).connect(out);
      delay.connect(fb).connect(delay);
      return {
        input: dry, output: out,
        update: (p) => {
          lfo.frequency.setTargetAtTime(0.5 + (p.A ?? 30) / 100 * 5, c.currentTime, 0.05);
          lfoG.gain.setTargetAtTime((p.B ?? 40) / 100 * 0.01, c.currentTime, 0.05);
          fb.gain.setTargetAtTime((p.C ?? 30) / 100 * 0.6, c.currentTime, 0.05);
          wet.gain.setTargetAtTime((p.D ?? 50) / 100 * 0.5, c.currentTime, 0.05);
        },
        dispose: () => { [delay, lfoG, fb, wet, dry, out].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); try { lfo.stop(); } catch { /**/ } },
      };
    }
    case "Flanger": {
      const delay = c.createDelay(0.01); delay.delayTime.value = 0.005;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.5;
      const lfoG = c.createGain(); lfoG.gain.value = 0.002;
      const fb = c.createGain(); fb.gain.value = 0.6;
      const out = c.createGain();
      lfo.connect(lfoG).connect(delay.delayTime); lfo.start();
      const dry = c.createGain(); dry.gain.value = 1;
      dry.connect(out); dry.connect(delay); delay.connect(out);
      delay.connect(fb).connect(delay);
      return {
        input: dry, output: out,
        update: (p) => {
          lfo.frequency.setTargetAtTime(0.1 + (p.A ?? 30) / 100 * 6, c.currentTime, 0.05);
          lfoG.gain.setTargetAtTime((p.B ?? 50) / 100 * 0.004, c.currentTime, 0.05);
          fb.gain.setTargetAtTime((p.C ?? 60) / 100 * 0.9, c.currentTime, 0.05);
        },
        dispose: () => { [delay, lfoG, fb, dry, out].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); try { lfo.stop(); } catch { /**/ } },
      };
    }
    case "Phaser": {
      // Phaser = series of all-pass filters with LFO-modulated frequency.
      // Uses Web Audio BiquadFilter (allpass) — same primitive the DSP Core uses.
      const stages = 4;
      const filters: BiquadFilterNode[] = [];
      const lfo = c.createOscillator(); lfo.frequency.value = 0.3;
      const lfoG = c.createGain(); lfoG.gain.value = 400;
      const out = c.createGain();
      const dry = c.createGain(); dry.gain.value = 0.5;
      const wet = c.createGain(); wet.gain.value = 0.5;
      let prev: AudioNode = dry;
      for (let i = 0; i < stages; i++) {
        const f = c.createBiquadFilter(); f.type = "allpass"; f.frequency.value = 400 + i * 200; f.Q.value = 2;
        lfoG.connect(f.frequency);
        prev.connect(f);
        prev = f; filters.push(f);
      }
      prev.connect(wet).connect(out);
      dry.connect(out);
      lfo.connect(lfoG); lfo.start();
      return {
        input: dry, output: out,
        update: (p) => {
          lfo.frequency.setTargetAtTime(0.1 + (p.A ?? 30) / 100 * 4, c.currentTime, 0.05);
          lfoG.gain.setTargetAtTime(100 + (p.B ?? 50) / 100 * 800, c.currentTime, 0.05);
          wet.gain.setTargetAtTime((p.C ?? 50) / 100 * 0.5, c.currentTime, 0.05);
        },
        dispose: () => { filters.forEach((f) => { try { f.disconnect(); } catch { /**/ } }); [lfoG, wet, dry, out].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); try { lfo.stop(); } catch { /**/ } },
      };
    }
    case "Delay": {
      const d = createDelay(c, { timeSec: 0.3, feedback: 0.4, mix: 0.5 });
      return {
        input: d.input, output: d.output,
        update: (p, bpm) => {
          const beat = 60 / Math.max(40, bpm);
          d.delay.delayTime.setTargetAtTime(beat * (0.25 + (p.A ?? 30) / 100 * 1.5), c.currentTime, 0.05);
          d.feedback.gain.setTargetAtTime((p.B ?? 40) / 100 * 0.9, c.currentTime, 0.05);
          d.wet.gain.setTargetAtTime((p.C ?? 50) / 100 * 0.5, c.currentTime, 0.05);
        },
        dispose: () => { [d.input, d.dry, d.delay, d.feedback, d.wet, d.output].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); },
      };
    }
    case "Reverb": {
      const r = createHallReverb(c, 3, 0.4);
      return {
        input: r.input, output: r.output,
        update: (p) => {
          r.wet.gain.setTargetAtTime((p.A ?? 40) / 100 * 0.6, c.currentTime, 0.05);
          r.dry.gain.setTargetAtTime(1 - (p.A ?? 40) / 100 * 0.6, c.currentTime, 0.05);
        },
        dispose: () => { [r.input, r.dry, r.convolver, r.wet, r.output].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); },
      };
    }
    case "Filter LP": {
      const f = createLP(c, { frequency: 20000, q: 0.7 });
      return {
        input: f, output: f,
        update: (p) => {
          f.frequency.setTargetAtTime(expScale(100, 20000, p.A ?? 100), c.currentTime, 0.02);
          f.Q.setTargetAtTime(0.5 + (p.B ?? 0) / 100 * 10, c.currentTime, 0.02);
        },
        dispose: () => { try { f.disconnect(); } catch { /**/ } },
      };
    }
    case "Filter HP": {
      const f = createHP(c, { frequency: 20, q: 0.7 });
      return {
        input: f, output: f,
        update: (p) => {
          f.frequency.setTargetAtTime(expScale(20, 2000, p.A ?? 0), c.currentTime, 0.02);
          f.Q.setTargetAtTime(0.5 + (p.B ?? 0) / 100 * 10, c.currentTime, 0.02);
        },
        dispose: () => { try { f.disconnect(); } catch { /**/ } },
      };
    }
    case "Filter BP": {
      const f = createBP(c, { frequency: 1000, q: 1 });
      return {
        input: f, output: f,
        update: (p) => {
          f.frequency.setTargetAtTime(expScale(100, 20000, p.A ?? 50), c.currentTime, 0.02);
          f.Q.setTargetAtTime(0.5 + (p.B ?? 50) / 100 * 15, c.currentTime, 0.02);
        },
        dispose: () => { try { f.disconnect(); } catch { /**/ } },
      };
    }
    case "Filter Notch": {
      const f = createNotch(c, { frequency: 1000, q: 1 });
      return {
        input: f, output: f,
        update: (p) => {
          f.frequency.setTargetAtTime(expScale(100, 20000, p.A ?? 50), c.currentTime, 0.02);
          f.Q.setTargetAtTime(0.5 + (p.B ?? 50) / 100 * 15, c.currentTime, 0.02);
        },
        dispose: () => { try { f.disconnect(); } catch { /**/ } },
      };
    }
    case "Stereo Width": {
      const sw = createStereoWidth(c, 1.2);
      return {
        input: sw.input, output: sw.output,
        update: (p) => {
          sw.widthGain.gain.setTargetAtTime(0.5 + (p.A ?? 60) / 100 * 1.5, c.currentTime, 0.05);
        },
        dispose: () => { try { sw.input.disconnect(); } catch { /**/ } try { sw.output.disconnect(); } catch { /**/ } },
      };
    }
    case "Ring Mod": {
      const ring = c.createGain(); ring.gain.value = 0;
      const carrier = c.createOscillator(); carrier.type = "sine"; carrier.frequency.value = 200;
      const carG = c.createGain(); carG.gain.value = 1;
      carrier.connect(carG).connect(ring.gain); carrier.start();
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 8000;
      ring.connect(tone);
      return {
        input: ring, output: tone,
        update: (p) => {
          carrier.frequency.setTargetAtTime(30 + (p.A ?? 40) / 100 * 2970, c.currentTime, 0.02);
          tone.frequency.setTargetAtTime(expScale(500, 16000, p.C ?? 60), c.currentTime, 0.05);
        },
        dispose: () => { [ring, carrier, carG, tone].forEach((n) => { try { n.disconnect(); } catch { /**/ } }); try { carrier.stop(); } catch { /**/ } },
      };
    }
    case "DC Blocker": {
      const dc = createDCBlocker(c);
      return {
        input: dc, output: dc,
        update: () => { /* fixed at 20 Hz */ },
        dispose: () => { try { dc.disconnect(); } catch { /**/ } },
      };
    }
    default: {
      const g = c.createGain();
      return { input: g, output: g, update: () => {}, dispose: () => { try { g.disconnect(); } catch { /**/ } } };
    }
  }
}

// ── Full Insert Chain ─────────────────────────────────────────────────────────

export interface BuiltInsertChain {
  input: AudioNode;
  output: AudioNode;
  nodes: InsertChainNode[];
  update: (slots: InsertSlot[], bpm: number) => void;
  dispose: () => void;
}

/** Build a complete insert chain from an ordered list of insert slots.
 *  Each non-bypassed slot creates one InsertChainNode, chained in order.
 *  Bypassed slots pass through a gain node (unity). */
export function buildInsertChain(c: AudioContext, slots: InsertSlot[]): BuiltInsertChain {
  const nodes: InsertChainNode[] = [];

  for (const slot of slots) {
    if (slot.bypass) {
      const g = c.createGain(); g.gain.value = 1;
      nodes.push({ input: g, output: g, update: () => {}, dispose: () => { try { g.disconnect(); } catch { /**/ } } });
    } else {
      nodes.push(buildInsert(c, slot.type));
    }
  }

  // Chain nodes: input → node[0] → node[1] → ... → output
  const input = c.createGain();
  const output = c.createGain();
  let prev: AudioNode = input;
  for (const node of nodes) {
    prev.connect(node.input);
    prev = node.output;
  }
  prev.connect(output);

  return {
    input, output, nodes,
    update: (allSlots, bpm) => {
      for (let i = 0; i < nodes.length && i < allSlots.length; i++) {
        nodes[i].update(allSlots[i].params, bpm);
      }
    },
    dispose: () => {
      try { input.disconnect(); } catch { /**/ }
      try { output.disconnect(); } catch { /**/ }
      nodes.forEach((n) => n.dispose());
    },
  };
}