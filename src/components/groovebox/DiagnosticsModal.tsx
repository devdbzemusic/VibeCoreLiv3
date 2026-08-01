import React, { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Activity, Download, FileText, Zap, Database, ListTree, Bug, Share2, Timer } from "lucide-react";
import { runTimingValidation, type TimingReport } from "@/lib/audio/patternTimingValidator";

// ============================================================
// All diagnostic APIs are attached to `window` by other modules.
// We access them via `unknown` cast so this file doesn't fight
// the existing global type declarations.
// ============================================================
type ApiName =
  | "runAudioDiagnostics"
  | "downloadAudioDiagnostics"
  | "exportFullDiagnostics"
  | "exportLongTasks"
  | "exportSchedulerEvents"
  | "dumpAudioGraph"
  | "dumpAudioGraphDetailed"
  | "__vibeAudioCtx";

const W = (): Record<string, unknown> => window as unknown as Record<string, unknown>;
const getApi = <T = (...args: unknown[]) => unknown>(name: ApiName): T | undefined => {
  const fn = W()[name];
  return typeof fn === "function" ? (fn as T) : undefined;
};
const has = (name: ApiName): boolean => typeof W()[name] === "function";


// ============================================================
// Live metrics shape (everything optional – read defensively)
// ============================================================
export interface LiveMetrics {
  ctxState: string;
  currentTime: number;
  jitterP95Ms: number | null;
  driftMaxMsPerMin: number | null;
  stabilityPct: number | null;
  lateTicks: number | null;
  xruns: number | null;
  totalLive: number | null;
  growthRatePerMin: number | null;
  suspectedLeaks: number | null;
  heapDeltaMB: number | null;
  longTasksCount: number | null;
}

const EMPTY: LiveMetrics = {
  ctxState: "—",
  currentTime: 0,
  jitterP95Ms: null,
  driftMaxMsPerMin: null,
  stabilityPct: null,
  lateTicks: null,
  xruns: null,
  totalLive: null,
  growthRatePerMin: null,
  suspectedLeaks: null,
  heapDeltaMB: null,
  longTasksCount: null,
};

// Heap baseline – measured once, used for delta only.
let heapBaseline: number | null = null;
const readHeapMB = (): number | null => {
  // Chrome-only API.
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (!mem || typeof mem.usedJSHeapSize !== "number") return null;
  return mem.usedJSHeapSize / (1024 * 1024);
};

// Pull metrics from the global APIs. Uses AudioContext.currentTime for
// audio timing – never performance.now().
function sampleMetrics(): LiveMetrics {
  const out: LiveMetrics = { ...EMPTY };

  try {
    const getCtx = getApi<() => AudioContext | null | undefined>("__vibeAudioCtx");
    const ctx = getCtx?.();
    if (ctx) {
      out.ctxState = ctx.state;
      out.currentTime = ctx.currentTime;
    }
  } catch { /* ignore */ }

  try {
    const fn = getApi<(limit?: number) => unknown>("exportSchedulerEvents");
    const raw = fn?.(0) as
      | { summary?: { p95DeltaMs?: number; driftMsPerMin?: number; stabilityPct?: number; lateTicks?: number; xrunsTotal?: number } }
      | undefined;
    const s = raw?.summary;
    if (s) {
      out.jitterP95Ms = s.p95DeltaMs ?? null;
      out.driftMaxMsPerMin = s.driftMsPerMin ?? null;
      out.stabilityPct = s.stabilityPct ?? null;
      out.lateTicks = s.lateTicks ?? null;
      out.xruns = s.xrunsTotal ?? null;
    }
  } catch { /* ignore */ }

  try {
    const fn = getApi<() => unknown>("dumpAudioGraph");
    const g = fn?.() as
      | { totalLive?: number; growthRatePerMinute?: number; suspectedLeaks?: unknown[] }
      | undefined;
    if (g) {
      out.totalLive = g.totalLive ?? null;
      out.growthRatePerMin = g.growthRatePerMinute ?? null;
      out.suspectedLeaks = Array.isArray(g.suspectedLeaks) ? g.suspectedLeaks.length : null;
    }
  } catch { /* ignore */ }

  try {
    const heap = readHeapMB();
    if (heap != null) {
      if (heapBaseline == null) heapBaseline = heap;
      out.heapDeltaMB = heap - heapBaseline;
    }
  } catch { /* ignore */ }

  try {
    const fn = getApi<() => unknown>("exportLongTasks");
    const lt = fn?.() as unknown[] | { entries?: unknown[] } | undefined;
    if (Array.isArray(lt)) out.longTasksCount = lt.length;
    else if (lt && Array.isArray((lt as { entries?: unknown[] }).entries)) {
      out.longTasksCount = (lt as { entries: unknown[] }).entries.length;
    }
  } catch { /* ignore */ }

  return out;

}

