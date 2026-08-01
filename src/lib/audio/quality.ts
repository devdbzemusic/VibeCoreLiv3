// Adaptive quality manager — measures FPS and adjusts a global quality
// profile (LOW / MEDIUM / HIGH) based on UI FPS, CPU load and voice count.
//
// Other audio modules import `getQuality()` (cheap synchronous read) to
// cap their work: granular density / tick rate, max simultaneous voices,
// meter analyser frame rate.
//
// User can force a profile via store.qualityProfile (AUTO|LOW|MEDIUM|HIGH).

import { useGroove } from "@/lib/store";

export type QualityLevel = "LOW" | "MEDIUM" | "HIGH";

export interface QualitySettings {
  level: QualityLevel;
  /** hard cap on grain density (1..64) */
  densityCap: number;
  /** absolute cap on concurrent grains spawned per tick across all parts */
  maxGrains: number;
  /** granular scheduler tick interval (ms) */
  grainTickMs: number;
  /** max concurrent voices before new triggers are dropped */
  voiceCap: number;
  /** meter loop interval (ms) */
  meterMs: number;
  /** UI animation reduction factor 0..1 (1 = full) */
  uiAnim: number;
  /** step-scheduler look-ahead window in seconds */
  lookAheadSec: number;
  /** step-scheduler tick interval (ms) */
  schedulerTickMs: number;
  /** AudioContext latencyHint preset */
  latencyHint: AudioContextLatencyCategory;
  /** extra safety offset added to every scheduled trigger (s) */
  scheduleOffsetSec: number;
}

const PROFILES: Record<QualityLevel, QualitySettings> = {
  HIGH: {
    // Lookahead reduced 140→100 ms, offset 10→6 ms.
    // The lookahead only needs to comfortably exceed the scheduler tick
    // interval (35 ms) plus jitter margin — it does NOT need to cover the
    // hardware outputLatency (that just delays playback, it doesn't require
    // scheduling further ahead). Cutting ~50 ms of end-to-end scheduling
    // latency makes pattern switches and live parameter changes feel
    // immediate while staying safely above the 2×tick (70 ms) xrun floor.
    level: "HIGH", densityCap: 6, maxGrains: 96, grainTickMs: 45, voiceCap: 48, meterMs: 60, uiAnim: 1.0,
    lookAheadSec: 0.10, schedulerTickMs: 35, latencyHint: "playback", scheduleOffsetSec: 0.006,
  },
  MEDIUM: {
    // 240→180 ms lookahead, 18→12 ms offset. Still > 2× tick (110 ms) so the
    // while-loop never misses a window on mid-range devices, but ~60 ms
    // less scheduling latency for faster switch response.
    level: "MEDIUM", densityCap: 4, maxGrains: 64, grainTickMs: 70, voiceCap: 28, meterMs: 100, uiAnim: 0.6,
    lookAheadSec: 0.18, schedulerTickMs: 55, latencyHint: "playback", scheduleOffsetSec: 0.012,
  },
  LOW: {
    level: "LOW", densityCap: 3, maxGrains: 32, grainTickMs: 110, voiceCap: 14, meterMs: 160, uiAnim: 0.0,
    lookAheadSec: 0.34, schedulerTickMs: 85, latencyHint: "playback", scheduleOffsetSec: 0.030,
  },
};


let current: QualitySettings = PROFILES.HIGH;
let started = false;

// FPS measurement (EMA over rAF deltas)
let lastT = 0;
let emaFps = 60;
let fpsLowFrames = 0;

export function getQuality(): QualitySettings { return current; }

const listeners = new Set<(q: QualitySettings) => void>();
export function onQualityChange(fn: (q: QualitySettings) => void) {
  listeners.add(fn); return () => listeners.delete(fn);
}

/** Choose initial AudioContext latencyHint before the manager starts measuring.
 *  Differentiated per profile, with device-type awareness for AUTO:
 *  - HIGH    → "interactive" (lowest latency, desktop / capable devices)
 *  - MEDIUM  → "playback"    (balanced safety)
 *  - LOW     → "playback"    (favor stability over responsiveness)
 *  - AUTO    → "playback" on mobile UA, "interactive" otherwise. */
export function getInitialLatencyHint(profile: string): AudioContextLatencyCategory {
  if (profile === "LOW") return "playback";
  if (profile === "MEDIUM") return "playback";
  if (profile === "HIGH") return "interactive";
  // AUTO — detect mobile/low-power device
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const cores = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 4) : 4;
  if (isMobile || cores <= 4) return "playback";
  return "interactive";
}

