import { describe, expect, it } from "vitest";

import {
  allowedSourcesForCategory,
  canUseHybridForCategory,
  canUseSynthForCategory,
  normalizeSourceForCategory,
} from "./model";

describe("sample slot integrity model helpers", () => {
  it("keeps explicit sample category slots sample-only", () => {
    expect(allowedSourcesForCategory("sample")).toEqual(["sample"]);
    expect(normalizeSourceForCategory("sample", "synth")).toBe("sample");
    expect(normalizeSourceForCategory("sample", "hybrid")).toBe("sample");
  });

  it("allows existing non-sample sound paths while the wider slot model is migrated", () => {
    expect(allowedSourcesForCategory("kick")).toEqual(["sample", "synth", "hybrid"]);
    expect(normalizeSourceForCategory("synth", "hybrid")).toBe("hybrid");
  });

  it("blocks synth and hybrid editors for explicit sample category slots", () => {
    expect(canUseSynthForCategory("sample")).toBe(false);
    expect(canUseHybridForCategory("sample")).toBe(false);
    expect(canUseSynthForCategory("bass")).toBe(true);
    expect(canUseHybridForCategory("bass")).toBe(true);
  });
});
