// VibeCoreLiv3 — Pattern Timing Validator
//
// Validates that the scheduler emits ticks on the exact AudioContext-time
// grid implied by the configured BPM. The validator is non-invasive:
//   * It does NOT modify the scheduler, transport, or DSP.
//   * It only reads the audio-synchronous events captured by
//     `audioClockProbe` (which already records every tick's scheduledFor
//     timestamp at scheduling time, plus the observed callback time).
//
// METHOD
//   1. Snapshot the probe's current scheduledFor stream.
//   2. Optionally wait `durationSec` (default 10 s @ 120 BPM ≈ 80 ticks).
//   3. Snapshot again.
//   4. The newly captured events form a monotonically increasing series of
//      `scheduledFor` values. Expected step duration = 60 / BPM / 4 (a 16th
//      note). For each consecutive pair we compute:
//        gridErrorMs = (scheduledFor[i] - scheduledFor[i-1] - stepDur) * 1000
//        observedJitterMs = (observedAt[i] - scheduledFor[i]) * 1000
//   5. Report mean / p95 / max for both series, plus pass/fail vs thresholds.
//
// HEADLESS / TEST USE
//   `validateFromEvents(events, bpm)` is pure and accepts a synthetic event
//   stream — used by `patternTiming.test.ts` without a real AudioContext.

import { exportRawEvents, resetProbe, installProbe, type SchedEvent } from "./audioClockProbe";

export interface TimingReport {
  bpm: number;
  durationSec: number;
  sampleCount: number;
  expectedStepMs: number;
  gridError: { meanMs: number; p95Ms: number; maxMs: number; stdDevMs: number };
  /** Audio-thread jitter derived from AudioContext.currentTime grid alignment.
   *  expectedAudioTime = firstScheduledFor + stepIndex * stepDur
   *  actualAudioTime   = scheduledFor[stepIndex]   (sample-accurate)
   *  delta             = actual − expected                            */
  audioJitter: { meanMs: number; p95Ms: number; maxMs: number; stdDevMs: number };
  audioJitterP95: number;
  audioJitterMax: number;
  /** Legacy: ScriptProcessor callback (observedAt − scheduledFor) — reflects
   *  MAIN-THREAD latency, NOT audio timing. Kept for back-compat / contrast. */
  observedJitter: { meanMs: number; p95Ms: number; maxMs: number };
  /** Events whose scheduledFor was already in the past at scheduling time
   *  (ctx.currentTime > scheduledFor). */
  schedulerLateEvents: number;
  /** Hardware-clock xruns: same definition as schedulerLateEvents in this
   *  implementation — the scheduler missed its lookahead window. */
  xruns: number;
  /** Per-event audio-clock alignment sample (first 50): expectedAudioTime
   *  (ideal grid), actualAudioTime (AudioContext.currentTime read on the
   *  audio render thread via the AudioWorklet probe), deltaMs. */
  sampleLog: { i: number; expectedAudioTime: number; actualAudioTime: number; deltaMs: number }[];
  pass: boolean;
  thresholds: { gridP95Ms: number; gridMaxMs: number; jitterP95Ms: number };
  classification: "PASS" | "WARN" | "FAIL";
  notes: string[];
}

const DEFAULT_THRESHOLDS = {
  gridP95Ms: 1.5,
  gridMaxMs: 5.0,
  jitterP95Ms: 5.0,
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function stats(values: number[]) {
  const n = values.length;
  if (n === 0) return { meanMs: 0, p95Ms: 0, maxMs: 0, stdDevMs: 0 };
  const abs = values.map((v) => Math.abs(v));
  const sorted = abs.slice().sort((a, b) => a - b);
  const mean = abs.reduce((s, v) => s + v, 0) / n;
  let varSum = 0;
  for (const v of abs) varSum += (v - mean) * (v - mean);
  return {
    meanMs: round(mean),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1]),
    stdDevMs: round(Math.sqrt(varSum / n)),
  };
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

