import { afterEach, describe, expect, it } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import { useGroove } from "@/lib/store";
import { inferPerformanceInstrument } from "../performanceInput";

const originalParts = useGroove.getState().parts;

afterEach(() => {
  useGroove.setState({ parts: originalParts });
});

describe("inferPerformanceInstrument", () => {
  it("routes bass category to bass3d even when a legacy synth-engine string disagrees", () => {
    const parts = buildDefaultParts();
    const bass = parts.find((part) => part.category === "bass")!;
    bass.synth = { ...bass.synth, engine: "Kick" };
    useGroove.setState({ parts });

    expect(inferPerformanceInstrument(bass.id)).toBe("bass3d");
  });

  it("routes synth category to synth3d independently of the legacy engine selector", () => {
    const parts = buildDefaultParts();
    const synth = parts.find((part) => part.category === "synth")!;
    synth.synth = { ...synth.synth, engine: "Snare" };
    useGroove.setState({ parts });

    expect(inferPerformanceInstrument(synth.id)).toBe("synth3d");
  });

  it("does not promote sample-domain parts to an instrument renderer", () => {
    const parts = buildDefaultParts();
    const sample = parts.find((part) => part.category === "sample")!;
    sample.synth = { ...sample.synth, engine: "3D" };
    useGroove.setState({ parts });

    expect(inferPerformanceInstrument(sample.id)).toBe("part");
  });
});
