import { afterEach, describe, expect, it, vi } from "vitest";
import type { VibeCoreNativeBridge } from "@/lib/audio/AudioBackend";
import { useGroove } from "@/lib/store";
import { nativeGrooveAssetRegistry } from "../nativeGrooveAssets";
import {
  mirrorCurrentSceneToNative,
  webMicroToNativeTicks,
  webRatchetToNativeExtraHits,
  webSwingToNative,
} from "../projectMirror";

afterEach(() => {
  nativeGrooveAssetRegistry.clearSession();
});

function makeNative(): VibeCoreNativeBridge {
  return {
    isAvailable: vi.fn(() => true),
    grooveSetTrackMode: vi.fn(),
    grooveSetTrackMute: vi.fn(),
    grooveSetTrackSolo: vi.fn(),
    grooveSetTrackVolume: vi.fn(),
    grooveSetTrackSample: vi.fn(),
    grooveClearPattern: vi.fn(),
    grooveSetPatternLength: vi.fn(),
    grooveSetSwing: vi.fn(),
    grooveSetStep: vi.fn(),
    grooveSetStepProbability: vi.fn(),
    grooveSetStepAccent: vi.fn(),
    grooveSetStepRoll: vi.fn(),
    grooveSetStepMicroTiming: vi.fn(),
    grooveClearPianoRoll: vi.fn(),
    grooveAddPianoRollNote: vi.fn(),
  } as unknown as VibeCoreNativeBridge;
}

describe("native project mirror conversions", () => {
  it("maps web centered swing to native delay swing", () => {
    expect(webSwingToNative(50)).toBe(0);
    expect(webSwingToNative(54)).toBe(8);
    expect(webSwingToNative(75)).toBe(50);
    expect(webSwingToNative(100)).toBe(100);
    expect(webSwingToNative(40)).toBe(0);
  });

  it("maps total ratchet hits to native extra hits", () => {
    expect(webRatchetToNativeExtraHits(1)).toBe(0);
    expect(webRatchetToNativeExtraHits(2)).toBe(1);
    expect(webRatchetToNativeExtraHits(8)).toBe(7);
    expect(webRatchetToNativeExtraHits(99)).toBe(8);
  });

  it("maps web micro timing to PPQ ticks", () => {
    expect(webMicroToNativeTicks(-50)).toBe(-120);
    expect(webMicroToNativeTicks(0)).toBe(0);
    expect(webMicroToNativeTicks(25)).toBe(60);
    expect(webMicroToNativeTicks(50)).toBe(120);
  });

  it("mirrors the current scene through the declared Groove bridge surface", () => {
    const native = makeNative();
    const state = useGroove.getState();
    const report = mirrorCurrentSceneToNative(state, native);
    const expectedTracks = Math.min(16, state.parts.length);

    expect(report.mirroredTracks).toBe(expectedTracks);
    expect(native.grooveSetTrackMode).toHaveBeenCalledTimes(expectedTracks);
    expect(native.grooveSetTrackSample).toHaveBeenCalledTimes(expectedTracks);
    expect(native.grooveClearPattern).toHaveBeenCalledTimes(expectedTracks);
    expect(native.grooveSetPatternLength).toHaveBeenCalledTimes(expectedTracks);
    expect(native.grooveClearPianoRoll).toHaveBeenCalledTimes(expectedTracks);
  });

  it("uses -1 until a sample-domain asset is actually registered in Native Groove", () => {
    const native = makeNative();
    const state = useGroove.getState();
    const samplePart = state.parts.find((part) => part.category === "sample")!;

    mirrorCurrentSceneToNative(state, native);
    expect(native.grooveSetTrackSample).toHaveBeenCalledWith(samplePart.id, -1);

    vi.mocked(native.grooveSetTrackSample).mockClear();
    nativeGrooveAssetRegistry.markRegistered(samplePart, 48000, 4800);
    const report = mirrorCurrentSceneToNative(state, native);

    expect(native.grooveSetTrackSample).toHaveBeenCalledWith(samplePart.id, samplePart.id);
    expect(report.assignedSamples).toBeGreaterThanOrEqual(1);
  });

  it("clears sample assignment for synth/bass authority tracks", () => {
    const native = makeNative();
    const state = useGroove.getState();
    const bass = state.parts.find((part) => part.category === "bass")!;
    const synth = state.parts.find((part) => part.category === "synth")!;

    mirrorCurrentSceneToNative(state, native);

    expect(native.grooveSetTrackSample).toHaveBeenCalledWith(bass.id, -1);
    expect(native.grooveSetTrackSample).toHaveBeenCalledWith(synth.id, -1);
  });

  it("returns a diagnostic warning instead of mutating when the bridge is unavailable", () => {
    const native = {
      isAvailable: vi.fn(() => false),
    } as unknown as VibeCoreNativeBridge;

    const report = mirrorCurrentSceneToNative(useGroove.getState(), native);

    expect(report.mirroredTracks).toBe(0);
    expect(report.warnings).toContain("native bridge unavailable");
  });
});
