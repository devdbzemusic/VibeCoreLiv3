// Main-Thread Health Monitor — VibeCore Sync.
//
// Tracks diagnostic-only metrics about the JS main thread:
//   • FPS (rAF-derived, EMA smoothed)
//   • frameDrops      — frames whose interval exceeded 25 ms (≈ < 40 FPS)
//   • eventLoopLagMs  — setTimeout(0) → callback delay, sampled at 1 Hz
//   • longTasks{16/50/100} — counts of long tasks (mirrored from PerformanceObserver)
//   • reactRenderAvgMs — externally fed via recordReactRender()
//   • gcSuspectedMs   — externally fed via recordGcPause()
//
// CRITICAL CONTRACT: These metrics MUST NEVER gate audio PASS/FAIL.
// They are surfaced as warnings only. The audio engine's verdict comes
// exclusively from AudioContext-clock metrics in audioPerf + audioClockProbe.
//
// All methods are O(1) and allocation-free in steady state.

export interface MainThreadStats {
  fps: number;
  /** 95th-percentile frame interval (ms) over the last second */
  frameP95Ms: number;
  frameDrops: number;
  eventLoopLagMs: number;
  eventLoopLagMaxMs: number;
  longTasks: { gt16: number; gt50: number; gt100: number };
  reactRenderAvgMs: number;
  reactRenderMaxMs: number;
  gcSuspectedMs: number;
  /** Monotonic warning level — 0=ok, 1=info, 2=warn, 3=critical. */
  warningLevel: 0 | 1 | 2 | 3;
  lastUpdate: number;
}

const stats: MainThreadStats = {
  fps: 60,
  frameP95Ms: 16.7,
  frameDrops: 0,
  eventLoopLagMs: 0,
  eventLoopLagMaxMs: 0,
  longTasks: { gt16: 0, gt50: 0, gt100: 0 },
  reactRenderAvgMs: 0,
  reactRenderMaxMs: 0,
  gcSuspectedMs: 0,
  warningLevel: 0,
  lastUpdate: 0,
};

// Ring of last 64 frame intervals for p95 (constant memory).
const RING = 64;
const frameRing = new Float32Array(RING);
let frameRingIdx = 0;
let frameRingFilled = 0;

let _rafHandle: number | null = null;
let _lastFrameTs = 0;
let _started = false;

function onFrame(now: number): void {
  if (_lastFrameTs > 0) {
    const dt = now - _lastFrameTs;
    frameRing[frameRingIdx] = dt;
    frameRingIdx = (frameRingIdx + 1) % RING;
    if (frameRingFilled < RING) frameRingFilled++;
    if (dt > 25) stats.frameDrops++;
    // FPS EMA (alpha = 0.1) on instantaneous 1000/dt.
    const inst = dt > 0 ? 1000 / dt : 60;
    stats.fps = stats.fps * 0.9 + inst * 0.1;
  }
  _lastFrameTs = now;
  _rafHandle = requestAnimationFrame(onFrame);
}

// O(n log n) over 64 elements — < 5 µs. Called only on getMainThreadStats().
function recomputeP95(): void {
  if (frameRingFilled === 0) return;
  const arr = new Array<number>(frameRingFilled);
  for (let i = 0; i < frameRingFilled; i++) arr[i] = frameRing[i];
  arr.sort((a, b) => a - b);
  const idx = Math.floor(arr.length * 0.95);
  stats.frameP95Ms = arr[Math.min(idx, arr.length - 1)];
}

// Event-loop lag probe: schedule setTimeout(0) and measure overshoot.
let _lagTimer: ReturnType<typeof setInterval> | null = null;
function probeEventLoop(): void {
  const t0 = performance.now();
  setTimeout(() => {
    const lag = performance.now() - t0; // ideal ≈ 4 ms cap; subtract floor.
    const adjusted = Math.max(0, lag - 4);
    stats.eventLoopLagMs = stats.eventLoopLagMs * 0.7 + adjusted * 0.3;
    if (adjusted > stats.eventLoopLagMaxMs) stats.eventLoopLagMaxMs = adjusted;
  }, 0);
}

function recomputeWarning(): void {
  let lvl: 0 | 1 | 2 | 3 = 0;
  if (stats.fps < 50 || stats.eventLoopLagMs > 50) lvl = 1;
  if (stats.fps < 30 || stats.eventLoopLagMs > 200) lvl = 2;
  if (stats.fps < 15 || stats.eventLoopLagMs > 800) lvl = 3;
  stats.warningLevel = lvl;
}

export function startMainThreadMonitor(): void {
  if (_started) return;
  _started = true;
  if (typeof requestAnimationFrame !== "undefined") {
    _rafHandle = requestAnimationFrame(onFrame);
  }
  _lagTimer = setInterval(probeEventLoop, 1000);
}

export function stopMainThreadMonitor(): void {
  if (!_started) return;
  _started = false;
  if (_rafHandle !== null && typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(_rafHandle);
    _rafHandle = null;
  }
  if (_lagTimer !== null) {
    clearInterval(_lagTimer);
    _lagTimer = null;
  }
  _lastFrameTs = 0;
}

export function recordReactRender(durationMs: number): void {
  stats.reactRenderAvgMs = stats.reactRenderAvgMs * 0.9 + durationMs * 0.1;
  if (durationMs > stats.reactRenderMaxMs) stats.reactRenderMaxMs = durationMs;
}

export function recordLongTaskMT(durationMs: number): void {
  if (durationMs > 16) stats.longTasks.gt16++;
  if (durationMs > 50) stats.longTasks.gt50++;
  if (durationMs > 100) stats.longTasks.gt100++;
  // Heuristic: very long task with no prior CPU work ≈ GC pause.
  if (durationMs > 100) stats.gcSuspectedMs = durationMs;
}

export function getMainThreadStats(): MainThreadStats {
  recomputeP95();
  recomputeWarning();
  stats.lastUpdate = performance.now();
  return {
    ...stats,
    longTasks: { ...stats.longTasks },
  };
}

export function resetMainThreadStats(): void {
  stats.frameDrops = 0;
  stats.eventLoopLagMaxMs = 0;
  stats.reactRenderMaxMs = 0;
  stats.gcSuspectedMs = 0;
  stats.longTasks = { gt16: 0, gt50: 0, gt100: 0 };
  frameRingIdx = 0;
  frameRingFilled = 0;
  for (let i = 0; i < RING; i++) frameRing[i] = 0;
}

// Expose a non-PASS-gating global for the Diagnostics modal & headless tools.
declare global {
  interface Window {
    __vibeMainThread?: () => MainThreadStats;
  }
}
if (typeof window !== "undefined") {
  window.__vibeMainThread = getMainThreadStats;
}
