import { describe, expect, it } from "vitest";
import { sourceUiPolicyForPart } from "../sourceUiPolicy";

describe("v4 source UI policy", () => {
  it("shows only Sample for drum/sample-domain parts", () => {
    const policy = sourceUiPolicyForPart({ category: "kick", source: "sample" } as any);
    expect(policy.authority).toBe("sample-domain");
    expect(policy.canonicalSource).toBe("sample");
    expect(policy.options.filter((o) => o.visible).map((o) => o.source)).toEqual(["sample"]);
    expect(policy.showHybridEditor).toBe(false);
  });

  it("shows only 3D Synth authority for synth parts", () => {
    const policy = sourceUiPolicyForPart({ category: "synth", source: "synth" } as any);
    expect(policy.authority).toBe("synth3d");
    expect(policy.options.filter((o) => o.visible).map((o) => o.source)).toEqual(["synth"]);
    expect(policy.options.find((o) => o.source === "synth")?.label).toBe("3D Synth");
  });

  it("shows only 3D Bass authority for bass parts", () => {
    const policy = sourceUiPolicyForPart({ category: "bass", source: "synth" } as any);
    expect(policy.authority).toBe("bass3d");
    expect(policy.options.find((o) => o.source === "synth")?.label).toBe("3D Bass");
  });

  it("surfaces legacy source as notice without re-enabling invalid source buttons", () => {
    const policy = sourceUiPolicyForPart({
      category: "kick",
      source: "sample",
      legacyInstrument: {
        source: {
          source: "hybrid",
          reason: "legacy-hybrid-source",
          migratedBySchema: 13,
        },
      },
    } as any);

    expect(policy.legacyNotice).toContain("Legacy hybrid source preserved");
    expect(policy.options.find((o) => o.source === "hybrid")?.enabled).toBe(false);
    expect(policy.showHybridEditor).toBe(false);
  });
});
