// VibeCoreLiv3 — Audio graph instrumentation (window.dumpAudioGraph).
//
// Wraps AudioContext.create* factory methods to track every node ever
// created and every node that has been GC-collected (via WeakRef). Exposes:
//
//   window.dumpAudioGraph()         — counts by node type + active/created
//   window.dumpAudioGraphDetailed() — last N nodes with createdAt + targets
//   window.exportSchedulerEvents()  — last 500 scheduler events as JSON
//
// All of these are zero-cost when not called: the wrapper only bumps two
// counters per node and stores a WeakRef so retained nodes can be diagnosed.

import { getCtx, getAudioDebugStats } from "./engine";
import { exportRawEvents, getEventSummary, type SchedEvent, type EventSummary } from "./audioClockProbe";
import { installDiagnosticsGlobals } from "./runAudioDiagnostics";

// Minimal WeakRef typing fallback for environments where lib.es2021.weakref is
// not yet picked up by the editor/build pipeline.
type WeakRefCtor = new <T extends object>(target: T) => { deref(): T | undefined };
const WeakRefImpl: WeakRefCtor = (globalThis as unknown as { WeakRef: WeakRefCtor }).WeakRef;
type WRef<T extends object> = { deref(): T | undefined };

interface NodeRecord {
  type: string;
  createdAt: number;          // ms since context start
  ref: WRef<AudioNode>;
  targets: WRef<AudioNode>[];
}

const records: NodeRecord[] = [];
const MAX_RECORDS = 4000;
let recordsHead = 0;          // ring-buffer write cursor (avoids O(n) shift)
const created: Record<string, number> = Object.create(null);
let installedCtx: AudioContext | null = null;
let ctxStartMs = 0;

const FACTORY_METHODS = [
  "createOscillator",
  "createGain",
  "createBiquadFilter",
  "createDelay",
  "createAnalyser",
  "createBufferSource",
  "createConstantSource",
  "createConvolver",
  "createDynamicsCompressor",
  "createPanner",
  "createStereoPanner",
  "createWaveShaper",
  "createChannelMerger",
  "createChannelSplitter",
  "createIIRFilter",
  "createScriptProcessor",
  "createPeriodicWave",
] as const;

function classify(method: string): string {
  return method.replace(/^create/, "");
}

function record(type: string, node: AudioNode): void {
  created[type] = (created[type] || 0) + 1;
  const rec: NodeRecord = {
    type,
    createdAt: performance.now() - ctxStartMs,
    ref: new WeakRefImpl(node),
    targets: [],
  };
  if (records.length < MAX_RECORDS) {
    records.push(rec);
  } else {
    records[recordsHead] = rec;
    recordsHead = (recordsHead + 1) % MAX_RECORDS;
  }
  // Wrap connect() to remember edges.
  const origConnect = node.connect.bind(node) as AudioNode["connect"];
  (node as AudioNode).connect = function (dest: AudioNode | AudioParam, ...rest: unknown[]) {
    if (dest instanceof AudioNode) rec.targets.push(new WeakRefImpl(dest));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origConnect as any)(dest, ...rest);
  } as AudioNode["connect"];
}

/** Install graph instrumentation on the live AudioContext. Idempotent. */
export function installAudioGraphDebug(ctx: AudioContext): void {
  if (installedCtx === ctx) return;
  installedCtx = ctx;
  ctxStartMs = performance.now();
  for (const m of FACTORY_METHODS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = Object.getPrototypeOf(ctx) as any;
    const orig = (ctx as unknown as Record<string, unknown>)[m] ?? proto?.[m];
    if (typeof orig !== "function") continue;
    const bound = (orig as (...a: unknown[]) => AudioNode).bind(ctx);
    (ctx as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
      const node = bound(...args);
      try { record(classify(m), node); } catch { /* ignore */ }
      return node;
    };
  }
  // AudioWorkletNode is constructed with `new`, not a factory — patch the
  // constructor on the global so we still count worklets.
  try {
    const W = window.AudioWorkletNode;
    if (W && !(W as unknown as { __patched?: boolean }).__patched) {
      const Patched = function (this: AudioWorkletNode, c: BaseAudioContext, name: string, opts?: AudioWorkletNodeOptions) {
        const inst = new W(c, name, opts);
        try { record("AudioWorkletNode:" + name, inst); } catch { /* ignore */ }
        return inst;
      } as unknown as typeof AudioWorkletNode;
      (Patched as unknown as { __patched: boolean }).__patched = true;
      Patched.prototype = W.prototype;
      window.AudioWorkletNode = Patched;
    }
  } catch { /* ignore */ }
}

function liveCounts() {
  const live: Record<string, number> = Object.create(null);
  let alive = 0;
  for (const r of records) {
    if (r.ref.deref()) { live[r.type] = (live[r.type] || 0) + 1; alive++; }
  }
  return { live, alive };
}

interface SuspectedLeak {
  type: string;
  created: number;
  live: number;
  growthRatePerMinute: number;
}

interface GraphSummary {
  audioNodes: {
    oscillators: number;
    gains: number;
    filters: number;
    analyzers: number;
    worklets: number;
    sources: number;
    others: number;
  };
  activeVoices: number;
  activeGrains: number;
  totalLive: number;
  totalCreated: number;
  byType: { live: Record<string, number>; created: Record<string, number> };
  contextState: AudioContextState | "none";
  contextTimeSec: number;
  suspectedLeaks: SuspectedLeak[];
}

