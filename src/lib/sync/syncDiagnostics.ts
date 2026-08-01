// VibeCore Sync — diagnostics: long-term drift + transport consistency.
//
// Extends the AudioWorklet probe metrics (audioClockProbe) with a long-running
// snapshot and a transport-consistency metric: the regularity of the scheduled
// step grid (stddev of inter-event intervals vs mean). A consistent grid
// (transportConsistency01 → 1) means the scheduler is advancing the playhead
// uniformly — the core timing contract of VibeCore Sync (Band 4 §6.1 / §8.2).
//
// Realtime-neutral: reads probe state + MasterClock only; never touches DSP.

import { getProbeStats, exportRawEvents, getEventSummary } from "@/lib/audio/audioClockProbe";

export interface SyncDiagnosticsReport {
  durationMs: number;
  jitterMs: number;
  driftMsPerMin: number;
  stability01: number;
  lateTicks: number;
  xruns: number;
  eventCount: number;
  classification: "GOOD" | "WARNING" | "CRITICAL" | "NO_DATA";
  /** 0..1 — fraction of consecutive scheduled events whose inter-event
   *  interval is within 1 ms of the local mean (grid regularity). */
  transportConsistency01: number;
}

/** Snapshot the current sync/timing diagnostics. `durationMs` is nominal —
 *  the metrics are sampled from the probe ring buffer (up to 10 000 events)
 *  and the long-term drift is the regression slope already maintained by
 *  the probe. Pass a larger `durationMs` only to label long runs. */
export function snapshotSyncDiagnostics(durationMs = 2000): SyncDiagnosticsReport {
  const s = getProbeStats();
  const sum = getEventSummary();

  // Transport consistency: regularity of the scheduled grid.
  let consistentFrac = 0;
  const ev = exportRawEvents(500);
  if (ev.length > 4) {
    const intervals: number[] = [];
    for (let i = 1; i < ev.length; i++) {
      intervals.push(ev[i].scheduledFor - ev[i - 1].scheduledFor);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let onGrid = 0;
    for (const iv of intervals) if (Math.abs(iv - mean) < 0.001) onGrid++; // 1 ms tolerance
    consistentFrac = onGrid / intervals.length;
  }

  return {
    durationMs,
    jitterMs: s.jitterMs,
    driftMsPerMin: s.driftMsPerMin,
    stability01: s.stability01,
    lateTicks: s.lateTicks,
    xruns: s.xruns,
    eventCount: s.eventCount,
    classification: sum.classification,
    transportConsistency01: consistentFrac,
  };
}