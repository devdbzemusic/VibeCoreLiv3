import { describe, expect, it } from "vitest";

import type { PCM } from "@/lib/audio/sampleForge";
import { analyzeRemixAudioInput } from "./remixAudioInput";

function makeClickPcm(bpm = 120, durationSec = 4, sampleRate = 44100): PCM {
  const len = Math.floor(sampleRate * durationSec);
  const ch = new Float32Array(len);
  const beatSamples = Math.round(sampleRate * 60 / bpm);
  for (let i = 0; i < len; i++) {
    const phase = i % beatSamples;
    if (phase < sampleRate * 0.01) {
      ch[i] = Math.sin(2 * Math.PI * 1200 * i / sampleRate) * Math.exp(-(phase / sampleRate) * 180) * 0.9;
    }
  }
  return { channels: [ch], sampleRate };
}

describe("remix audio input analysis", () => {
  it("summarizes tempo, key and energy from PCM input", () => {
    const analysis = analyzeRemixAudioInput(makeClickPcm(), { targetBpm: 120 });

    expect([60, 120, 240]).toContain(analysis.bpm);
    expect(analysis.durationSec).toBeCloseTo(4, 2);
    expect(analysis.keyLabel).toMatch(/^[A-G]#? (major|minor)$/);
    expect(["low", "medium", "high"]).toContain(analysis.energy);
    expect(analysis.summary).toContain("BPM");
    expect(analysis.confidence).toBeGreaterThan(0);
  });

  it("reports clipping for overloaded input", () => {
    const pcm = makeClickPcm();
    pcm.channels[0][0] = 1;
    pcm.channels[0][1] = 1;
    pcm.channels[0][2] = 1;

    const analysis = analyzeRemixAudioInput(pcm);

    expect(analysis.clipping).toBe(true);
    expect(analysis.peak).toBe(1);
  });
});
