import { describe, expect, it } from "vitest";
import {
  NATIVE_PPQ,
  NATIVE_TICKS_PER_SIXTEENTH,
  asBeatPosition,
  asClock24Tick,
  asNativePpq1920Tick,
  asSixteenthStep,
  beatToClock24,
  beatToNativePpq,
  beatToSixteenth,
  clock24ToBeat,
  clock24ToNativePpq,
  nativePpqToBeat,
  nativePpqToClock24,
  nativePpqToSixteenth,
  sixteenthToBeat,
  sixteenthToNativePpq,
} from "../timing";

describe("VibeCore timing domains", () => {
  it("keeps the documented PPQ relation", () => {
    expect(NATIVE_PPQ).toBe(1920);
    expect(NATIVE_TICKS_PER_SIXTEENTH).toBe(480);
  });

  it("maps one beat across all domains", () => {
    const beat = asBeatPosition(1);
    expect(beatToClock24(beat)).toBe(24);
    expect(beatToSixteenth(beat)).toBe(4);
    expect(beatToNativePpq(beat)).toBe(1920);
  });

  it("maps one 4/4 bar consistently", () => {
    const beat = asBeatPosition(4);
    expect(beatToClock24(beat)).toBe(96);
    expect(beatToSixteenth(beat)).toBe(16);
    expect(beatToNativePpq(beat)).toBe(7680);
  });

  it("maps sixteenths to native PPQ exactly", () => {
    expect(sixteenthToNativePpq(asSixteenthStep(0))).toBe(0);
    expect(sixteenthToNativePpq(asSixteenthStep(1))).toBe(480);
    expect(sixteenthToNativePpq(asSixteenthStep(4))).toBe(1920);
    expect(sixteenthToNativePpq(asSixteenthStep(16))).toBe(7680);
  });

  it("round-trips all explicit domains", () => {
    const beat = asBeatPosition(3.25);
    expect(clock24ToBeat(beatToClock24(beat))).toBeCloseTo(3.25);
    expect(sixteenthToBeat(beatToSixteenth(beat))).toBeCloseTo(3.25);
    expect(nativePpqToBeat(beatToNativePpq(beat))).toBeCloseTo(3.25);

    const native = asNativePpq1920Tick(6240);
    expect(nativePpqToClock24(native)).toBeCloseTo(78);
    expect(clock24ToNativePpq(asClock24Tick(78))).toBeCloseTo(6240);
    expect(nativePpqToSixteenth(native)).toBeCloseTo(13);
  });

  it("rejects non-finite timing values", () => {
    expect(() => asBeatPosition(Number.NaN)).toThrow(RangeError);
    expect(() => asClock24Tick(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => asSixteenthStep(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => asNativePpq1920Tick(Number.NaN)).toThrow(RangeError);
  });
});