// ============================================================
// Share / download helper. Uses Web Share API when available
// (Android), falls back to a download anchor.
// ============================================================
async function shareJson(filename: string, payload: unknown): Promise<void> {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  try {
    const file = new File([blob], filename, { type: "application/json" });
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "VibeCore Diagnostics" });
      return;
    }
  } catch { /* fall through */ }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// UI bits
// ============================================================
interface RowProps { label: string; value: string; tone?: "ok" | "warn" | "bad" | "mute" }
const Row = memo(function Row({ label, value, tone = "mute" }: RowProps) {
  const color =
    tone === "ok" ? "text-neon-lime"
    : tone === "warn" ? "text-neon-amber"
    : tone === "bad" ? "text-neon-crimson"
    : "text-muted-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-border/40 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] tabular-nums ${color}`}>{value}</span>
    </div>
  );
});

interface BtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}
const Btn = memo(function Btn({ icon, label, onClick, disabled, busy }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-md panel-inset text-left font-mono text-[11px] ${
        disabled ? "opacity-40" : "hover:neon-border active:scale-[0.99]"
      }`}
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      {disabled && <span className="text-[9px] text-neon-crimson">unsupported</span>}
      {busy && <span className="text-[9px] text-neon-amber animate-pulse">running…</span>}
    </button>
  );
});

// ============================================================
// Main modal
// ============================================================
interface Props { open: boolean; onClose: () => void }

function DiagnosticsModalImpl({ open, onClose }: Props) {
  const [metrics, setMetrics] = useState<LiveMetrics>(EMPTY);
  const [busyMode, setBusyMode] = useState<null | "scheduler" | "full" | "timing">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastTiming, setLastTiming] = useState<TimingReport | null>(null);
  const timerRef = useRef<number | null>(null);

  // 1Hz polling – starts only when modal is open, fully cleaned up on close.
  useEffect(() => {
    if (!open) return;
    setMetrics(sampleMetrics());
    const id = window.setInterval(() => setMetrics(sampleMetrics()), 1000);
    timerRef.current = id;
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const runDiag = useCallback(async (mode: "scheduler" | "full") => {
    const fn = getApi<(d: number, o: { mode: "scheduler" | "full" }) => unknown>("runAudioDiagnostics");
    if (!fn) return;
    try {
      setBusyMode(mode);
      showToast(`Running ${mode} diagnostics (120s)…`);
      await fn(120, { mode });
      showToast(`${mode} diagnostics complete`);
    } catch (e) {
      showToast(`Diagnostics failed: ${(e as Error)?.message ?? "unknown"}`);
    } finally {
      setBusyMode(null);
    }
  }, [showToast]);

  const runTiming = useCallback(async () => {
    try {
      setBusyMode("timing");
      showToast("Validating timing at 120 BPM (10 s)…");
      const report = await runTimingValidation(10);
      setLastTiming(report);
      showToast(`Timing ${report.classification}: grid p95 ${report.gridError.p95Ms} ms`);
    } catch (e) {
      showToast(`Timing test failed: ${(e as Error)?.message ?? "unknown"}`);
    } finally {
      setBusyMode(null);
    }
  }, [showToast]);

  const shareTiming = useCallback(async () => {
    if (!lastTiming) return;
    await shareJson(`vibecore-timing-${Date.now()}.json`, lastTiming);
    showToast("Timing report exported");
  }, [lastTiming, showToast]);

  const callAndShare = useCallback(async (
    apiName: ApiName,
    filename: string,
    arg?: number,
  ) => {
    const fn = getApi<(a?: number) => unknown>(apiName);
    if (!fn) return;
    try {
      const payload = await fn(arg);
      if (payload !== undefined) {
        await shareJson(filename, payload);
        showToast(`Exported ${filename}`);
      } else {
        showToast(`${apiName} executed`);
      }
    } catch (e) {
      showToast(`Export failed: ${(e as Error)?.message ?? "unknown"}`);
    }
  }, [showToast]);

  const downloadFull = useCallback(() => {
    const fn = getApi<() => unknown>("downloadAudioDiagnostics");
    if (!fn) return;
    try {
      fn();
      showToast("downloadAudioDiagnostics() invoked");
    } catch (e) {
      showToast(`Failed: ${(e as Error)?.message ?? "unknown"}`);
    }
  }, [showToast]);


  // Capability flags – evaluated at render so toggling extensions
  // is reflected without remounting.
  const caps = useMemo(() => ({
    runDiag: has("runAudioDiagnostics"),
    download: has("downloadAudioDiagnostics"),
    dump: has("dumpAudioGraph"),
    dumpDetailed: has("dumpAudioGraphDetailed"),
    longTasks: has("exportLongTasks"),
    schedEvents: has("exportSchedulerEvents"),
  }), [open]); // re-evaluate each open

  if (!open) return null;

  const m = metrics;
  const fmt = (v: number | null, digits = 2, unit = "") =>
    v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}${unit}`;
  const stabilityTone =
    m.stabilityPct == null ? "mute" : m.stabilityPct >= 95 ? "ok" : m.stabilityPct >= 80 ? "warn" : "bad";
  const jitterTone =
    m.jitterP95Ms == null ? "mute" : m.jitterP95Ms <= 2 ? "ok" : m.jitterP95Ms <= 5 ? "warn" : "bad";
  const leaksTone =
    m.suspectedLeaks == null ? "mute" : m.suspectedLeaks === 0 ? "ok" : m.suspectedLeaks < 3 ? "warn" : "bad";

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-stretch justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="VibeCore Diagnostics"
    >
      <div
        className="relative w-full max-w-md h-full sm:h-auto sm:my-auto sm:max-h-[90vh] bg-gradient-surface border border-border sm:rounded-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-0/60">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <div className="font-display text-sm tracking-wider">VibeCore Diagnostics</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-md panel-inset"
            aria-label="Close diagnostics"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live metrics */}
          <section>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Live Metrics (1 Hz)</div>
            <div className="panel-inset px-3 py-2 rounded-md">
              <Row label="ctx.state" value={m.ctxState} tone={m.ctxState === "running" ? "ok" : "warn"} />
              <Row label="ctx.currentTime" value={fmt(m.currentTime, 3, "s")} />
              <Row label="Jitter p95" value={fmt(m.jitterP95Ms, 2, " ms")} tone={jitterTone} />
              <Row label="Drift max" value={fmt(m.driftMaxMsPerMin, 2, " ms/min")} />
              <Row label="Stability" value={fmt(m.stabilityPct, 1, " %")} tone={stabilityTone} />
              <Row label="Late Ticks" value={m.lateTicks == null ? "—" : String(m.lateTicks)} tone={m.lateTicks ? "warn" : "ok"} />
              <Row label="XRUNS" value={m.xruns == null ? "—" : String(m.xruns)} tone={m.xruns ? "bad" : "ok"} />
              <Row label="totalLive nodes" value={m.totalLive == null ? "—" : String(m.totalLive)} />
              <Row label="Growth /min" value={fmt(m.growthRatePerMin, 2, " nodes")} />
              <Row label="Suspected leaks" value={m.suspectedLeaks == null ? "—" : String(m.suspectedLeaks)} tone={leaksTone} />
              <Row label="Heap Δ" value={fmt(m.heapDeltaMB, 2, " MB")} />
              <Row label="Long Tasks" value={m.longTasksCount == null ? "—" : String(m.longTasksCount)} />
            </div>
          </section>

          {/* Actions */}
          <section className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Run Tests</div>
            <Btn
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Scheduler Test (120 s)"
              onClick={() => runDiag("scheduler")}
              disabled={!caps.runDiag}
              busy={busyMode === "scheduler"}
            />
            <Btn
              icon={<Bug className="h-3.5 w-3.5" />}
              label="Full Test (120 s)"
              onClick={() => runDiag("full")}
              disabled={!caps.runDiag}
              busy={busyMode === "full"}
            />
            <Btn
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Validate Timing (120 BPM · 10 s)"
              onClick={runTiming}
              busy={busyMode === "timing"}
            />
            {lastTiming && (
              <div className="panel-inset px-3 py-2 rounded-md space-y-1">
                <Row label="Timing" value={lastTiming.classification} tone={lastTiming.pass ? "ok" : "bad"} />
                <Row label="Samples" value={String(lastTiming.sampleCount)} />
                <Row label="Step expected" value={`${lastTiming.expectedStepMs} ms`} />
                <Row label="Grid err p95" value={`${lastTiming.gridError.p95Ms} ms`} tone={lastTiming.gridError.p95Ms <= 1.5 ? "ok" : "warn"} />
                <Row label="Grid err max" value={`${lastTiming.gridError.maxMs} ms`} />
                <Row label="Audio jitter p95" value={`${lastTiming.audioJitterP95} ms`} tone={lastTiming.audioJitterP95 <= 5 ? "ok" : lastTiming.audioJitterP95 <= 10 ? "warn" : "bad"} />
                <Row label="Audio jitter max" value={`${lastTiming.audioJitterMax} ms`} />
                <Row label="Scheduler late" value={String(lastTiming.schedulerLateEvents)} tone={lastTiming.schedulerLateEvents === 0 ? "ok" : "bad"} />
                <Row label="xruns" value={String(lastTiming.xruns)} tone={lastTiming.xruns === 0 ? "ok" : "bad"} />
                <Row label="Callback p95*" value={`${lastTiming.observedJitter.p95Ms} ms`} />
                <div className="text-[9px] opacity-60 leading-tight pt-1">
                  * callback = (observedAt − scheduledFor): audio-thread quantum latency (AudioWorklet probe). Use audio jitter / xruns for audio quality.
                </div>
                <button
                  onClick={shareTiming}
                  className="mt-1 w-full px-2 py-1 rounded panel-inset font-mono text-[10px] hover:neon-border"
                >Export timing report</button>
              </div>
            )}

          </section>

          <section className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Inspect</div>
            <Btn
              icon={<Database className="h-3.5 w-3.5" />}
              label="Audio Graph"
              onClick={() => callAndShare("dumpAudioGraph", `vibecore-audiograph-${Date.now()}.json`)}
              disabled={!caps.dump}
            />
            <Btn
              icon={<ListTree className="h-3.5 w-3.5" />}
              label="Audio Graph Detailed (100)"
              onClick={() => callAndShare("dumpAudioGraphDetailed", `vibecore-audiograph-detailed-${Date.now()}.json`, 100)}
              disabled={!caps.dumpDetailed}
            />
          </section>

          <section className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Export</div>
            <Btn
              icon={<Download className="h-3.5 w-3.5" />}
              label="Export Diagnostics (download)"
              onClick={downloadFull}
              disabled={!caps.download}
            />
            <Btn
              icon={<Share2 className="h-3.5 w-3.5" />}
              label="Export Long Tasks"
              onClick={() => callAndShare("exportLongTasks", `vibecore-longtasks-${Date.now()}.json`)}
              disabled={!caps.longTasks}
            />
            <Btn
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Export Scheduler Events (10 000)"
              onClick={() => callAndShare("exportSchedulerEvents", `vibecore-scheduler-${Date.now()}.json`, 10000)}
              disabled={!caps.schedEvents}
            />
          </section>

          <div className="pt-2 pb-4 text-[9px] font-mono text-muted-foreground text-center">
            Polling: 1 Hz · UI decoupled from scheduler · Audio timing via AudioContext.currentTime
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-4 left-4 right-4 px-3 py-2 rounded-md bg-surface-0/95 border border-primary/60 font-mono text-[10px] text-center shadow-glow-primary">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export const DiagnosticsModal = memo(DiagnosticsModalImpl);