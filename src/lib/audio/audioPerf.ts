// Audio Performance Monitor.
//
// Lightweight metrics collector for the scheduler / audio callback path
// and main-thread health (long tasks, voice rates, grain rates).
//
// All recorders are O(1) and allocation-free in steady state. UI reads
// once per 250-500 ms via `getAudioPerf()`.

export interface SchedulerStats {
  /** EMA of |actualInterval − targetInterval| ms */
  avgDriftMs: number;
  /** Max single-tick drift observed since reset (ms) */
  maxDriftMs: number;
  /** Ticks whose interval exceeded target by > 5 ms */
  lateTicks: number;
  /** Ticks effectively skipped (gap > 2× target) */
  missedTicks: number;
}

export interface VoiceStats {
  active: number;
  peak: number;
  createdPerSecond: number;
  destroyedPerSecond: number;
}

export interface GrainStats {
  active: number;
  peak: number;
  perSecond: number;
}

export interface LongTaskStats {
  gt16: number;
  gt50: number;
  gt100: number;
}

/**
 * Scheduler queue + lookahead diagnostics. Fed by the scheduler whenever
 * it schedules an event. All values are derived from AudioContext.currentTime
 * — never performance.now().
 */
export interface SchedulerQueueStats {
  /** Current depth of the pending-events queue. */
  queueDepth: number;
  /** Peak depth observed since last reset. */
  peakQueueDepth: number;
  /** EMA of (scheduledTime − currentTime) in ms — i.e. how far ahead we book. */
  avgLookaheadMs: number;
  /** Worst lookahead distance observed (ms). */
  maxLookaheadMs: number;
  /** Histogram of lookahead in 4 bins: <25 / <50 / <100 / ≥100 ms. */
  lookaheadHist: [number, number, number, number];
  /** EMA of scheduling offset = |scheduledTime − idealGridTime| ms. */
  avgOffsetMs: number;
  /** Peak scheduling offset (ms). */
  peakOffsetMs: number;
  /** Count of scheduler ticks whose wall-clock interval exceeded 2× target. */
  missedCycles: number;
  /** Worst scheduler-loop wall-clock delay (ms). */
  worstSchedulerDelayMs: number;
  /** Fraction of scheduler-loop time spent inside scheduling (0..1). */
  utilization: number;
}

export interface AudioPerf {
  callbackLatencySec: number;
  xruns: number;
  pressureFrames: number;
  droppedVoices: number;
  activeVoices: number;
  peakVoices: number;
  /** Active AudioNode count (set externally from graph debug). */
  activeNodes: number;
  /** AudioContext baseLatency + outputLatency in seconds (when supported). */
  audioBufferUtil: number;
  /** Composite 0..100 timing score derived from jitter / drift / xruns. */
  timingStabilityScore: number;
  tickAvgMs: number;
  tickMaxMs: number;
  lastUpdate: number;
  scheduler: SchedulerStats;
  queue: SchedulerQueueStats;
  voices: VoiceStats;
  grains: GrainStats;
  longTasks: LongTaskStats;
  /** Heap MB (Chrome only — undefined elsewhere) */
  heapMb: number;
  heapGrowthMbPerMin: number;
}

const perf: AudioPerf = {
  callbackLatencySec: 0,
  xruns: 0,
  pressureFrames: 0,
  droppedVoices: 0,
  activeVoices: 0,
  peakVoices: 0,
  activeNodes: 0,
  audioBufferUtil: 0,
  timingStabilityScore: 100,
  tickAvgMs: 0,
  tickMaxMs: 0,
  lastUpdate: 0,
  scheduler: { avgDriftMs: 0, maxDriftMs: 0, lateTicks: 0, missedTicks: 0 },
  queue: {
    queueDepth: 0,
    peakQueueDepth: 0,
    avgLookaheadMs: 0,
    maxLookaheadMs: 0,
    lookaheadHist: [0, 0, 0, 0],
    avgOffsetMs: 0,
    peakOffsetMs: 0,
    missedCycles: 0,
    worstSchedulerDelayMs: 0,
    utilization: 0,
  },
  voices: { active: 0, peak: 0, createdPerSecond: 0, destroyedPerSecond: 0 },
  grains: { active: 0, peak: 0, perSecond: 0 },
  longTasks: { gt16: 0, gt50: 0, gt100: 0 },
  heapMb: 0,
  heapGrowthMbPerMin: 0,
};

