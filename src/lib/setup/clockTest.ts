// VibeCoreLiv3 — Clock stability / jitter probe (Sprint 6A + Diagnostics Fix).
//
// =============================================================================
// METRIC DEFINITIONS (audio-synchronous mode, current implementation)
// =============================================================================
//
//   Reference clock : AudioContext.currentTime (hardware-derived, monotonic
//                     in audio frames). This replaces the previous
//                     performance.now() / setTimeout approach which is
//                     completely unreliable on Android (page-throttled,
//                     coarsened, and unrelated to audio I/O timing).
//
//   Event           : a single scheduler tick. The scheduler captures
//                     ( scheduledAt = ctx.currentTime when tick was queued,
//                       scheduledFor = the audio time the tick is intended
//                                      to fire at = nextTickTime + offset ).
//                     An off-graph ScriptProcessorNode (connected only to an
//                     AnalyserNode, never to destination) observes
//                     ctx.currentTime in its onaudioprocess callback. The
//                     first callback whose currentTime ≥ scheduledFor records
//                     observedAt and delta = (observedAt − scheduledFor)*1000.
//
//   JITTER (ms)     : stddev(delta) across the most recent N events
//                     (N ≤ 500).
//                     jitter = sqrt( Σ (delta_i − mean)² / N )
//                     Reflects how consistently the audio callback observes
//                     the scheduler's intended tick times.
//
//   DRIFT (ms/min)  : linear-regression slope b of delta vs scheduledFor,
//                     converted to ms per minute.
//                     b = (N·Σxy − Σx·Σy) / (N·Σx² − (Σx)²),  x in seconds
//                     drift = b * 60
//                     Detects systemic monotonic timing skew (e.g. clock
//                     source mismatch).
//
//   STABILITY (%)   : 100 * (#events with |delta| < 1 ms) / N.
//                     A "stable" tick is one whose audio-callback observation
//                     fell within ±1 ms of its scheduled audio time.
//
//   LATE TICKS      : count of events whose scheduledFor < scheduledAt, i.e.
//                     the scheduler asked the audio backend to play a tick
//                     whose time had already passed when it was queued
//                     (impossible to fire on time → always perceptibly late).
//
//   CB LAT (ms)     : (ctx.baseLatency + ctx.outputLatency) * 1000.
//                     Reported directly by the AudioContext; NOT measured
//                     manually. baseLatency = double-buffering latency the
//                     UA adds for processing. outputLatency = end-to-end
//                     latency to the audio sink (often 0 on Chromium/Android).
//
//   ROUNDTRIP       : N/A unless a hardware loopback is wired.
//
// =============================================================================

import type { ClockReport } from "./setupStore";
import { ensureAudio } from "@/lib/audio/engine";
import {
  installProbe, resetProbe, getProbeStats, recordScheduledTick,
} from "@/lib/audio/audioClockProbe";
import { masterClock } from "@/lib/clock/masterClock";

/** Pretty-print the formulas above to the dev console so that what the UI
 *  shows matches what the test claims to measure. */
export function logClockTestFormulas(): void {
  // eslint-disable-next-line no-console
  console.groupCollapsed("[ClockTest] metric formulas (audio-synchronous)");
  // eslint-disable-next-line no-console
  console.log("reference   = AudioContext.currentTime (hardware clock)");
  // eslint-disable-next-line no-console
  console.log("delta_i     = (observedAt - scheduledFor) * 1000   [ms]");
  // eslint-disable-next-line no-console
  console.log("jitterMs    = sqrt( Σ (delta_i - mean)² / N )");
  // eslint-disable-next-line no-console
  console.log("driftMs/min = linreg_slope(delta vs scheduledFor) * 60");
  // eslint-disable-next-line no-console
  console.log("stability01 = #{i : |delta_i| < 1 ms} / N");
  // eslint-disable-next-line no-console
  console.log("lateTicks   = #{i : scheduledFor < scheduledAt}");
  // eslint-disable-next-line no-console
  console.log("cbLatencyMs = (baseLatency + outputLatency) * 1000");
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/** Audio-synchronous clock test (Task 4 / Task 7).
 *  Runs WITHOUT touching the audio engine signal path: no voices, no FX —
 *  only the scheduler-replacement loop below feeds the same probe the live
 *  scheduler uses. Expected tick times come from masterClock.nextDivisionAt
 *  so the comparison is against the same authority the live scheduler uses.
 */
export async function runClockTest(durationMs = 2000, division: "1/16" | "1/8" | "1/4" = "1/16"): Promise<ClockReport> {
  logClockTestFormulas();
  const ctx = await ensureAudio();
  await installProbe(ctx);
  resetProbe();

  const startCtxTime = ctx.currentTime + 0.05;
  const divSec = masterClock.divisionSec(division);
  const endWall = performance.now() + durationMs;
  let next = startCtxTime;
  const lookAhead = 0.1;

  // Feed the probe with scheduled tick events at `divSec` cadence.
  // We do NOT call triggerPart / start any source — purely a timing test.
  return new Promise<ClockReport>((resolve) => {
    const tick = () => {
      const now = ctx.currentTime;
      while (next < now + lookAhead) {
        recordScheduledTick(now, next);
        next += divSec;
      }
      if (performance.now() < endWall) {
        setTimeout(tick, 25);
      } else {
        // Allow ~150ms for trailing callbacks to land.
        setTimeout(() => {
          const s = getProbeStats();
          const report: ClockReport = {
            jitterMs: s.jitterMs,
            stableRatio: s.stability01,
            driftMs: s.driftMsPerMin,
            at: Date.now(),
          };
          // eslint-disable-next-line no-console
          console.log("[ClockTest] result", { ...report, events: s.eventCount, lateTicks: s.lateTicks });
          resolve(report);
        }, 200);
      }
    };
    tick();
  });
}

/** Task 7 — Headless variant: returns raw probe stats + event count.
 *  Useful when UI values look absurd; call from the browser console:
 *      (await import('/src/lib/setup/clockTest.ts')).runHeadlessClockTest()
 */
export async function runHeadlessClockTest(durationMs = 3000) {
  const r = await runClockTest(durationMs, "1/16");
  const { exportRawEvents } = await import("@/lib/audio/audioClockProbe");
  return { report: r, raw: exportRawEvents() };
}