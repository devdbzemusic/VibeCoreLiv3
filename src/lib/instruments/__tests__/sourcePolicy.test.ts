import { describe, expect, it } from "vitest";
import { canonicalizeNewPart, canonicalizeNewParts, resolveSourceWrite } from "../sourcePolicy";

const basePart = {
  id: 0,
  name: "X",
  category: "kick",
  color: "part-kick",
  volume: 78,
  pan: 0,
  pitch: 0,
  mute: false,
  solo: false,
  sends: [0, 0, 0, 0, 0, 0],
  sampleName: null,
  channel: {} as any,
  source: "synth",
  wave: {} as any,
  synth: {} as any,
  hybrid: {} as any,
} as any;

describe("v4 source write policy", () => {
  it("rejects synth on a sample-domain drum and returns the canonical source", () => {
    const result = resolveSourceWrite(basePart, "synth");
    expect(result.accepted).toBe(false);
    expect(result.source).toBe("sample");
    expect(result.decision.legacyReason).toBe("legacy-synth-on-sample-domain");
  });

  it("accepts synth for Synth authority", () => {
    const result = resolveSourceWrite({ category: "synth", source: "synth" } as any, "synth");
    expect(result.accepted).toBe(true);
    expect(result.source).toBe("synth");
  });

  it("rejects hybrid as a new source mode", () => {
    const result = resolveSourceWrite({ category: "bass", source: "synth" } as any, "hybrid");
    expect(result.accepted).toBe(false);
    expect(result.source).toBe("synth");
  });

  it("canonicalizes new drum defaults to sample without altering other fields", () => {
    const canonical = canonicalizeNewPart(basePart);
    expect(canonical).not.toBe(basePart);
    expect(canonical.source).toBe("sample");
    expect(canonical.name).toBe(basePart.name);
  });

  it("preserves identity when a new part is already canonical", () => {
    const canonical = { ...basePart, source: "sample" };
    expect(canonicalizeNewPart(canonical)).toBe(canonical);
  });

  it("returns the same array when all new parts are canonical", () => {
    const parts = [{ ...basePart, source: "sample" }];
    expect(canonicalizeNewParts(parts as any)).toBe(parts);
  });
});
