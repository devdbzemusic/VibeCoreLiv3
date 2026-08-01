// SampleSourceNode — minimal Sprint-1 source.
// Plays back a Float32Array buffer with looping + speed.
// Real granular logic lives in src/lib/audio/granular.ts and will be wired
// in later sprints; this node provides a deterministic baseline for tests.

import { BaseForgeNode } from "../node";
import type { ForgeAudioBlock, ForgeControlMsg, ForgeNodeDescriptor } from "../types";

export const SampleSourceDescriptor: ForgeNodeDescriptor = {
  kind: "source.sample",
  area: "source",
  label: "Sample",
  inputs: 0,
  outputs: 1,
  params: [
    { id: "gain", label: "Gain", min: 0, max: 2, default: 1, curve: "lin" },
    { id: "speed", label: "Speed", min: 0.25, max: 4, default: 1, curve: "exp" },
    { id: "loop", label: "Loop", min: 0, max: 1, default: 1 },
  ],
};

export class SampleSourceNode extends BaseForgeNode {
  readonly kind = "source.sample";
  private buffer: Float32Array = new Float32Array(0);
  /** Read head (fractional). */
  private pos = 0;

  /** Replace the underlying sample buffer (mono). */
  setBuffer(buf: Float32Array): void {
    this.buffer = buf;
    this.pos = 0;
  }

  process(_inputs: ForgeAudioBlock, outputs: ForgeAudioBlock, ctrl: ForgeControlMsg[]): void {
    this.applyControl(ctrl);
    const out = outputs[0];
    const buf = this.buffer;
    const len = buf.length;
    if (len === 0) {
      out.fill(0);
      return;
    }
    const loop = this.params.loop >= 0.5;
    for (let i = 0; i < out.length; i++) {
      const gain = this.tickRamp("gain");
      const speed = this.tickRamp("speed");
      if (this.pos >= len) {
        if (loop) this.pos -= len;
        else { out[i] = 0; continue; }
      }
      // Linear interpolation.
      const i0 = Math.floor(this.pos);
      const frac = this.pos - i0;
      const i1 = i0 + 1 < len ? i0 + 1 : (loop ? 0 : i0);
      out[i] = (buf[i0] * (1 - frac) + buf[i1] * frac) * gain;
      this.pos += speed;
    }
  }
}

export function createSampleSource(_id: string, params: Record<string, number>) {
  return new SampleSourceNode(SampleSourceDescriptor, params);
}
