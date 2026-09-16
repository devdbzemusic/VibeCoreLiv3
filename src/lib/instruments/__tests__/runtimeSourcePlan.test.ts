import { describe, expect, it } from "vitest";
import { runtimeSourcePlanForPart } from "../runtimeSourcePlan";

describe("v4 runtime source plan", () => {
  it("routes drum/sample-domain categories to the sample renderer even with legacy synth state", () => {
    const plan = runtimeSourcePlanForPart({ category: "kick", source: "synth" } as any);
    expect(plan.renderer).toBe("sample");
    expect(plan.authority).toBe("sample-domain");
    expect(plan.legacyCompatibility).toBe(true);
    expect(plan.warning).toContain("Legacy source synth ignored");
  });

  it("routes synth category to 3D Synth regardless of legacy sample state", () => {
    const plan = runtimeSourcePlanForPart({ category: "synth", source: "sample" } as any);
    expect(plan.renderer).toBe("synth3d");
    expect(plan.canonicalSource).toBe("synth");
    expect(plan.legacyCompatibility).toBe(true);
  });

  it("routes bass category to 3D Bass", () => {
    const plan = runtimeSourcePlanForPart({ category: "bass", source: "synth" } as any);
    expect(plan.renderer).toBe("bass3d");
    expect(plan.legacyCompatibility).toBe(false);
    expect(plan.warning).toBeUndefined();
  });

  it("does not re-enable hybrid rendering", () => {
    const plan = runtimeSourcePlanForPart({ category: "sample", source: "hybrid" } as any);
    expect(plan.renderer).toBe("sample");
    expect(plan.legacyCompatibility).toBe(true);
  });
});
