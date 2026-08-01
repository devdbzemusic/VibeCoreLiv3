// VibeCoreLiv3 — Production-grade audio diagnostics framework.
//
// Pure measurement / reporting only. Does NOT modify the scheduler, audio
// engine, transport, DSP, or sequencer. Composes existing instrumentation:
//
//   - audioGraphDebug : per-node lifecycle tracking (WeakRef)
//   - audioClockProbe : audio-synchronous scheduler events + xrun counter
//   - audioPerf       : long-task / heap / FPS counters
//
// Public surface (all installed on `window`):
//
//   window.runAudioDiagnostics(durationSec?, opts?)  → Promise<Report>
//   window.downloadAudioDiagnostics()                — JSON download
//   window.exportFullDiagnostics()                   — same payload, return
//   window.exportLongTasks()                         — grouped long-tasks
//   window.exportSchedulerEvents(limit?)             — events + summary
//   window.dumpAudioGraph()                          — graph snapshot
//   window.dumpAudioGraphDetailed(limit?)            — recent node list
//
// Long-task collector installs automatically at module import.

import { getCtx } from "./engine";
import {
  exportRawEvents,
  getEventSummary,
  resetProbe,
  type SchedEvent,
  type EventSummary,
} from "./audioClockProbe";

// ── Long-task collector with attribution ──────────────────────────────────
interface LongTaskRec {
  startTime: number;
  duration: number;
  attribution: string;
  group: string;
}
const longTaskLog: LongTaskRec[] = [];
const LT_MAX = 2000;
let ltObserver: PerformanceObserver | null = null;

function classifyLongTask(attribution: string): string {
  const a = attribution.toLowerCase();
  if (a.includes("react") || a.includes("scheduler")) return "React render";
  if (a.includes("canvas") || a.includes("visual") || a.includes("meter"))
    return "Canvas rendering";
  if (a.includes("diag")) return "Diagnostics panel";
  if (a.includes("audio") || a.includes("graph") || a.includes("scheduler"))
    return "Audio graph updates";
  return "Unknown";
}

export function installLongTaskCollector(): void {
  if (ltObserver || typeof PerformanceObserver === "undefined") return;
  try {
    ltObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const attrs = (e as PerformanceEntry & {
          attribution?: Array<{
            name?: string;
            containerType?: string;
            containerName?: string;
            containerSrc?: string;
          }>;
        }).attribution;
        let attribution = "Unknown";
        if (attrs && attrs.length) {
          const x = attrs[0];
          attribution =
            x.containerName || x.containerSrc || x.containerType || x.name || "Unknown";
        }
        const rec: LongTaskRec = {
          startTime: Math.round(e.startTime),
          duration: Math.round(e.duration * 100) / 100,
          attribution,
          group: classifyLongTask(attribution),
        };
        if (longTaskLog.length >= LT_MAX) longTaskLog.shift();
        longTaskLog.push(rec);
      }
    });
    ltObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    /* unsupported */
  }
}

export interface LongTaskExport {
  total: number;
  groups: Record<string, number>;
  gt50: number;
  gt100: number;
  entries: LongTaskRec[];
}

export function exportLongTasks(): LongTaskExport {
  const groups: Record<string, number> = {};
  let gt50 = 0;
  let gt100 = 0;
  for (const r of longTaskLog) {
    groups[r.group] = (groups[r.group] || 0) + 1;
    if (r.duration > 50) gt50++;
    if (r.duration > 100) gt100++;
  }
  return { total: longTaskLog.length, groups, gt50, gt100, entries: longTaskLog.slice() };
}

// ── Report types ──────────────────────────────────────────────────────────
export interface AudioCfg {
  sampleRate: number;
  baseLatency: number | null;
  outputLatency: number | null;
  state: AudioContextState;
}

export interface NodeDelta {
  type: string;
  start: number;
  end: number;
  delta: number;
}

export interface SuspectedLeak {
  type: string;
  created: number;
  live: number;
  growthRatePerMinute: number;
}

export interface DiagnosticsReport {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  mode: "scheduler" | "full";
  audioContext: AudioCfg | null;
  audioGraph: {
    initial: unknown;
    midpoint: unknown;
    final: unknown;
    delta: {
      totalLive: { start: number; end: number; delta: number };
      totalCreated: { start: number; end: number; delta: number };
      perType: NodeDelta[];
    } | null;
    suspectedLeaks: SuspectedLeak[];
  };
  scheduler: EventSummary;
  performance: {
    longTasks50ms: number;
    longTasks100ms: number;
    avgFps: number;
    minFps: number;
    avgFrameTimeMs: number;
  };
  memory: {
    initialHeapMb: number | null;
    finalHeapMb: number | null;
    deltaHeapMb: number | null;
    samples: number[];
  };
  longTasks: LongTaskRec[];
  rawSchedulerEvents: SchedEvent[];
  recommendation: string[];
}

