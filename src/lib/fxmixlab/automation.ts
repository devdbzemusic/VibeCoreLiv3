// VibeCore FX Mix Lab — Automation Engine.
//
// Sample-accurate parameter automation synchronised with VibeCore Sync.
// Reads the global transport position (songTicks) and applies parameter
// changes to AudioParams via setTargetAtTime — sample-accurate via
// AudioContext.currentTime.
//
// Realtime-safe: the scheduler uses a look-ahead window (same pattern as
// the existing Groove scheduler). No per-sample allocation, no locks, no
// promise chains. All automation data is pre-parsed into a flat sorted
// array for O(log n) binary search.

import type { AutomationLane, AutomationPoint } from "./types";

// ── Automation Data Model ─────────────────────────────────────────────────────

/** Sort automation points by songTicks. Mutates a copy, not the original. */
export function sortLanePoints(lane: AutomationLane): AutomationLane {
  return {
    ...lane,
    points: [...lane.points].sort((a, b) => a.songTicks - b.songTicks),
  };
}

/** Interpolate a value at a given songTicks position using the lane's
 *  curve type. Pure function — no side effects. */
export function interpolateValue(lane: AutomationLane, songTicks: number): number {
  if (!lane.enabled || lane.points.length === 0) return 0;
  const pts = lane.points;
  if (songTicks <= pts[0].songTicks) return pts[0].value;
  if (songTicks >= pts[pts.length - 1].songTicks) return pts[pts.length - 1].value;

  // Binary search for the surrounding points
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].songTicks <= songTicks) lo = mid;
    else hi = mid;
  }

  const p0 = pts[lo], p1 = pts[hi];
  const span = p1.songTicks - p0.songTicks;
  if (span <= 0) return p0.value;
  const t = (songTicks - p0.songTicks) / span;

  switch (p0.curve) {
    case "step": return p0.value;
    case "snh":  return p0.value; // sample & hold — same as step for interpolation
    case "exp": return p0.value + (p1.value - p0.value) * (t * t);
    case "log": return p0.value + (p1.value - p0.value) * (1 - Math.pow(1 - t, 2));
    case "lin":
    default:    return p0.value + (p1.value - p0.value) * t;
  }
}

// ── Automation Scheduler ──────────────────────────────────────────────────────

export interface AutomationBinding {
  lane: AutomationLane;
  /** Apply the interpolated value to the target AudioParam at `when` (audio time). */
  apply: (value: number, when: number) => void;
}

export interface AutomationScheduler {
  bindings: AutomationBinding[];
  /** Look-ahead window in seconds (same as Groove scheduler). */
  lookAheadSec: number;
  /** Last processed songTicks (for incremental scheduling). */
  lastSongTicks: number;
  /** Start the scheduler. Called once on transport start. */
  start: (startSongTicks: number) => void;
  /** Stop the scheduler. Called on transport stop. */
  stop: () => void;
  /** Update the BPM-derived tick rate. Called when BPM changes. */
  setBpm?: (bpm: number) => void;
  /** Tick — called from the existing scheduler loop at ~20 Hz. */
  tick: (currentSongTicks: number, audioTime: number) => void;
}

/** Create an automation scheduler for a set of bindings. */
export function createAutomationScheduler(
  bindings: AutomationBinding[],
  lookAheadSec = 0.1,
): AutomationScheduler {
  let running = false;
  let lastSongTicks = 0;

  // Song ticks per second — derived from BPM (16th notes at 4/4).
  // Updated on each tick from the current BPM to avoid drift when tempo changes.
  let ticksPerSec = (124 * 4) / 60;

  const tick = (currentSongTicks: number, audioTime: number) => {
    if (!running) return;
    const lookAheadTicks = ticksPerSec * lookAheadSec;
    const targetTicks = currentSongTicks + lookAheadTicks;

    for (const binding of bindings) {
      if (!binding.lane.enabled) continue;
      const value = interpolateValue(binding.lane, targetTicks);
      binding.apply(value, audioTime + lookAheadSec);
    }
    lastSongTicks = currentSongTicks;
  };

  return {
    bindings,
    lookAheadSec,
    lastSongTicks: 0,
    start: (startSongTicks) => {
      running = true;
      lastSongTicks = startSongTicks;
    },
    stop: () => {
      running = false;
    },
    /** Update the BPM-derived tick rate. Called when BPM changes. */
    setBpm: (bpm: number) => {
      ticksPerSec = (Math.max(40, Math.min(240, bpm)) * 4) / 60;
    },
    tick,
  };
}

// ── Helper: add/remove points ─────────────────────────────────────────────────

export function addPoint(lane: AutomationLane, point: AutomationPoint): AutomationLane {
  return sortLanePoints({ ...lane, points: [...lane.points, point] });
}

export function removePoint(lane: AutomationLane, songTicks: number, tolerance = 0.5): AutomationLane {
  return {
    ...lane,
    points: lane.points.filter((p) => Math.abs(p.songTicks - songTicks) > tolerance),
  };
}

export function clearLane(lane: AutomationLane): AutomationLane {
  return { ...lane, points: [] };
}

// ── Helper: convert songTicks to audio time ────────────────────────────────────

/** Convert songTicks to AudioContext time given a start offset. */
export function ticksToAudioTime(
  songTicks: number,
  startSongTicks: number,
  startAudioTime: number,
  bpm: number,
): number {
  const ticksPerSec = (bpm * 4) / 60; // 16th notes
  const deltaTicks = songTicks - startSongTicks;
  return startAudioTime + deltaTicks / ticksPerSec;
}