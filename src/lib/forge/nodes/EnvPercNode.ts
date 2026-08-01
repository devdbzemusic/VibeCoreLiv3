// EnvPercNode — VCA with one-shot AHD envelope (attack/hold/decay).
// Use as a percussive amp envelope: 1 input × env(t) → 1 output.
//
// On `trigger` control msg (value≥0.5) the envelope resets to t=0 and
// the input is gated through the AHD curve. After decay completes the
// node outputs absolute silence (no DC, no tail) so chained graphs stay
// click-free at idle.
//
// `curve` selects between linear (0) and exponential (1) decay shapes.
// Exponential gives the natural snap of analog VCAs.

import { BaseForgeNode } from "../node";
import type { ForgeAudioBlock, ForgeControlMsg, ForgeNodeDescriptor } from "../types";

export const EnvPercDescriptor: ForgeNodeDescriptor = {
  kind: "shape.env.perc",
  area: "shape",
  label: "EnvPerc",
  inputs: 1,
  outputs: 1,
  params: [
    { id: "attack", label: "Attack", min: 0.0005, max: 2, default: 0.005, unit: "s", curve: "exp" },
    { id: "hold",   label: "Hold",   min: 0,      max: 4, default: 0,     unit: "s" },
    { id: "decay",  label: "Decay",  min: 0.01,   max: 8, default: 0.2,   unit: "s", curve: "exp" },
    { id: "curve",  label: "Curve",  min: 0,      max: 1, default: 1 },
    { id: "level",  label: "Level",  min: 0,      max: 2, default: 1 },
    /** Initial trigger on init so previews start with a hit even before
     *  any automation queues a trigger event. Set 0 to require explicit trigger. */
    { id: "autoTrigger", label: "Auto", min: 0, max: 1, default: 1 },
  ],
};

const SILENCE = 1e-5;

export class EnvPercNode extends BaseForgeNode {
  readonly kind = "shape.env.perc";
  private t = Infinity;          // seconds since last trigger; Infinity = idle
  private active = false;

  init(opts: { sampleRate: number; blockSize: number; seed?: number }): void {
    super.init(opts);
    if (this.params.autoTrigger >= 0.5) {
      this.t = 0; this.active = true;
    }
  }

  /** Intercept "trigger" pseudo-param to reset envelope phase. */
  setParam(name: string, value: number, rampMs = 0): void {
    if (name === "trigger") {
      if (value >= 0.5) { this.t = 0; this.active = true; }
      return;
    }
    super.setParam(name, value, rampMs);
  }

  process(inputs: ForgeAudioBlock, outputs: ForgeAudioBlock, ctrl: ForgeControlMsg[]): void {
    this.applyControl(ctrl);
    const inp = inputs[0];
    const out = outputs[0];
    if (!this.active) { out.fill(0); return; }

    const sr = this.sampleRate;
    const dt = 1 / sr;
    const a = Math.max(0.0005, this.params.attack);
    const h = Math.max(0, this.params.hold);
    const d = Math.max(0.001, this.params.decay);
    const curve = this.params.curve; // 0 lin → 1 exp
    const level = this.params.level;
    const ad = a + h;

    for (let i = 0; i < out.length; i++) {
      let env: number;
      const t = this.t;
      if (t < a) {
        env = t / a;
      } else if (t < ad) {
        env = 1;
      } else {
        const k = (t - ad) / d;
        const lin = Math.max(0, 1 - k);
        const exp = Math.exp(-k * 5);
        env = lin * (1 - curve) + exp * curve;
      }
      const v = env * level;
      out[i] = (inp ? inp[i] : 0) * v;
      this.t += dt;
      if (t > ad && env < SILENCE) {
        this.active = false;
        // Zero out the rest of the block to enforce hard silence.
        for (let j = i + 1; j < out.length; j++) out[j] = 0;
        break;
      }
    }
  }
}

export function createEnvPerc(_id: string, params: Record<string, number>) {
  return new EnvPercNode(EnvPercDescriptor, params);
}