// ── Geräte-Tuning (SynthMark) ──────────────────────────────────────────
// Xiaomi 25078RA3EE (SynthMark 1.27.1): arm64-v8a, API 35, 8 Kerne,
// BIG=CPU#6 / LITTLE=CPU#2, VoiceMark_90 big=214, frames.per.burst=96,
// steady latency 2 ms, mixed-load 6 ms (Governor-Lag). Für „perfekte
// Soundwiedergabe" passt der native Oboe-Pfad Burst=96, Big-Core-Affinität
// und ADPF an; der Web-Audio-Pfad hebt den Schedule-Offset auf die
// Worst-Case-Latenz unter dynamischer Last.
export interface DeviceTuning {
  framesPerBurst: number;
  bigCpuIndex: number;
  mixedLatencyMs: number;
  steadyLatencyMs: number;
  voiceCapBig: number;
  sampleRate: number;
  isBigLittle: boolean;
}

let deviceTuning: DeviceTuning | null = null;
export function getDeviceTuning(): DeviceTuning {
  if (deviceTuning) return deviceTuning;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const cores = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 0) : 0;
  const isXiaomiBigLittle = /25078RA3EE/i.test(ua) || (/Android/i.test(ua) && cores === 8);
  deviceTuning = isXiaomiBigLittle
    ? { framesPerBurst: 96, bigCpuIndex: 6, mixedLatencyMs: 6, steadyLatencyMs: 2, voiceCapBig: 214, sampleRate: 48000, isBigLittle: true }
    : { framesPerBurst: 0, bigCpuIndex: -1, mixedLatencyMs: 0, steadyLatencyMs: 0, voiceCapBig: 0, sampleRate: 48000, isBigLittle: false };
  return deviceTuning;
}

/** Sync extra schedule offset for callers that need base latency.
 *  Gerätespezifisch: muss die Worst-Case-Ausgabelatenz unter dynamischer
 *  Last (Governor-Lag) übersteigen, damit Trigger sicher im Renderfenster
 *  landen — auf dem Xiaomi big.LITTLE-Gerät mindestens mixedLatency+2 ms. */
export function getScheduleOffset(): number {
  const dev = getDeviceTuning();
  const minOffset = (dev.mixedLatencyMs + 2) / 1000;
  return Math.max(current.scheduleOffsetSec, minOffset);
}


function decideAuto(fps: number, cpu: number, voices: number): QualityLevel {
  // Hard pressure → LOW
  if (fps < 40 || cpu > 85 || voices > 40) return "LOW";
  // Mild pressure → MEDIUM
  if (fps < 52 || cpu > 65 || voices > 24) return "MEDIUM";
  return "HIGH";
}

export function startQualityManager() {
  if (started) return;
  started = true;
  lastT = performance.now();

  const onFrame = (t: number) => {
    const dt = t - lastT;
    lastT = t;
    if (dt > 0 && dt < 1000) {
      const fps = 1000 / dt;
      emaFps = emaFps * 0.92 + fps * 0.08;
    }
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  // Decision loop — re-evaluate twice a second
  const evaluate = () => {
    const s = useGroove.getState();
    const fps = Math.max(1, Math.min(120, emaFps));
    const target = s.qualityProfile === "AUTO"
      ? decideAuto(fps, s.cpu, s.activeVoices)
      : (s.qualityProfile as QualityLevel);

    // Hysteresis: only step down quickly; require N consecutive frames before stepping up.
    const order: QualityLevel[] = ["LOW", "MEDIUM", "HIGH"];
    const curIdx = order.indexOf(current.level);
    const tgtIdx = order.indexOf(target);

    const prevLevel = current.level;
    if (tgtIdx < curIdx) {
      current = PROFILES[target];
      fpsLowFrames = 0;
    } else if (tgtIdx > curIdx) {
      fpsLowFrames++;
      if (fpsLowFrames >= 4) { // ~2s of sustained headroom
        current = PROFILES[order[curIdx + 1]];
        fpsLowFrames = 0;
      }
    } else {
      fpsLowFrames = 0;
    }

    if (prevLevel !== current.level) {
      listeners.forEach((fn) => { try { fn(current); } catch { /* ignore listener errors */ } });
    }
    if (s.currentQuality !== current.level || Math.abs(s.fps - fps) > 1) {
      useGroove.setState({ currentQuality: current.level, fps: Math.round(fps) });
    }

  };
  setInterval(evaluate, 500);
}