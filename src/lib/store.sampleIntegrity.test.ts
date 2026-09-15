import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildDefaultParts } from "./model";

const memoryStorage = () => {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: vi.fn(() => {
      store = {};
    }),
    getItem: vi.fn((key: string) => store[key] ?? null),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
  };
};

describe("store sample slot integrity", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const { useGroove } = await import("./store");
    useGroove.setState({ parts: buildDefaultParts() });
  });

  it("normalizes explicit sample category slots back to sample source", async () => {
    const { useGroove } = await import("./store");

    useGroove.getState().setPartSource(10, "synth");
    expect(useGroove.getState().parts[10].source).toBe("sample");

    useGroove.getState().setPartSource(10, "hybrid");
    expect(useGroove.getState().parts[10].source).toBe("sample");
  });

  it("ignores synth mutations for explicit sample category slots", async () => {
    const { useGroove } = await import("./store");
    const before = useGroove.getState().parts[10].synth;

    useGroove.getState().setSynthEngine(10, "3D");
    useGroove.getState().setSynthParam(10, "morph", 99);
    useGroove.getState().setSynth3D(10, { spatial: { mode: "3d", width: 2, azimuth: 15, elevation: 5, distance: 0.4, rotation: 0.1, enabled: true } });
    useGroove.getState().setBass3D(10, { sub: { type: "sine", octave: -1, semitone: 0, fine: 0, level: 0.9, pan: 0, phase: 0, wavetable: [1], enabled: true } });
    useGroove.getState().setHybridParam(10, { sampleMix: 12 });

    const after = useGroove.getState().parts[10];
    expect(after.synth).toEqual(before);
    expect(after.synth3d).toBeUndefined();
    expect(after.bass3d).toBeUndefined();
    expect(after.hybrid.sampleMix).toBe(80);
  });

  it("preserves existing synth mutations for non-sample categories", async () => {
    const { useGroove } = await import("./store");

    useGroove.getState().setSynthEngine(8, "3D");
    useGroove.getState().setSynthParam(8, "morph", 99);

    const synthPart = useGroove.getState().parts[8];
    expect(synthPart.synth.engine).toBe("3D");
    expect(synthPart.synth.morph).toBe(99);
  });
});
