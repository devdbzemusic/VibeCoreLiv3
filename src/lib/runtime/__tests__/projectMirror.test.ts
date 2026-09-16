import { describe, expect, it } from "vitest";
import {
  webMicroToNativeTicks,
  webRatchetToNativeExtraHits,
  webSwingToNative,
} from "../projectMirror";

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
});