let lastReport: DiagnosticsReport | null = null;

function heapMb(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return m ? Math.round((m.usedJSHeapSize / (1024 * 1024)) * 10) / 10 : null;
}

interface GraphLike {
  totalLive: number;
  totalCreated: number;
  byType: { live: Record<string, number>; created: Record<string, number> };
}

function diffGraph(a: GraphLike | null, b: GraphLike | null) {
  if (!a || !b) return null;
  const types = new Set<string>([...Object.keys(a.byType.live), ...Object.keys(b.byType.live)]);
  const perType: NodeDelta[] = [];
  for (const t of types) {
    const s = a.byType.live[t] || 0;
    const e = b.byType.live[t] || 0;
    perType.push({ type: t, start: s, end: e, delta: e - s });
  }
  perType.sort((x, y) => y.delta - x.delta);
  return {
    totalLive: { start: a.totalLive, end: b.totalLive, delta: b.totalLive - a.totalLive },
    totalCreated: {
      start: a.totalCreated,
      end: b.totalCreated,
      delta: b.totalCreated - a.totalCreated,
    },
    perType,
  };
}

const WATCHED_LEAK_TYPES = [
  "Gain",
  "Oscillator",
  "BufferSource",
  "BiquadFilter",
  "Analyser",
  "ConstantSource",
];

function detectLeaks(
  initial: GraphLike | null,
  final: GraphLike | null,
  minutes: number
): SuspectedLeak[] {
  if (!initial || !final || minutes <= 0) return [];
  const out: SuspectedLeak[] = [];
  for (const t of Object.keys(final.byType.live)) {
    const start = initial.byType.live[t] || 0;
    const end = final.byType.live[t] || 0;
    const grew = end - start;
    if (grew < 5) continue;
    const watched =
      WATCHED_LEAK_TYPES.some((w) => t.startsWith(w)) || t.startsWith("AudioWorkletNode");
    if (!watched) continue;
    out.push({
      type: t,
      created: final.byType.created[t] || 0,
      live: end,
      growthRatePerMinute: Math.round((grew / minutes) * 10) / 10,
    });
  }
  return out.sort((a, b) => b.growthRatePerMinute - a.growthRatePerMinute);
}

export interface RunOpts {
  mode?: "scheduler" | "full";
}

