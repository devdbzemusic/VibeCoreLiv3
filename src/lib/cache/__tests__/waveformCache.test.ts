import { describe, expect, it } from "vitest";
import {
  buildWaveformPeakPyramidFromChannels,
  estimateWaveformPyramidBytes,
  selectWaveformPeakLevel,
  waveformCacheKey,
} from "../waveformCache";

describe("waveform peak pyramid", () => {
  it("captures min/max peaks across all channels", () => {
    const left = new Float32Array([0, 0.25, -0.5, 0.1, 0.4, -0.2, 0.8, -0.1]);
    const right = new Float32Array([0, -0.75, 0.2, 0.3, -0.6, 0.1, 0.5, 0.9]);
    const pyramid = buildWaveformPeakPyramidFromChannels([left, right], 48000, {
      baseSamplesPerBin: 4,
      terminalBins: 1,
    });

    expect(pyramid.lengthFrames).toBe(8);
    expect(pyramid.channels).toBe(2);
    expect(Array.from(pyramid.levels[0].minMax)).toEqual([-0.75, 0.3, -0.6, 0.9]);
    expect(Array.from(pyramid.levels[1].minMax)).toEqual([-0.75, 0.9]);
  });

  it("selects the nearest prepared level without exceeding the target density", () => {
    const pcm = new Float32Array(1024);
    const pyramid = buildWaveformPeakPyramidFromChannels([pcm], 48000, {
      baseSamplesPerBin: 16,
      terminalBins: 1,
    });

    expect(selectWaveformPeakLevel(pyramid, 15)?.samplesPerBin).toBe(16);
    expect(selectWaveformPeakLevel(pyramid, 32)?.samplesPerBin).toBe(32);
    expect(selectWaveformPeakLevel(pyramid, 100)?.samplesPerBin).toBe(64);
  });

  it("accounts only prepared peak-array bytes", () => {
    const pcm = new Float32Array(128);
    const pyramid = buildWaveformPeakPyramidFromChannels([pcm], 44100, {
      baseSamplesPerBin: 32,
      terminalBins: 1,
    });
    const expected = pyramid.levels.reduce((sum, level) => sum + level.minMax.byteLength, 0);
    expect(estimateWaveformPyramidBytes(pyramid)).toBe(expected);
  });

  it("versions cache identity with the asset revision", () => {
    expect(waveformCacheKey("kick.wav", 1)).not.toBe(waveformCacheKey("kick.wav", 2));
  });
});
