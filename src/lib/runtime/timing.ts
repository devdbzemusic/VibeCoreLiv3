// VibeCore v4 — explicit musical timing domains.
//
// These branded numeric types intentionally prevent raw `tick: number` values
// from being treated as interchangeable across browser and native runtimes.

export type BeatPosition = number & { readonly __brand: "BeatPosition" };
export type Clock24Tick = number & { readonly __brand: "Clock24Tick" };
export type SixteenthStep = number & { readonly __brand: "SixteenthStep" };
export type NativePpq1920Tick = number & { readonly __brand: "NativePpq1920Tick" };

export const CLOCK24_TICKS_PER_BEAT = 24;
export const SIXTEENTHS_PER_BEAT = 4;
export const NATIVE_PPQ = 1920;
export const NATIVE_TICKS_PER_SIXTEENTH = NATIVE_PPQ / SIXTEENTHS_PER_BEAT; // 480

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

export function asBeatPosition(value: number): BeatPosition {
  return finite(value, "BeatPosition") as BeatPosition;
}

export function asClock24Tick(value: number): Clock24Tick {
  return finite(value, "Clock24Tick") as Clock24Tick;
}

export function asSixteenthStep(value: number): SixteenthStep {
  return finite(value, "SixteenthStep") as SixteenthStep;
}

export function asNativePpq1920Tick(value: number): NativePpq1920Tick {
  return finite(value, "NativePpq1920Tick") as NativePpq1920Tick;
}

export function beatToClock24(beat: BeatPosition): Clock24Tick {
  return asClock24Tick(beat * CLOCK24_TICKS_PER_BEAT);
}

export function clock24ToBeat(tick: Clock24Tick): BeatPosition {
  return asBeatPosition(tick / CLOCK24_TICKS_PER_BEAT);
}

export function beatToSixteenth(beat: BeatPosition): SixteenthStep {
  return asSixteenthStep(beat * SIXTEENTHS_PER_BEAT);
}

export function sixteenthToBeat(step: SixteenthStep): BeatPosition {
  return asBeatPosition(step / SIXTEENTHS_PER_BEAT);
}

export function beatToNativePpq(beat: BeatPosition): NativePpq1920Tick {
  return asNativePpq1920Tick(beat * NATIVE_PPQ);
}

export function nativePpqToBeat(tick: NativePpq1920Tick): BeatPosition {
  return asBeatPosition(tick / NATIVE_PPQ);
}

export function sixteenthToNativePpq(step: SixteenthStep): NativePpq1920Tick {
  return asNativePpq1920Tick(step * NATIVE_TICKS_PER_SIXTEENTH);
}

export function nativePpqToSixteenth(tick: NativePpq1920Tick): SixteenthStep {
  return asSixteenthStep(tick / NATIVE_TICKS_PER_SIXTEENTH);
}

export function clock24ToNativePpq(tick: Clock24Tick): NativePpq1920Tick {
  return beatToNativePpq(clock24ToBeat(tick));
}

export function nativePpqToClock24(tick: NativePpq1920Tick): Clock24Tick {
  return beatToClock24(nativePpqToBeat(tick));
}
