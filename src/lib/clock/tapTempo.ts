// VibeCore Tap-Tempo (Phase 2 — Sync).
//
// Pure helper: accumulates tap timestamps (performance.now), derives a stable
// BPM from the median of recent inter-tap intervals, and clamps to the
// platform tempo range. Stateful but self-contained — callers just invoke
// `tapTempo()` on each tap and feed the result into the store (`setBpm`),
// which the internal clock source propagates to MasterClock. No clock
// authority lives here; the store remains the single tempo source.

const WINDOW_MS = 2000;   // taps older than this expire
const MIN_TAPS = 2;
const MAX_TAPS = 8;
const MIN_BPM = 40;
const MAX_BPM = 240;

const taps: number[] = [];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Register a tap. Returns the estimated BPM once enough taps have been
 * collected (≥2), otherwise null. Callers should ignore null and keep
 * tapping — the estimate stabilises within a few taps.
 */
export function tapTempo(now: number = performance.now()): number | null {
  // Drop taps outside the timing window (user paused tapping).
  while (taps.length && now - taps[0] > WINDOW_MS) taps.shift();
  taps.push(now);
  if (taps.length > MAX_TAPS) taps.shift();
  if (taps.length < MIN_TAPS) return null;

  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
  const med = median(intervals);
  if (!med || med <= 0) return null;

  let bpm = 60000 / med;
  bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm * 10) / 10));
  return bpm;
}

/** Clear the tap history (e.g. when leaving the tap context). */
export function resetTap(): void {
  taps.length = 0;
}