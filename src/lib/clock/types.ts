// VibeCore — MasterClock types.
// Phase 3 foundation: all timing-aware modules read from a single clock.
// Additive only — existing modules keep working until they opt in.

export type ClockSource = "internal" | "midi" | "link" | "adaptive" | "hybrid";

/** Musical divisions supported by sync-aware modulators. */
export type Division =
  | "1/64" | "1/32" | "1/16" | "1/8"
  | "1/4"  | "1/2"
  | "1"    | "2"    | "4"    | "8"; // bars

export const ALL_DIVISIONS: Division[] = [
  "1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "1", "2", "4", "8",
];

export interface ClockState {
  /** Tempo in BPM (quarter-note). */
  bpm: number;
  /** Beats per bar (default 4). */
  beatsPerBar: number;
  /** Absolute beat position since transport start (fractional). */
  beat: number;
  /** Absolute bar position (fractional). */
  bar: number;
  /** 24 PPQ tick position (fractional). */
  tick: number;
  /** Song position in seconds since transport start. */
  songPos: number;
  /** Phase within current bar, 0..1. */
  phase01: number;
  /** AudioContext.currentTime snapshot for this state. */
  audioTime: number;
  /** Current clock source. */
  source: ClockSource;
  /** Confidence of external source, 0..1. 1 for internal. */
  confidence: number;
}

export type ClockSubscriber = (state: ClockState) => void;
