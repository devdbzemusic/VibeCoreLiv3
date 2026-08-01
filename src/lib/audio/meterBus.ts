// VibeCoreLiv3 — Meter Bus
// =====================================================================
// Non-React publish/subscribe channel for high-rate audio meter data.
//
// Why not Zustand?
//   The engine publishes peak/RMS values at 10 Hz. When these were
//   written into the global Zustand store, *every* component
//   subscribing to *any* part of the store was re-rendered, even
//   components that did not display meters. With 16 parts + 6 FX
//   slots + 2 master meters, this caused observable main-thread
//   pressure on Android (avgFps ≈ 11, frameTimeMs ≈ 95).
//
// This bus is intentionally minimal:
//   * one mutable snapshot
//   * a Set of listeners
//   * a `setPartVisible` registry so the engine can skip analyser
//     reads for parts that are not on screen and not currently
//     producing sound.
//
// All audio timing uses AudioContext.currentTime. We never call
// performance.now() / Date.now() here for audio-relevant gating.
// =====================================================================

export interface MeterSnapshot {
  /** Post-limiter master peak L (linear, 0..~1). */
  peakL: number;
  /** Post-limiter master peak R (linear, 0..~1). */
  peakR: number;
  /** Per-part peak, indexed by part id. */
  partPeaks: number[];
  /** Per-FX-slot peak (post-wet). */
  fxPeaks: number[];
  /** Per-FX-slot RMS (post-wet). */
  fxRms: number[];
  /** Per-FX-slot last-clip timestamp (performance.now()). UI display only. */
  fxClip: number[];
  /** Per-FX-slot auto-calibrated noise floor (dBFS). */
  fxFloorDb: number[];
  /** Master limiter gain reduction (positive dB). */
  limiterReduction: number;
  /** AudioContext.currentTime at publish. */
  publishedAt: number;
  /** Monotonically increasing version – useful for cheap equality checks. */
  version: number;
}

const initial: MeterSnapshot = {
  peakL: 0,
  peakR: 0,
  partPeaks: Array.from({ length: 16 }, () => 0),
  fxPeaks: Array.from({ length: 6 }, () => 0),
  fxRms: Array.from({ length: 6 }, () => 0),
  fxClip: Array.from({ length: 6 }, () => 0),
  fxFloorDb: Array.from({ length: 6 }, () => -60),
  limiterReduction: 0,
  publishedAt: 0,
  version: 0,
};

let snapshot: MeterSnapshot = initial;
const listeners = new Set<() => void>();

/** Replace the snapshot atomically and notify subscribers. */
export function publishMeter(patch: Partial<Omit<MeterSnapshot, "version">>): void {
  snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
  // Listeners must be cheap; React's useSyncExternalStore will diff
  // the selector result and skip re-render when unchanged.
  listeners.forEach((l) => {
    try { l(); } catch { /* swallow – one bad listener must not kill the loop */ }
  });
}

export function subscribeMeter(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getMeterSnapshot(): MeterSnapshot {
  return snapshot;
}

/** Test/debug helper – not used in production code. */
export function __resetMeterBus(): void {
  snapshot = { ...initial, version: 0 };
  listeners.clear();
  visibleParts.clear();
  partActiveUntil.clear();
}

// ─── Visible-part registry ────────────────────────────────────────────
// Components that render a per-part meter mount/unmount-register here.
// The engine reads analyser data for a part only if it is visible OR
// has produced sound in the recent past (markPartActive).
const visibleParts = new Set<number>();

export function setPartVisible(id: number, visible: boolean): void {
  if (visible) visibleParts.add(id);
  else visibleParts.delete(id);
}
export function isPartVisible(id: number): boolean {
  return visibleParts.has(id);
}

// ─── Active-part registry (audio-clock based) ─────────────────────────
// Engine calls markPartActive(id, ctx.currentTime) whenever a voice
// is scheduled. The part remains "active" for HOLD_SEC after that so
// its decay/tail is metered even if it scrolls off-screen.
const partActiveUntil = new Map<number, number>();
const ACTIVE_HOLD_SEC = 2.0;

export function markPartActive(id: number, ctxTime: number, holdSec = ACTIVE_HOLD_SEC): void {
  const prev = partActiveUntil.get(id) ?? 0;
  const next = ctxTime + holdSec;
  if (next > prev) partActiveUntil.set(id, next);
}
export function isPartActive(id: number, ctxTime: number): boolean {
  const until = partActiveUntil.get(id);
  return until != null && ctxTime < until;
}