// ── rolling 1 s counters for rates ─────────────────────────────────────────
let _voiceCreatedBin = 0;
let _voiceDestroyedBin = 0;
let _grainBin = 0;
let _binStart = (typeof performance !== "undefined" ? performance.now() : 0);
let _lastHeap = 0;
let _heapTimerStart = _binStart;

function rollBins() {
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const dt = now - _binStart;
  if (dt >= 1000) {
    const scale = 1000 / dt;
    perf.voices.createdPerSecond = Math.round(_voiceCreatedBin * scale);
    perf.voices.destroyedPerSecond = Math.round(_voiceDestroyedBin * scale);
    perf.grains.perSecond = Math.round(_grainBin * scale);
    _voiceCreatedBin = 0; _voiceDestroyedBin = 0; _grainBin = 0;
    _binStart = now;
  }
  // Heap sampling (Chrome). Compute MB/min growth using simple slope.
  const memInfo = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  if (memInfo) {
    const mb = memInfo.usedJSHeapSize / (1024 * 1024);
    perf.heapMb = Math.round(mb * 10) / 10;
    if (_lastHeap === 0) { _lastHeap = mb; _heapTimerStart = now; }
    const elapsedMin = (now - _heapTimerStart) / 60000;
    if (elapsedMin >= 0.25) {
      perf.heapGrowthMbPerMin = Math.round(((mb - _lastHeap) / elapsedMin) * 10) / 10;
      _lastHeap = mb;
      _heapTimerStart = now;
    }
  }
}

/** Recompute composite 0..100 timing score from current metrics. */
function recomputeTimingScore(): void {
  // Weighted penalty model (audio-only inputs):
  //   • xruns                 — 8 pts each, capped at 40
  //   • lateTicks             — 0.5 pts each, capped at 20
  //   • maxDriftMs            — 2 pts per ms over 1 ms, capped at 20
  //   • peakOffsetMs          — 5 pts per ms over 1 ms, capped at 20
  let penalty = 0;
  penalty += Math.min(40, perf.xruns * 8);
  penalty += Math.min(20, perf.scheduler.lateTicks * 0.5);
  penalty += Math.min(20, Math.max(0, perf.scheduler.maxDriftMs - 1) * 2);
  penalty += Math.min(20, Math.max(0, perf.queue.peakOffsetMs - 1) * 5);
  perf.timingStabilityScore = Math.max(0, Math.round(100 - penalty));
}

export function getAudioPerf(): AudioPerf {
  rollBins();
  recomputeTimingScore();
  return {
    ...perf,
    scheduler: { ...perf.scheduler },
    queue: { ...perf.queue, lookaheadHist: [...perf.queue.lookaheadHist] as [number, number, number, number] },
    voices: { ...perf.voices },
    grains: { ...perf.grains },
    longTasks: { ...perf.longTasks },
  };
}

export function recordTick(elapsedMs: number, intervalMs: number): void {
  perf.tickAvgMs = perf.tickAvgMs * 0.9 + elapsedMs * 0.1;
  if (elapsedMs > perf.tickMaxMs) perf.tickMaxMs = elapsedMs;
  if (elapsedMs > intervalMs) perf.xruns++;
  else if (elapsedMs > intervalMs * 0.8) perf.pressureFrames++;
  perf.lastUpdate = performance.now();
  // Utilization: fraction of available scheduler-loop budget consumed.
  if (intervalMs > 0) {
    const u = Math.min(1, elapsedMs / intervalMs);
    perf.queue.utilization = perf.queue.utilization * 0.9 + u * 0.1;
  }
}

/** Record scheduler-loop interval drift (actual vs target ms). */
export function recordSchedulerDrift(actualMs: number, targetMs: number): void {
  const drift = Math.abs(actualMs - targetMs);
  perf.scheduler.avgDriftMs = perf.scheduler.avgDriftMs * 0.9 + drift * 0.1;
  if (drift > perf.scheduler.maxDriftMs) perf.scheduler.maxDriftMs = drift;
  if (actualMs > targetMs + 5) perf.scheduler.lateTicks++;
  if (actualMs > targetMs * 2) {
    perf.scheduler.missedTicks++;
    perf.queue.missedCycles++;
  }
  const delay = Math.max(0, actualMs - targetMs);
  if (delay > perf.queue.worstSchedulerDelayMs) perf.queue.worstSchedulerDelayMs = delay;
}

