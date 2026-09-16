import { describe, expect, it } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import { useGroove } from "@/lib/store";
import {
  applyCanonicalSourceWrite,
  canonicalizeRuntimeParts,
  configureProjectPersistenceV13,
} from "../sourceRuntimeGuard";

describe("canonicalizeRuntimeParts", () => {
  it("canonicalizes legacy drum synth sources and preserves compatibility metadata", () => {
    const parts = buildDefaultParts();
    const kick = parts.find((part) => part.category === "kick")!;
    kick.source = "synth";

    const result = canonicalizeRuntimeParts(parts);
    const migratedKick = result.parts.find((part) => part.id === kick.id)! as typeof kick & {
      legacyInstrument?: { source?: { source: string; reason: string; migratedBySchema: number } };
    };

    expect(result.changed).toBe(true);
    expect(migratedKick.source).toBe("sample");
    expect(migratedKick.legacyInstrument?.source).toEqual({
      source: "synth",
      reason: "legacy-synth-on-sample-domain",
      migratedBySchema: 13,
    });
  });

  it("canonicalizes hybrid on synth authority while preserving the request", () => {
    const parts = buildDefaultParts();
    const synth = parts.find((part) => part.category === "synth")!;
    synth.source = "hybrid";

    const result = canonicalizeRuntimeParts(parts);
    const migrated = result.parts.find((part) => part.id === synth.id)! as typeof synth & {
      legacyInstrument?: { source?: { source: string; reason: string; migratedBySchema: number } };
    };

    expect(migrated.source).toBe("synth");
    expect(migrated.legacyInstrument?.source?.source).toBe("hybrid");
    expect(migrated.legacyInstrument?.source?.reason).toBe("legacy-hybrid-source");
  });

  it("is idempotent after canonicalization", () => {
    const parts = buildDefaultParts();
    const first = canonicalizeRuntimeParts(parts);
    const second = canonicalizeRuntimeParts(first.parts);

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.parts.map((part) => part.source)).toEqual(first.parts.map((part) => part.source));
  });
});

describe("applyCanonicalSourceWrite", () => {
  it("keeps an already canonical synth write unchanged", () => {
    const synth = buildDefaultParts().find((part) => part.category === "synth")!;
    const canonical = canonicalizeRuntimeParts([synth]).parts[0];
    const result = applyCanonicalSourceWrite(canonical, "synth");

    expect(result).toBe(canonical);
    expect(result.source).toBe("synth");
  });

  it("rejects hybrid as active bass source and preserves it as legacy metadata", () => {
    const bass = buildDefaultParts().find((part) => part.category === "bass")!;
    const result = applyCanonicalSourceWrite(bass, "hybrid") as typeof bass & {
      legacyInstrument?: { source?: { source: string; reason: string; migratedBySchema: number } };
    };

    expect(result.source).toBe("synth");
    expect(result.legacyInstrument?.source).toEqual({
      source: "hybrid",
      reason: "legacy-hybrid-source",
      migratedBySchema: 13,
    });
  });

  it("rejects synth as active drum source and preserves the rejected request", () => {
    const kick = buildDefaultParts().find((part) => part.category === "kick")!;
    const result = applyCanonicalSourceWrite(kick, "synth") as typeof kick & {
      legacyInstrument?: { source?: { source: string; reason: string; migratedBySchema: number } };
    };

    expect(result.source).toBe("sample");
    expect(result.legacyInstrument?.source?.source).toBe("synth");
    expect(result.legacyInstrument?.source?.reason).toBe("legacy-synth-on-sample-domain");
  });
});

describe("configureProjectPersistenceV13", () => {
  it("promotes the active Zustand persist contract to schema 13", () => {
    configureProjectPersistenceV13();
    expect(useGroove.persist.getOptions().version).toBe(13);
  });
});
