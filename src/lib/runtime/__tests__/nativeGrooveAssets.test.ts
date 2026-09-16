import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDefaultParts } from "@/lib/model";
import type { NativeGrooveAssetBridge } from "../nativeGrooveAssets";
import {
  NATIVE_GROOVE_MAX_SAMPLES,
  clearNativeGrooveAsset,
  nativeGrooveAssetReadiness,
  nativeGrooveAssetRegistry,
  nativeGrooveSampleIdForPart,
  uploadNativeGrooveAsset,
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

describe("native groove project readiness", () => {
  it("does not block projects whose sample-domain parts have no assigned sample metadata", () => {
    const parts = buildDefaultParts().map((part) => ({ ...part, sampleName: "" }));
    const readiness = nativeGrooveAssetReadiness(parts);

    expect(readiness.ready).toBe(true);
    expect(readiness.expectedSampleParts).toBe(0);
    expect(readiness.missingPartIds).toEqual([]);
  });

  it("reports assigned sample-domain parts until native registration is acknowledged", () => {
    const parts = buildDefaultParts().map((part) => ({ ...part }));
    const samplePart = parts.find((part) => part.category === "sample")!;
    samplePart.sampleName = "loop.wav";

    const before = nativeGrooveAssetReadiness(parts);
    expect(before.ready).toBe(false);
    expect(before.expectedSampleParts).toBe(1);
    expect(before.registeredSampleParts).toBe(0);
    expect(before.missingPartIds).toEqual([samplePart.id]);

    nativeGrooveAssetRegistry.markRegistered(samplePart, 48000, 24000);
    const after = nativeGrooveAssetReadiness(parts);
    expect(after.ready).toBe(true);
    expect(after.registeredSampleParts).toBe(1);
    expect(after.missingPartIds).toEqual([]);
  });
});

describe("native groove cold-load upload", () => {
  function bridge(overrides: Partial<NativeGrooveAssetBridge> = {}): NativeGrooveAssetBridge {
    return {
      canLoad: vi.fn(() => true),
      loadSample: vi.fn(() => true),
      clearSample: vi.fn(() => true),
      sampleLoaded: vi.fn(() => true),
      ...overrides,
    };
  }

  it("marks registration only after native load and loaded acknowledgement", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    const native = bridge();
    const pcm = Float32Array.from([0, 0.25, -0.25, 0]);

    const result = uploadNativeGrooveAsset(part, pcm, 48000, native);

    expect(result.accepted).toBe(true);
    expect(result.sampleId).toBe(part.id);
    expect(native.loadSample).toHaveBeenCalledWith(part.id, pcm, 48000);
    expect(native.sampleLoaded).toHaveBeenCalledWith(part.id);
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(true);
  });

  it("does not register when cold-load is unavailable because the stream is running", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    const native = bridge({ canLoad: vi.fn(() => false) });

    const result = uploadNativeGrooveAsset(part, Float32Array.from([0.1]), 48000, native);

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("stream is running");
    expect(native.loadSample).not.toHaveBeenCalled();
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(false);
  });

  it("does not register when native load succeeds but loaded acknowledgement is false", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    const native = bridge({ sampleLoaded: vi.fn(() => false) });

    const result = uploadNativeGrooveAsset(part, Float32Array.from([0.1, -0.1]), 44100, native);

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("did not acknowledge");
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(false);
  });

  it("clears both native cold asset and session registration", () => {
    const part = buildDefaultParts().find((p) => p.category === "sample")!;
    const native = bridge();
    uploadNativeGrooveAsset(part, Float32Array.from([0.1, -0.1]), 48000, native);

    expect(clearNativeGrooveAsset(part, native)).toBe(true);
    expect(native.clearSample).toHaveBeenCalledWith(part.id);
    expect(nativeGrooveAssetRegistry.isRegistered(part)).toBe(false);
  });
});