/**
 * Record a scheduled event: distance ahead of `now` plus its offset from
 * the ideal-grid time. All inputs are in seconds (AudioContext domain) —
 * we convert to ms internally.
 */
export function recordScheduledEvent(
  scheduledTime: number,
  nowAudio: number,
  idealGridTime: number,
  currentQueueDepth: number,
): void {
  const lookaheadMs = Math.max(0, (scheduledTime - nowAudio) * 1000);
  perf.queue.avgLookaheadMs = perf.queue.avgLookaheadMs * 0.9 + lookaheadMs * 0.1;
  if (lookaheadMs > perf.queue.maxLookaheadMs) perf.queue.maxLookaheadMs = lookaheadMs;
  if (lookaheadMs < 25) perf.queue.lookaheadHist[0]++;
  else if (lookaheadMs < 50) perf.queue.lookaheadHist[1]++;
  else if (lookaheadMs < 100) perf.queue.lookaheadHist[2]++;
  else perf.queue.lookaheadHist[3]++;

  const offsetMs = Math.abs(scheduledTime - idealGridTime) * 1000;
  perf.queue.avgOffsetMs = perf.queue.avgOffsetMs * 0.9 + offsetMs * 0.1;
  if (offsetMs > perf.queue.peakOffsetMs) perf.queue.peakOffsetMs = offsetMs;

  perf.queue.queueDepth = currentQueueDepth;
  if (currentQueueDepth > perf.queue.peakQueueDepth) perf.queue.peakQueueDepth = currentQueueDepth;
}

export function recordActiveNodes(n: number): void {
  perf.activeNodes = n;
}

export function recordAudioBufferUtil(util: number): void {
  perf.audioBufferUtil = util;
}

export function recordCallbackLatency(sec: number): void {
  perf.callbackLatencySec = sec;
}

export function recordDroppedVoice(): void {
  perf.droppedVoices++;
}

export function recordVoiceCreated(): void { _voiceCreatedBin++; }
export function recordVoiceDestroyed(): void { _voiceDestroyedBin++; }
export function recordGrainSpawned(): void { _grainBin++; }
export function recordActiveGrains(n: number): void {
  perf.grains.active = n;
  if (n > perf.grains.peak) perf.grains.peak = n;
}

export function recordActiveVoices(n: number): void {
  perf.activeVoices = n;
  perf.voices.active = n;
  if (n > perf.peakVoices) perf.peakVoices = n;
  if (n > perf.voices.peak) perf.voices.peak = n;
}

export function recordLongTask(durationMs: number): void {
  if (durationMs > 16) perf.longTasks.gt16++;
  if (durationMs > 50) perf.longTasks.gt50++;
  if (durationMs > 100) perf.longTasks.gt100++;
}

export function resetAudioPerf(): void {
  perf.xruns = 0;
  perf.pressureFrames = 0;
  perf.droppedVoices = 0;
  perf.peakVoices = perf.activeVoices;
  perf.tickMaxMs = 0;
  perf.scheduler.maxDriftMs = 0;
  perf.scheduler.lateTicks = 0;
  perf.scheduler.missedTicks = 0;
  perf.queue.peakQueueDepth = perf.queue.queueDepth;
  perf.queue.maxLookaheadMs = 0;
  perf.queue.peakOffsetMs = 0;
  perf.queue.missedCycles = 0;
  perf.queue.worstSchedulerDelayMs = 0;
  perf.queue.lookaheadHist = [0, 0, 0, 0];
  perf.voices.peak = perf.voices.active;
  perf.grains.peak = perf.grains.active;
  perf.longTasks = { gt16: 0, gt50: 0, gt100: 0 };
  perf.timingStabilityScore = 100;
  _voiceCreatedBin = 0; _voiceDestroyedBin = 0; _grainBin = 0;
  _binStart = (typeof performance !== "undefined" ? performance.now() : 0);
}
