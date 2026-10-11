import { describe, expect, it } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import { useGroove } from "@/lib/store";
import {
  applyCanonicalEngineWrite,
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

  it("promotes legacy default Synth/Bass engines to the canonical 3D renderers", () => {
    const result = canonicalizeRuntimeParts(buildDefaultParts());
    const synths = result.parts.filter((part) => part.category === "synth");
    const basses = result.parts.filter((part) => part.category === "bass");

    expect(result.changed).toBe(true);
    expect(synths.every((part) => part.source === "synth" && part.synth.engine === "3D")).toBe(true);
    expect(basses.every((part) => part.source === "synth" && part.synth.engine === "3D Bass")).toBe(true);
    expect(synths.every((part) => (part as any).legacyInstrument?.engine?.engine === "Synth")).toBe(true);
    expect(basses.every((part) => (part as any).legacyInstrument?.engine?.engine === "Bass")).toBe(true);
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
    expect(migrated.synth.engine).toBe("3D");
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
    expect(second.parts.map((part) => part.synth.engine)).toEqual(first.parts.map((part) => part.synth.engine));
  });
});

describe("applyCanonicalSourceWrite", () => {
  it("keeps an already canonical synth write unchanged", () => {
    const synth = buildDefaultParts().find((part) => part.category === "synth")!;
    const canonical = canonicalizeRuntimeParts([synth]).parts[0];
    const result = applyCanonicalSourceWrite(canonical, "synth");

    expect(result).toBe(canonical);
    expect(result.source).toBe("synth");
    expect(result.synth.engine).toBe("3D");
  });

  it("rejects hybrid as active bass source and preserves it as legacy metadata", () => {
    const bass = buildDefaultParts().find((part) => part.category === "bass")!;
    const result = applyCanonicalSourceWrite(bass, "hybrid") as typeof bass & {
      legacyInstrument?: { source?: { source: string; reason: string; migratedBySchema: number } };
    };

    expect(result.source).toBe("synth");
    expect(result.synth.engine).toBe("3D Bass");
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

describe("applyCanonicalEngineWrite", () => {
  it("keeps canonical 3D Synth engine unchanged", () => {
    const synth = canonicalizeRuntimeParts([
      buildDefaultParts().find((part) => part.category === "synth")!,
    ]).parts[0];

    const result = applyCanonicalEngineWrite(synth, "3D");
    expect(result).toBe(synth);
    expect(result.synth.engine).toBe("3D");
  });

  it("rejects legacy Synth engine and keeps it in compatibility metadata", () => {
    const synth = canonicalizeRuntimeParts([
      buildDefaultParts().find((part) => part.category === "synth")!,
    ]).parts[0];
    const result = applyCanonicalEngineWrite(synth, "Synth") as typeof synth & {
      legacyInstrument?: { engine?: { engine: string; reason: string; migratedBySchema: number } };
    };

    expect(result.synth.engine).toBe("3D");
    expect(result.legacyInstrument?.engine).toEqual({
      engine: "Synth",
      reason: "legacy-noncanonical-synth-engine",
      migratedBySchema: 13,
    });
  });

  it("rejects legacy Bass engine and keeps 3D Bass active", () => {
    const bass = canonicalizeRuntimeParts([
      buildDefaultParts().find((part) => part.category === "bass")!,
    ]).parts[0];
    const result = applyCanonicalEngineWrite(bass, "Bass") as typeof bass & {
      legacyInstrument?: { engine?: { engine: string; reason: string; migratedBySchema: number } };
    };

    expect(result.synth.engine).toBe("3D Bass");
    expect(result.legacyInstrument?.engine?.engine).toBe("Bass");
    expect(result.legacyInstrument?.engine?.reason).toBe("legacy-noncanonical-bass-engine");
  });

  it("does not introduce a synth renderer on sample-domain parts", () => {
    const kick = canonicalizeRuntimeParts([
      buildDefaultParts().find((part) => part.category === "kick")!,
    ]).parts[0];

    const result = applyCanonicalEngineWrite(kick, "3D");
    expect(result).toBe(kick);
  });
});

describe("configureProjectPersistenceV13", () => {
  it("promotes the active Zustand persist contract to schema 13", () => {
    configureProjectPersistenceV13();
    expect(useGroove.persist.getOptions().version).toBe(13);
  });
});
