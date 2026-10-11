import { describe, expect, it } from "vitest";
import {
  canSelectSourceMode,
  canonicalSourceForCategory,
  instrumentAuthorityForCategory,
  migratePersistedSource,
  sourceBoundaryDecision,
} from "../sourceBoundary";

const sampleDomain = ["kick", "snare", "perc", "hat", "sample"] as const;

describe("v4 sample/synth source boundary", () => {
  it("assigns sample-domain ownership to drum and sample categories", () => {
    for (const category of sampleDomain) {
      expect(instrumentAuthorityForCategory(category)).toBe("sample-domain");
      expect(canonicalSourceForCategory(category)).toBe("sample");
      expect(canSelectSourceMode(category, "sample")).toBe(true);
      expect(canSelectSourceMode(category, "synth")).toBe(false);
      expect(canSelectSourceMode(category, "hybrid")).toBe(false);
    }
  });

  it("assigns explicit synthesis ownership to synth and bass", () => {
    expect(instrumentAuthorityForCategory("synth")).toBe("synth3d");
    expect(instrumentAuthorityForCategory("bass")).toBe("bass3d");
    expect(canonicalSourceForCategory("synth")).toBe("synth");
    expect(canonicalSourceForCategory("bass")).toBe("synth");
  });

  it("marks legacy synth on a drum slot as incompatible", () => {
    expect(sourceBoundaryDecision("kick", "synth")).toEqual({
      category: "kick",
      authority: "sample-domain",
      requestedSource: "synth",
      canonicalSource: "sample",
      compatible: false,
      legacyReason: "legacy-synth-on-sample-domain",
    });
  });

  it("preserves invalid persisted source values during migration", () => {
    expect(migratePersistedSource("snare", "hybrid")).toEqual({
      source: "sample",
      legacy: {
        source: "hybrid",
        reason: "legacy-hybrid-source",
        migratedBySchema: 13,
      },
    });

    expect(migratePersistedSource("synth", "sample")).toEqual({
      source: "synth",
      legacy: {
        source: "sample",
        reason: "legacy-sample-on-synth-authority",
        migratedBySchema: 13,
      },
    });
  });

  it("does not invent legacy metadata for already canonical state", () => {
    expect(migratePersistedSource("sample", "sample")).toEqual({ source: "sample" });
    expect(migratePersistedSource("bass", "synth")).toEqual({ source: "synth" });
  });
});