export async function runAudioDiagnostics(
  durationSec = 120,
  opts: RunOpts = {}
): Promise<DiagnosticsReport> {
  installLongTaskCollector();
  const mode = opts.mode ?? "full";
  const ctx = getCtx();
  const audioCtx: AudioCfg | null = ctx
    ? {
        sampleRate: ctx.sampleRate,
        baseLatency:
          (ctx as AudioContext & { baseLatency?: number }).baseLatency ?? null,
        outputLatency:
          (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? null,
        state: ctx.state,
      }
    : null;

  // Cheap snapshot helper.
  const dump = (): GraphLike | null => {
    const fn = (window as Window & { dumpAudioGraph?: () => GraphLike }).dumpAudioGraph;
    return fn ? fn() : null;
  };

  const initialGraph = dump();
  const initialHeap = heapMb();
  const startedAt = performance.now();
  const ltStartCount = longTaskLog.length;
  resetProbe(); // clear ring buffer for a clean window

  // FPS sampler (lightweight, 1 Hz aggregation).
  const fpsSamples: number[] = [];
  let frames = 0;
  let lastSec = performance.now();
  let running = true;
  let rafId = 0;
  const loop = () => {
    frames++;
    const t = performance.now();
    if (t - lastSec >= 1000) {
      fpsSamples.push(frames);
      frames = 0;
      lastSec = t;
    }
    if (running) rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  // Heap polling @ 5 s (no audio-graph polling — only start/mid/end).
  const heapSamples: number[] = [];
  const heapTimer = setInterval(() => {
    const h = heapMb();
    if (h !== null) heapSamples.push(h);
  }, 5000);

  // Midpoint graph snapshot.
  let midGraph: GraphLike | null = null;
  const midTimer = setTimeout(
    () => {
      midGraph = dump();
    },
    Math.max(1, durationSec * 500) // half of duration in ms
  );

  // Wait the requested window.
  await new Promise<void>((resolve) => setTimeout(resolve, durationSec * 1000));

  running = false;
  cancelAnimationFrame(rafId);
  clearInterval(heapTimer);
  clearTimeout(midTimer);

  const finalGraph = dump();
  const finalHeap = heapMb();
  const rawEvents = exportRawEvents();
  const schedSummary = getEventSummary();
  const ltSince = longTaskLog.slice(ltStartCount);
  const lt50 = ltSince.filter((e) => e.duration > 50).length;
  const lt100 = ltSince.filter((e) => e.duration > 100).length;
  const minFps = fpsSamples.length ? Math.min(...fpsSamples) : 0;
  const avgFps = fpsSamples.length
    ? fpsSamples.reduce((s, v) => s + v, 0) / fpsSamples.length
    : 0;

  const delta = diffGraph(initialGraph, finalGraph);
  const minutes = durationSec / 60;
  const suspectedLeaks = detectLeaks(initialGraph, finalGraph, minutes);

  const recommendation: string[] = [];
  if (schedSummary.classification === "CRITICAL")
    recommendation.push(
      `CRITICAL scheduler: p95 ${schedSummary.p95DeltaMs} ms — audio thread cannot keep up.`
    );
  else if (schedSummary.classification === "WARNING")
    recommendation.push(`WARNING scheduler: p95 ${schedSummary.p95DeltaMs} ms.`);
  if (schedSummary.xruns > 0)
    recommendation.push(
      `XRUNs detected: ${schedSummary.xruns} (scheduledFor < scheduledAt at queue time).`
    );
  if (lt100 > 0)
    recommendation.push(
      `Long tasks >100 ms: ${lt100} — main thread blocking, will cause dropouts.`
    );
  if (suspectedLeaks.length)
    recommendation.push(
      `Suspected audio node leaks: ${suspectedLeaks.map((l) => `${l.type}(+${l.growthRatePerMinute}/min)`).join(", ")}`
    );
  if (
    finalHeap !== null &&
    initialHeap !== null &&
    finalHeap - initialHeap > 50
  )
    recommendation.push(
      `Heap grew ${(finalHeap - initialHeap).toFixed(1)} MB over ${durationSec}s — possible memory leak.`
    );
  if (mode === "scheduler" && finalGraph && finalGraph.totalLive > (initialGraph?.totalLive ?? 0))
    recommendation.push(
      "Mode=scheduler but audio nodes grew during run — engine appears active."
    );
  if (!recommendation.length) recommendation.push("No abnormalities detected.");

  const report: DiagnosticsReport = {
    startedAt,
    endedAt: performance.now(),
    durationSec,
    mode,
    audioContext: audioCtx,
    audioGraph: {
      initial: initialGraph,
      midpoint: midGraph,
      final: finalGraph,
      delta,
      suspectedLeaks,
    },
    scheduler: schedSummary,
    performance: {
      longTasks50ms: lt50,
      longTasks100ms: lt100,
      avgFps: Math.round(avgFps),
      minFps,
      avgFrameTimeMs: avgFps ? Math.round((1000 / avgFps) * 10) / 10 : 0,
    },
    memory: {
      initialHeapMb: initialHeap,
      finalHeapMb: finalHeap,
      deltaHeapMb:
        finalHeap !== null && initialHeap !== null
          ? Math.round((finalHeap - initialHeap) * 10) / 10
          : null,
      samples: heapSamples,
    },
    longTasks: ltSince,
    rawSchedulerEvents: rawEvents,
    recommendation,
  };

  lastReport = report;
  // Console summary — fast scan.
  // eslint-disable-next-line no-console
  console.log(
    `[diagnostics] ${mode} ${durationSec}s — scheduler ${schedSummary.classification} (p95=${schedSummary.p95DeltaMs}ms, xruns=${schedSummary.xruns}), longTasks>50ms=${lt50}, leaks=${suspectedLeaks.length}, minFps=${minFps}`
  );
  if (suspectedLeaks.length) console.warn("[diagnostics] leaks:", suspectedLeaks);
  return report;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function exportFullDiagnostics(): DiagnosticsReport | null {
  return lastReport;
}

export function downloadAudioDiagnostics(): void {
  if (!lastReport) {
    // eslint-disable-next-line no-console
    console.warn("[diagnostics] no report yet — call window.runAudioDiagnostics() first");
    return;
  }
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vibecore-diagnostics-${timestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

declare global {
  interface Window {
    runAudioDiagnostics: typeof runAudioDiagnostics;
    downloadAudioDiagnostics: typeof downloadAudioDiagnostics;
    exportFullDiagnostics: typeof exportFullDiagnostics;
    exportLongTasks: typeof exportLongTasks;
  }
}

export function installDiagnosticsGlobals(): void {
  if (typeof window === "undefined") return;
  window.runAudioDiagnostics = runAudioDiagnostics;
  window.downloadAudioDiagnostics = downloadAudioDiagnostics;
  window.exportFullDiagnostics = exportFullDiagnostics;
  window.exportLongTasks = exportLongTasks;
  installLongTaskCollector();
}

// Eagerly install long-task collector & globals on import.
installDiagnosticsGlobals();
