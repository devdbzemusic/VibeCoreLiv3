// Offline preset renderer — runs a ForgePreset through the block graph for
// `durationSec` and returns a mono Float32Array. Used to:
//   • audition presets in the UI without committing them to a Part
//   • bake presets into AudioBuffers and assign them to a Part slot
//   • drive deterministic Vitest checks (peak / RMS / click count)
//
// Automation events are dispatched at the block boundary covering their
// `atSec` timestamp via queueControl + the BaseForgeNode ramp mechanism.

import { ForgeGraph } from "./graph";
import type { ForgeAutomationEvent, ForgePreset } from "./types";

export interface RenderOptions {
  sampleRate?: number;
  blockSize?: number;
  /** Override preset.durationSec. */
  durationSec?: number;
  /** Apply a 3 ms linear fade-out at the tail to guarantee click-free splice. */
  tailFadeSec?: number;
}

export function renderPreset(preset: ForgePreset, opts: RenderOptions = {}): Float32Array {
  const sampleRate = opts.sampleRate ?? 48000;
  const blockSize = opts.blockSize ?? 128;
  const duration = opts.durationSec ?? preset.durationSec ?? 1.0;
  const totalSamples = Math.max(blockSize, Math.floor(duration * sampleRate));
  const blocks = Math.ceil(totalSamples / blockSize);
  const out = new Float32Array(totalSamples);

  const graph = new ForgeGraph({ sampleRate, blockSize });
  graph.loadPreset(preset);
  if (preset.outputNode) graph.setOutputNode(preset.outputNode);

  const events = (preset.automation ?? []).slice().sort((a, b) => a.atSec - b.atSec);
  let evIdx = 0;

  for (let b = 0; b < blocks; b++) {
    const blockStartSec = (b * blockSize) / sampleRate;
    const blockEndSec = ((b + 1) * blockSize) / sampleRate;
    while (evIdx < events.length && events[evIdx].atSec < blockEndSec) {
      const e: ForgeAutomationEvent = events[evIdx++];
      if (e.atSec >= blockStartSec) {
        graph.queueControl(e.nodeId, { param: e.param, value: e.value, rampMs: e.rampMs });
      }
    }
    const block = graph.process();
    const off = b * blockSize;
    const copyLen = Math.min(blockSize, totalSamples - off);
    out.set(block.subarray(0, copyLen), off);
  }

  graph.dispose();

  // Linear fade-OUT over the last `tailFadeSec` so any residual env tail or
  // sample-aligned discontinuity at the splice boundary is masked. The fade
  // walks back from the final sample: g=0 at out[len-1], g≈1 at start of tail.
  const tail = Math.max(0, opts.tailFadeSec ?? 0.025);
  const tailN = Math.min(out.length, Math.floor(tail * sampleRate));
  for (let i = 0; i < tailN; i++) {
    const g = i / tailN;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

/** Convenience: render a preset and wrap the result in a real AudioBuffer. */
export function renderPresetToAudioBuffer(
  ctx: BaseAudioContext,
  preset: ForgePreset,
  opts: RenderOptions = {},
): AudioBuffer {
  const sampleRate = opts.sampleRate ?? ctx.sampleRate;
  const data = renderPreset(preset, { ...opts, sampleRate });
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}