// Baseline live-counts captured shortly after install (~5 s grace) used for
// continuous leak watch. Updated never again — diff is start-of-session vs now.
const baselineLive: Record<string, number> = Object.create(null);
let baselineAt = 0;
let baselineCaptured = false;
const WATCHED = ["Gain", "Oscillator", "BufferSource", "BiquadFilter", "Analyser", "ConstantSource"];

function captureBaseline(): void {
  if (baselineCaptured) return;
  const { live } = liveCounts();
  for (const k of Object.keys(live)) baselineLive[k] = live[k];
  baselineAt = performance.now();
  baselineCaptured = true;
}

function computeLeaks(live: Record<string, number>): SuspectedLeak[] {
  if (!baselineCaptured) return [];
  const stats = getAudioDebugStats();
  // Leak heuristic: live count grew AND no active voices.
  if (stats.playbackActive) return [];
  const minutes = Math.max(0.01, (performance.now() - baselineAt) / 60_000);
  const out: SuspectedLeak[] = [];
  for (const t of Object.keys(live)) {
    const start = baselineLive[t] || 0;
    const end = live[t];
    const grew = end - start;
    if (grew < 5) continue;
    const watched = WATCHED.some((w) => t.startsWith(w)) || t.startsWith("AudioWorkletNode");
    if (!watched) continue;
    out.push({
      type: t,
      created: created[t] || 0,
      live: end,
      growthRatePerMinute: Math.round((grew / minutes) * 10) / 10,
    });
  }
  return out.sort((a, b) => b.growthRatePerMinute - a.growthRatePerMinute);
}

function summary(): GraphSummary {
  const { live, alive } = liveCounts();
  const stats = getAudioDebugStats();
  const get = (k: string) => live[k] || 0;
  const filters = get("BiquadFilter") + get("IIRFilter");
  const sources = get("BufferSource") + get("ConstantSource") + get("PeriodicWave");
  const worklets = Object.entries(live)
    .filter(([k]) => k.startsWith("AudioWorkletNode"))
    .reduce((s, [, v]) => s + v, 0);
  const known = ["Oscillator", "Gain", "BiquadFilter", "IIRFilter", "Analyser",
    "BufferSource", "ConstantSource", "PeriodicWave"];
  const others = Object.entries(live)
    .filter(([k]) => !known.includes(k) && !k.startsWith("AudioWorkletNode"))
    .reduce((s, [, v]) => s + v, 0);
  const ctx = installedCtx;
  return {
    audioNodes: {
      oscillators: get("Oscillator"),
      gains: get("Gain"),
      filters,
      analyzers: get("Analyser"),
      worklets,
      sources,
      others,
    },
    activeVoices: stats.playbackActive ? 1 : 0,
    activeGrains: 0,
    totalLive: alive,
    totalCreated: Object.values(created).reduce((s, v) => s + v, 0),
    byType: { live, created: { ...created } },
    contextState: ctx ? ctx.state : "none",
    contextTimeSec: ctx ? ctx.currentTime : 0,
    suspectedLeaks: computeLeaks(live),
  };
}

function detailed(limit = 200) {
  const out: { type: string; createdAt: number; alive: boolean; targets: string[] }[] = [];
  // Reconstruct chronological order from the ring buffer before slicing.
  const ordered = records.length < MAX_RECORDS
    ? records
    : records.slice(recordsHead).concat(records.slice(0, recordsHead));
  const recent = ordered.slice(-limit);
  for (const r of recent) {
    const node = r.ref.deref();
    const targets: string[] = [];
    for (const tref of r.targets) {
      const t = tref.deref();
      targets.push(t ? t.constructor.name : "<gc'd>");
    }
    out.push({
      type: r.type,
      createdAt: Math.round(r.createdAt),
      alive: !!node,
      targets,
    });
  }
  return out;
}

interface ExportedEvents {
  summary: EventSummary;
  events: SchedEvent[];
}

function exportEventsWithSummary(limit?: number): ExportedEvents {
  const s = getEventSummary(limit);
  // Console banner so the classification is obvious without inspecting fields.
  // eslint-disable-next-line no-console
  console.log(
    `[scheduler] ${s.classification} — events=${s.totalEvents} p95=${s.p95DeltaMs}ms median=${s.medianDeltaMs}ms max=${s.maxDeltaMs}ms stdDev=${s.stdDevMs}ms xruns=${s.xruns}`
  );
  return { summary: s, events: exportRawEvents(limit) };
}

declare global {
  interface Window {
    dumpAudioGraph: () => GraphSummary;
    dumpAudioGraphDetailed: (limit?: number) => ReturnType<typeof detailed>;
    exportSchedulerEvents: (limit?: number) => ExportedEvents;
    __vibeAudioCtx: () => AudioContext | null;
  }
}

/** Install the global window helpers exactly once. */
export function exposeAudioGraphGlobals(): void {
  if (typeof window === "undefined") return;
  window.dumpAudioGraph = summary;
  window.dumpAudioGraphDetailed = detailed;
  window.exportSchedulerEvents = exportEventsWithSummary;
  window.__vibeAudioCtx = () => getCtx();
  installDiagnosticsGlobals();
  // Capture leak baseline 5 s after exposure (lets engine finish wiring).
  setTimeout(captureBaseline, 5000);
}