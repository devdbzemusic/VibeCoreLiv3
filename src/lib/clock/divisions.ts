// Division → seconds helpers. Phase-stable: callers anchor to a known
// bar-start audioTime and derive division boundaries by integer math
// against that anchor, never by accumulation.

import type { Division } from "./types";

/** Beats per division (relative to a quarter-note = 1 beat). */
export function divisionBeats(div: Division): number {
  switch (div) {
    case "1/64": return 1 / 16;
    case "1/32": return 1 / 8;
    case "1/16": return 1 / 4;
    case "1/8":  return 1 / 2;
    case "1/4":  return 1;
    case "1/2":  return 2;
    case "1":    return 4;
    case "2":    return 8;
    case "4":    return 16;
    case "8":    return 32;
  }
}

/** Seconds for one division at the given BPM (quarter-note = 60/bpm). */
export function divisionSeconds(div: Division, bpm: number): number {
  const safeBpm = Math.max(1, bpm);
  return (60 / safeBpm) * divisionBeats(div);
}

/** Frequency (Hz) of a division's rate at the given BPM. */
export function divisionHz(div: Division, bpm: number): number {
  return 1 / divisionSeconds(div, bpm);
}

/**
 * Next absolute audio time at which the given division boundary occurs,
 * anchored against `barAnchorTime` (audio-time of bar 0). Phase-stable.
 */
export function nextDivisionTime(
  div: Division,
  bpm: number,
  fromAudioTime: number,
  barAnchorTime: number,
): number {
  const step = divisionSeconds(div, bpm);
  if (step <= 0) return fromAudioTime;
  const elapsed = fromAudioTime - barAnchorTime;
  const n = Math.ceil(elapsed / step);
  return barAnchorTime + n * step;
}

/** Steps (16th-notes) per quantise boundary for a VibeCore Sync quantise
 *  grid. Used by the scheduler to apply queued pattern switches and seeks
 *  only on grid boundaries (Band 4 §6.1 — quantised transitions).
 *  `1` = one scene (bar); `off`/undefined = every step (immediate). */
export function quantizeStepsForGrid(
  grid: "off" | "1/16" | "1/8" | "1/4" | "1" | undefined,
  sceneLen: number,
): number {
  switch (grid) {
    case "1/16": return 1;
    case "1/8": return 2;
    case "1/4": return 4;
    case "1": return Math.max(1, Math.floor(sceneLen));
    case "off": default: return 1;
  }
}