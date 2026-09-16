import { describe, expect, it } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import { canonicalizeRuntimeParts } from "../sourceRuntimeGuard";

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
