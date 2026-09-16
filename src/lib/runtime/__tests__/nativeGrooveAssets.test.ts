import { afterEach, describe, expect, it } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import {
  NATIVE_GROOVE_MAX_SAMPLES,
  nativeGrooveAssetRegistry,
  nativeGrooveSampleIdForPart,
} from "../nativeGrooveAssets";

afterEach(() => nativeGrooveAssetRegistry.clearSession());

describe("native groove asset ids", () => {
  it("uses Part.id for sample-domain parts", () => {
    const parts = buildDefaultParts();
    for (const part of parts.filter((p) => !["bass", "synth"].includes(p.category))) {
      expect(nativeGrooveSampleIdForPart(part)).toBe(part.id);
    }
  });

  it("does not assign sample ids to synth or bass authority", () => {
    const parts = buildDefaultParts();
    expect(nativeGrooveSampleIdForPart(parts.find((p) => p.category === "bass")!)).toBeNull();
    expect(nativeGrooveSampleIdForPart(parts.find((p) => p.category === "synth")!)).toBeNull();
  });

  it("rejects ids outside native kMaxSamples", () => {
    expect(nativeGrooveSampleIdForPart({ id: NATIVE_GROOVE_MAX_SAMPLES, category: "sample" })).toBeNull();
  });
});

describe("native groove asset registry", () => {
  it("does not claim registration before successful upload acknowledgement", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(false);
  });

  it("records only valid registrations and clears session truth", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    expect(nativeGrooveAssetRegistry.markRegistered(part, 48000, 0)).toBeNull();
    const registration = nativeGrooveAssetRegistry.markRegistered(part, 48000, 24000);
    expect(registration?.sampleId).toBe(part.id);
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(true);
    nativeGrooveAssetRegistry.clearSession();
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(false);
  });
});
