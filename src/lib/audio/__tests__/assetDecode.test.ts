import { describe, expect, it } from "vitest";
import { audioBufferToMonoPcm } from "../assetDecode";

function fakeBuffer(channels: number[][]) {
  const length = Math.max(0, ...channels.map((channel) => channel.length));
  return {
    length,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? []),
  };
}

describe("audioBufferToMonoPcm", () => {
  it("copies mono data without changing values", () => {
    const mono = audioBufferToMonoPcm(fakeBuffer([[0.25, -0.5, 1]]) as AudioBuffer);
    expect(Array.from(mono)).toEqual([0.25, -0.5, 1]);
  });

  it("averages stereo channels deterministically", () => {
    const mono = audioBufferToMonoPcm(fakeBuffer([
      [1, 0.5, -1],
      [-1, 0.5, 1],
    ]) as AudioBuffer);
    expect(Array.from(mono)).toEqual([0, 0.5, 0]);
  });

  it("averages all channels rather than silently using channel zero", () => {
    const mono = audioBufferToMonoPcm(fakeBuffer([
      [1, 1],
      [0, 0],
      [-1, 0.5],
      [0, -0.5],
    ]) as AudioBuffer);
    expect(Array.from(mono)).toEqual([0, 0.25]);
  });

  it("returns an empty payload for buffers without channels", () => {
    const mono = audioBufferToMonoPcm(fakeBuffer([]) as AudioBuffer);
    expect(mono.length).toBe(0);
  });
});