/** Pure analyser — used by the in-app run AND by the headless test. */
export function validateFromEvents(
  events: SchedEvent[],
  bpm: number,
  thresholds = DEFAULT_THRESHOLDS,
): TimingReport {
  const expectedStepSec = 60 / bpm / 4;
  const expectedStepMs = expectedStepSec * 1000;
  const notes: string[] = [];

  if (events.length < 4) {
    return {
      bpm,
      durationSec: 0,
      sampleCount: events.length,
      expectedStepMs: round(expectedStepMs),
      gridError: { meanMs: 0, p95Ms: 0, maxMs: 0, stdDevMs: 0 },
      audioJitter: { meanMs: 0, p95Ms: 0, maxMs: 0, stdDevMs: 0 },
      audioJitterP95: 0,
      audioJitterMax: 0,
      observedJitter: { meanMs: 0, p95Ms: 0, maxMs: 0 },
      schedulerLateEvents: 0,
      xruns: 0,
      sampleLog: [],
      pass: false,
      thresholds,
      classification: "FAIL",
      notes: ["insufficient events (< 4) — scheduler not running?"],
    };
  }

  // Sort by scheduledFor (probe stores oldest→newest already, but be safe).
  const sorted = events.slice().sort((a, b) => a.scheduledFor - b.scheduledFor);

  // ── GRID ERROR: spacing between consecutive scheduledFor timestamps ──
  const gridErrors: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const deltaSec = sorted[i].scheduledFor - sorted[i - 1].scheduledFor;
    gridErrors.push((deltaSec - expectedStepSec) * 1000);
  }

  // ── AUDIO JITTER (TRUE) ──
  // expectedAudioTime = firstScheduledFor + i * stepDur
  // actualAudioTime   = scheduledFor[i]   (sample-accurate WebAudio time)
  // delta             = (actual − expected) * 1000 ms
  // Pure AudioContext.currentTime math — independent of main-thread / SP
  // callback latency. This is the metric that correlates with audible glitches.
  // ── AUDIO JITTER (TRUE) ──
  // expectedAudioTime = firstScheduledFor + i * stepDur   (ideal grid)
  // actualAudioTime   = observedAt                         (AudioContext.currentTime
  //                                                        read on the audio
  //                                                        render thread by the
  //                                                        AudioWorklet probe)
  // deltaMs            = (actual − expected) * 1000
  // This is the metric that correlates with audible glitches: it captures
  // both scheduler grid error and audio-thread quantum latency, measured on
  // the audio clock — independent of main-thread / ScriptProcessor jitter.
  const t0 = sorted[0].scheduledFor;
  const audioDeltas: number[] = [];
  const sampleLog: { i: number; expectedAudioTime: number; actualAudioTime: number; deltaMs: number }[] = [];
  let schedulerLateEvents = 0;
  for (let i = 0; i < sorted.length; i++) {
    const expectedAudioTime = t0 + i * expectedStepSec;
    // TRUE audio-thread actual time. Falls back to scheduledFor only if the
    // probe never observed the event (observedAt === 0).
    const actualAudioTime = sorted[i].observedAt > 0 ? sorted[i].observedAt : sorted[i].scheduledFor;
    const deltaMs = (actualAudioTime - expectedAudioTime) * 1000;
    audioDeltas.push(deltaMs);
    if (sampleLog.length < 50) {
      sampleLog.push({
        i,
        expectedAudioTime: round(expectedAudioTime),
        actualAudioTime: round(actualAudioTime),
        deltaMs: round(deltaMs),
      });
    }
    if (sorted[i].scheduledFor < sorted[i].scheduledAt) schedulerLateEvents++;
  }

  // ── OBSERVED (LEGACY) JITTER ──
  // This is the ScriptProcessor callback latency. On Android with React load
  // it can spike to >1000 ms because the SP runs on the main thread. Kept
  // only so users can SEE the difference vs the real audio jitter.
  const observedJitterVals = sorted.map((e) => e.deltaMs);

  const grid = stats(gridErrors);
  const audioJ = stats(audioDeltas);
  const obsJ = stats(observedJitterVals);
  const obsJitter = { meanMs: obsJ.meanMs, p95Ms: obsJ.p95Ms, maxMs: obsJ.maxMs };

  const passGrid = grid.p95Ms <= thresholds.gridP95Ms && grid.maxMs <= thresholds.gridMaxMs;
  // PASS/FAIL is decided on the TRUE audio jitter, not the SP-callback noise.
  const passJit = audioJ.p95Ms <= thresholds.jitterP95Ms;
  const pass = passGrid && passJit;
  const classification: TimingReport["classification"] =
    pass ? "PASS" : (grid.p95Ms <= thresholds.gridP95Ms * 2 && audioJ.p95Ms <= thresholds.jitterP95Ms * 2) ? "WARN" : "FAIL";

  if (!passGrid) notes.push(`grid p95 ${grid.p95Ms}ms > ${thresholds.gridP95Ms}ms or max ${grid.maxMs}ms > ${thresholds.gridMaxMs}ms`);
  if (!passJit) notes.push(`audio jitter p95 ${audioJ.p95Ms}ms > ${thresholds.jitterP95Ms}ms`);
  if (schedulerLateEvents > 0) notes.push(`scheduler late events: ${schedulerLateEvents} (lookahead too small for current load)`);
  if (obsJitter.p95Ms > thresholds.jitterP95Ms * 5) {
    notes.push(`note: observedJitter p95 ${obsJitter.p95Ms}ms = (observedAt − scheduledFor); with the AudioWorklet probe this is audio-thread quantum latency, with the ScriptProcessor fallback it is main-thread callback latency — use audioJitter for audio quality`);
  }

  const durationSec = sorted[sorted.length - 1].scheduledFor - sorted[0].scheduledFor;

  return {
    bpm,
    durationSec: round(durationSec),
    sampleCount: sorted.length,
    expectedStepMs: round(expectedStepMs),
    gridError: grid,
    audioJitter: audioJ,
    audioJitterP95: audioJ.p95Ms,
    audioJitterMax: audioJ.maxMs,
    observedJitter: obsJitter,
    schedulerLateEvents,
    xruns: schedulerLateEvents,
    sampleLog,
    pass,
    thresholds,
    classification,
    notes,
  };
}

