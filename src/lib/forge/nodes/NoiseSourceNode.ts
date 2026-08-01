// NoiseSourceNode — white / pink noise source.
// `color`: 0 = white, 1 = pink (Paul Kellet's filter, classic 7-pole approx).
// Deterministic with a 32-bit LCG so renders are reproducible in tests.

import { BaseForgeNode } from "../node";
import type { ForgeAudioBlock, ForgeControlMsg, ForgeNodeDescriptor } from "../types";

export const NoiseSourceDescriptor: ForgeNodeDescriptor = {
  kind: "source.noise",
  area: "source",
  label: "Noise",
  inputs: 0,
  outputs: 1,
  params: [
    { id: "gain", label: "Gain", min: 0, max: 2, default: 0.7 },
    { id: "color", label: "Color", min: 0, max: 1, default: 0 },
    { id: "seed", label: "Seed", min: 1, max: 1e9, default: 0xc0ffee },
  ],
};

export class NoiseSourceNode extends BaseForgeNode {
  readonly kind = "source.noise";
  private state = 0xdeadbeef;
  private p0 = 0; private p1 = 0; private p2 = 0; private p3 = 0;
  private p4 = 0; private p5 = 0; private p6 = 0;

  init(opts: { sampleRate: number; blockSize: number; seed?: number }): void {
    super.init(opts);
    const seedParam = this.params.seed | 0;
    this.state = (opts.seed ?? seedParam ?? 1) >>> 0 || 1;
  }

  private rand(): number {
    // xorshift32 → [-1, 1)
    let x = this.state | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return (this.state / 0x80000000) - 1;
  }

  process(_inputs: ForgeAudioBlock, outputs: ForgeAudioBlock, ctrl: ForgeControlMsg[]): void {
    this.applyControl(ctrl);
    const out = outputs[0];
    for (let i = 0; i < out.length; i++) {
      const gain = this.tickRamp("gain");
      const color = this.tickRamp("color");
      const w = this.rand();
      // Pink filter (Kellet)
      this.p0 = 0.99886 * this.p0 + w * 0.0555179;
      this.p1 = 0.99332 * this.p1 + w * 0.0750759;
      this.p2 = 0.96900 * this.p2 + w * 0.1538520;
      this.p3 = 0.86650 * this.p3 + w * 0.3104856;
      this.p4 = 0.55000 * this.p4 + w * 0.5329522;
      this.p5 = -0.7616 * this.p5 - w * 0.0168980;
      const pink = (this.p0 + this.p1 + this.p2 + this.p3 + this.p4 + this.p5 + this.p6 + w * 0.5362) * 0.11;
      this.p6 = w * 0.115926;
      out[i] = (w * (1 - color) + pink * color) * gain;
    }
  }
}

export function createNoiseSource(_id: string, params: Record<string, number>) {
  return new NoiseSourceNode(NoiseSourceDescriptor, params);
}
