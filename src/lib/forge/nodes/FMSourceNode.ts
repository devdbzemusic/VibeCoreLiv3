// FMSourceNode — 2-operator FM (sine carrier modulated by sine modulator).
// Deterministic, click-free at constant params; ramped param changes are
// smoothed via the BaseForgeNode ramp mechanism.

import { BaseForgeNode } from "../node";
import type { ForgeAudioBlock, ForgeControlMsg, ForgeNodeDescriptor } from "../types";

export const FMSourceDescriptor: ForgeNodeDescriptor = {
  kind: "source.fm",
  area: "source",
  label: "FM",
  inputs: 0,
  outputs: 1,
  params: [
    { id: "freq", label: "Freq", min: 20, max: 8000, default: 220, unit: "Hz", curve: "log" },
    { id: "ratio", label: "Ratio", min: 0.25, max: 16, default: 2, curve: "exp" },
    { id: "amount", label: "Amount", min: 0, max: 2000, default: 200, curve: "exp" },
    { id: "gain", label: "Gain", min: 0, max: 2, default: 0.7 },
  ],
};

export class FMSourceNode extends BaseForgeNode {
  readonly kind = "source.fm";
  private carrierPhase = 0;
  private modPhase = 0;

  process(_inputs: ForgeAudioBlock, outputs: ForgeAudioBlock, ctrl: ForgeControlMsg[]): void {
    this.applyControl(ctrl);
    const out = outputs[0];
    const twoPi = Math.PI * 2;
    const sr = this.sampleRate;
    for (let i = 0; i < out.length; i++) {
      const freq = this.tickRamp("freq");
      const ratio = this.tickRamp("ratio");
      const amount = this.tickRamp("amount");
      const gain = this.tickRamp("gain");
      const modFreq = freq * ratio;
      const mod = Math.sin(this.modPhase) * amount;
      out[i] = Math.sin(this.carrierPhase + (mod / sr) * twoPi) * gain;
      this.carrierPhase += (freq / sr) * twoPi;
      this.modPhase += (modFreq / sr) * twoPi;
      if (this.carrierPhase > twoPi) this.carrierPhase -= twoPi;
      if (this.modPhase > twoPi) this.modPhase -= twoPi;
    }
  }
}

export function createFMSource(_id: string, params: Record<string, number>) {
  return new FMSourceNode(FMSourceDescriptor, params);
}