/**
 * In-app runner. Ensures the AudioContext + AudioWorklet timing probe are
 * installed, forces 120 BPM, starts transport, records for `durationSec`
 * (default 10 s ≈ 80 sixteenth-ticks), validates, logs the per-event
 * audio-clock alignment, then restores prior state.
 *
 * All timing references AudioContext.currentTime on the audio render thread
 * — never performance.now() / requestAnimationFrame / setInterval.
 */
export async function runTimingValidation(durationSec = 10): Promise<TimingReport> {
  const { useGroove } = await import("@/lib/store");
  const { ensureAudio } = await import("@/lib/audio/engine");
  const prev = {
    bpm: useGroove.getState().bpm,
    playing: useGroove.getState().transport.playing,
  };

  // Real audio clock + audio-thread probe must be ready before any tick.
  const ctx = await ensureAudio();
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* ignore */ } }
  await installProbe(ctx);

  // Force 120 BPM for a reproducible measurement.
  useGroove.getState().setBpm(120);
  resetProbe();

  // Start transport if not already playing.
  if (!prev.playing) {
    useGroove.setState((s) => ({ transport: { ...s.transport, playing: true } }));
  }

  await new Promise<void>((resolve) => setTimeout(resolve, durationSec * 1000));

  const events = exportRawEvents();
  const report = validateFromEvents(events, 120);

  // ── Per-event audio-clock alignment log ──────────────────────────────
  // expectedAudioTime = stepIndex * stepDuration (ideal grid)
  // actualAudioTime   = AudioContext.currentTime read on the audio thread
  // deltaMs            = (actual − expected) * 1000
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `[TimingTest] ${report.sampleCount} events · audioJitter p95=${report.audioJitterP95}ms max=${report.audioJitterMax}ms · late=${report.schedulerLateEvents} · xruns=${report.xruns} · ${report.classification}`
  );
  if (report.sampleLog.length) {
    // eslint-disable-next-line no-console
    console.table(report.sampleLog);
  }
  // eslint-disable-next-line no-console
  console.log("[TimingTest] notes:", report.notes);
  // eslint-disable-next-line no-console
  console.groupEnd();

  // Restore prior state.
  if (!prev.playing) {
    useGroove.setState((s) => ({ transport: { ...s.transport, playing: false } }));
  }
  useGroove.getState().setBpm(prev.bpm);

  return report;
}

/** Alias matching the user-facing name in the diagnostics framework. */
export const runTimingTest = runTimingValidation;

// Expose on window for headless / Android console access.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runAudioTimingTest = runTimingValidation;
  (window as unknown as Record<string, unknown>).runTimingTest = runTimingValidation;
}