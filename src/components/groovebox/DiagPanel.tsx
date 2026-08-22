import { useEffect, useState } from "react";
import { useGroove, type PsychoPresetName } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Activity, X, Zap } from "lucide-react";
import { getAudioDebugStats, getCtx } from "@/lib/audio/engine";
import { getAudioPerf, resetAudioPerf, type AudioPerf } from "@/lib/audio/audioPerf";
import { getProbeStats, exportRawEvents, type ProbeStats } from "@/lib/audio/audioClockProbe";
import { runStressTest, onStressResult, isStressRunning, type StressTestName, type StressTestResult } from "@/lib/audio/stressTests";
import { runClockTest } from "@/lib/setup/clockTest";
import { getNativeAudioStatus } from "@/lib/audio/nativeAudioRuntime";

const PSYCHO_PRESETS: PsychoPresetName[] = ["NEUTRAL", "WARM", "CRUNCH", "HI_DEF"];
const STRESS_TESTS: { id: StressTestName; label: string }[] = [
  { id: "all-on",    label: "ALL-ON" },
  { id: "polymetric",label: "POLY" },
  { id: "granular",  label: "GRAIN" },
  { id: "ratchets",  label: "RATCH" },
];

export function DiagPanel({ embedded = false }: { embedded?: boolean }) {
  const showDiag = useGroove((s) => s.showDiag);
  const toggleDiag = useGroove((s) => s.toggleDiag);
  const selectedPattern = useGroove((s) => s.selectedPattern);
  const selectedPart = useGroove((s) => s.selectedPart);
  const selectedStep = useGroove((s) => s.selectedStep);
  const patterns = useGroove((s) => s.patterns);
  const parts = useGroove((s) => s.parts);
  const playheads = useGroove((s) => s.playheads);
  const cpu = useGroove((s) => s.cpu);
  const fps = useGroove((s) => s.fps);
  const activeVoices = useGroove((s) => s.activeVoices);
  const voices = useGroove((s) => s.voices);
  const fx = useGroove((s) => s.fx);
  const qualityProfile = useGroove((s) => s.qualityProfile);
  const currentQuality = useGroove((s) => s.currentQuality);
  const psychoPreset = useGroove((s) => s.psychoPreset);
  const setPsychoPreset = useGroove((s) => s.setPsychoPreset);

  const [perf, setPerf] = useState<AudioPerf>(() => getAudioPerf());
  const [probe, setProbe] = useState<ProbeStats>(() => getProbeStats());
  const [stress, setStress] = useState<StressTestResult | null>(null);
  const [busy, setBusy] = useState(isStressRunning());
  const [clockBusy, setClockBusy] = useState(false);

  useEffect(() => {
    // Task 3: UI samples diagnostics at 500 ms, decoupled from rAF/audio cb.
    const id = window.setInterval(() => {
      setPerf(getAudioPerf());
      setProbe(getProbeStats());
    }, 500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => onStressResult((r) => { setStress(r); setBusy(isStressRunning()); }), []);

  if (!embedded && !showDiag) return null;

  const pat = patterns[selectedPattern];
  const part = parts[selectedPart];
  const sceneIdx = playheads.sceneIdx ?? 0;
  const scene = pat?.scenes[sceneIdx];
  const curStep = playheads.step ?? 0;
  const loopCt = playheads.sceneLoop ?? 0;
  const steps = scene?.partSteps[part?.id ?? 0];
  const step = selectedStep !== null && steps ? steps[selectedStep] : null;
  const ctx = getCtx();
  const sr = ctx?.sampleRate ?? 0;
  const state = ctx?.state ?? "idle";
  const fxOn = fx.filter((f) => !f.bypass && f.type).length;
  const dbg = getAudioDebugStats();
  const native = getNativeAudioStatus();

  const row = (k: string, v: string | number, hot?: boolean) => (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground uppercase">{k}</span>
      <span className={cn("font-display tabular-nums", hot ? "text-neon-lime" : "text-primary")}>{v}</span>
    </div>
  );

  const handleStress = async (name: StressTestName) => {
    if (busy) return;
    setBusy(true);
    await runStressTest(name);
    setBusy(false);
  };

  const voiceOverload = activeVoices > 128;
  const grainOverload = perf.grains.peak >= 120;
  const driftOverload = perf.scheduler.avgDriftMs > 5;

  return (
    <div className={cn(
      embedded
        ? "panel p-3 neon-border text-[10px] font-mono"
        : "fixed bottom-20 right-2 z-40 w-[280px] panel p-3 backdrop-blur-md neon-border shadow-glow-primary text-[10px] font-mono max-h-[80vh] overflow-y-auto"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs text-primary flex items-center gap-1.5">
          <Activity className="h-3 w-3" /> DIAGNOSTICS
        </div>
        {!embedded && (
          <button onClick={toggleDiag} className="h-5 w-5 grid place-items-center panel-inset rounded">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {/* Overload banners */}
        {(voiceOverload || grainOverload || driftOverload) && (
          <div className="space-y-0.5">
            {voiceOverload && <div className="text-neon-crimson">⚠ VOICE OVERLOAD ({activeVoices})</div>}
            {grainOverload && <div className="text-neon-crimson">⚠ GRAIN OVERLOAD (peak {perf.grains.peak})</div>}
            {driftOverload && <div className="text-neon-amber">⚠ SCHEDULER DRIFT {perf.scheduler.avgDriftMs.toFixed(1)}ms</div>}
            <div className="hairline" />
          </div>
        )}

        <div className="space-y-0.5">
          {row("AUDIO", state, state === "running")}
          {row("BACKEND", native.available ? "OBOE" : "WEBAUDIO", native.active)}
          {native.available && row("NATIVE", native.error ?? native.diagnostic, !native.error && native.engineRunning)}
          {native.available && row("NATIVE LAT", native.latencyMs >= 0 ? `${native.latencyMs.toFixed(1)} ms` : "n/a")}
          {row("SR", `${sr} Hz`)}
          {row("CPU", `${cpu}%`)}
          {row("VOICES", `${activeVoices}/${voices}`)}
          {row("FX ACTIVE", `${fxOn}/6`)}
        </div>
        <div className="hairline" />

        {/* Scheduler — audio-synchronous probe (jitter/drift/stability vs
            AudioContext clock). Falls back to setInterval-derived values
            until the probe has gathered ≥4 events. */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">scheduler (audio-sync)</div>
          {row("JITTER",     `${probe.jitterMs.toFixed(2)} ms`, probe.jitterMs > 2)}
          {row("DRIFT",      `${probe.driftMsPerMin.toFixed(2)} ms/min`, Math.abs(probe.driftMsPerMin) > 0.5)}
          {row("STABILITY",  `${(probe.stability01 * 100).toFixed(1)} %`, probe.stability01 < 0.95 && probe.eventCount > 10)}
          {row("LATE TICKS", probe.lateTicks, probe.lateTicks > 0)}
          {row("EVENTS",     `${probe.eventCount}/500`)}
          {row("PROBE",      probe.installed ? "ON" : "OFF", probe.installed)}
        </div>
        <div className="hairline" />

        {/* Legacy setInterval drift — kept for comparison only. */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">scheduler (setInterval)</div>
          {row("AVG DRIFT", `${perf.scheduler.avgDriftMs.toFixed(2)} ms`, driftOverload)}
          {row("MAX DRIFT", `${perf.scheduler.maxDriftMs.toFixed(2)} ms`)}
          {row("MISSED",    perf.scheduler.missedTicks, perf.scheduler.missedTicks > 0)}
        </div>
        <div className="hairline" />

        {/* Voices */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">voices</div>
          {row("ACTIVE", perf.voices.active, voiceOverload)}
          {row("PEAK", perf.voices.peak)}
          {row("CREATED/s", perf.voices.createdPerSecond)}
          {row("ENDED/s", perf.voices.destroyedPerSecond)}
          {row("DROPPED", perf.droppedVoices, perf.droppedVoices > 0)}
        </div>
        <div className="hairline" />

        {/* Grains */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">grains</div>
          {row("ACTIVE", perf.grains.active, grainOverload)}
          {row("PEAK", perf.grains.peak)}
          {row("SPAWNED/s", perf.grains.perSecond)}
        </div>
        <div className="hairline" />

        {/* Main thread */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">main thread</div>
          {row("LONG &gt;16ms", perf.longTasks.gt16, perf.longTasks.gt16 > 30)}
          {row("LONG &gt;50ms", perf.longTasks.gt50, perf.longTasks.gt50 > 0)}
          {row("LONG &gt;100ms", perf.longTasks.gt100, perf.longTasks.gt100 > 0)}
          {row("FPS", `${fps}`)}
        </div>
        <div className="hairline" />

        {/* Memory */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">memory</div>
          {row("HEAP", perf.heapMb ? `${perf.heapMb.toFixed(1)} MB` : "n/a")}
          {row("GROWTH", perf.heapGrowthMbPerMin ? `${perf.heapGrowthMbPerMin > 0 ? "+" : ""}${perf.heapGrowthMbPerMin.toFixed(1)} MB/min` : "—",
              perf.heapGrowthMbPerMin > 5)}
        </div>
        <div className="hairline" />

        {/* AudioContext */}
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">audio ctx</div>
          {row("CB LAT", `${(perf.callbackLatencySec * 1000).toFixed(1)} ms`)}
          {row("TICK AVG", `${perf.tickAvgMs.toFixed(2)} ms`)}
          {row("TICK MAX", `${perf.tickMaxMs.toFixed(2)} ms`)}
          {row("XRUNS", perf.xruns, perf.xruns > 0)}
        </div>
        <div className="hairline" />

        {/* Audio debug */}
        <div className="space-y-0.5">
          {row("SAMPLE LOADED", dbg.sampleLoaded ? "YES" : "NO", dbg.sampleLoaded)}
          {row("GRAN ACTIVE", dbg.granularActive ? "YES" : "NO", dbg.granularActive)}
          {row("FREEZE ACTIVE", dbg.freezeActive ? "YES" : "NO", dbg.freezeActive)}
          {row("AUDIO NODES", dbg.audioNodes)}
          {row("CPU MODE", `${qualityProfile}→${currentQuality}`)}
          {row("BUFFER CACHE", dbg.bufferCache)}
        </div>
        <div className="hairline" />

        {/* Stress tests */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-muted-foreground uppercase flex items-center gap-1">
              <Zap className="h-3 w-3" /> stress tests
            </span>
            <button
              onClick={resetAudioPerf}
              className="text-[8px] panel-inset rounded px-1.5 py-0.5 text-muted-foreground hover:text-primary"
            >RESET</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {STRESS_TESTS.map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => handleStress(t.id)}
                className={cn(
                  "h-6 rounded text-[9px] font-display uppercase tracking-wide transition",
                  busy ? "panel-inset text-muted-foreground/50"
                       : "panel-inset text-muted-foreground hover:text-primary",
                )}
              >{t.label}</button>
            ))}
          </div>
          {busy && <div className="text-neon-amber">running… (≈6s)</div>}
          {stress && !busy && (
            <div className="panel-inset px-2 py-1 space-y-0.5">
              <div className="flex justify-between"><span>last</span><span className="text-primary">{stress.name}</span></div>
              <div className="flex justify-between"><span>peak vox</span><span>{stress.perf.voices.peak}</span></div>
              <div className="flex justify-between"><span>peak grain</span><span>{stress.perf.grains.peak}</span></div>
              <div className="flex justify-between"><span>late tk</span><span>{stress.perf.scheduler.lateTicks}</span></div>
              <div className="flex justify-between"><span>xruns</span><span>{stress.perf.xruns}</span></div>
              {stress.notes.map((n, i) => (
                <div key={i} className="text-muted-foreground text-[8px]">· {n}</div>
              ))}
            </div>
          )}
        </div>

        <div className="hairline" />

        {/* Clock test + raw export (Tasks 4, 6, 7) */}
        <div className="space-y-1">
          <div className="text-muted-foreground uppercase">audio clock test</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              disabled={clockBusy}
              onClick={async () => {
                setClockBusy(true);
                try { await runClockTest(2000, "1/16"); }
                finally { setClockBusy(false); setProbe(getProbeStats()); }
              }}
              className={cn(
                "h-6 rounded text-[9px] font-display uppercase tracking-wide transition",
                clockBusy ? "panel-inset text-muted-foreground/50"
                          : "panel-inset text-muted-foreground hover:text-primary",
              )}
            >{clockBusy ? "RUNNING…" : "RUN CLOCK TEST"}</button>
            <button
              onClick={() => {
                const data = exportRawEvents();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `scheduler-events-${Date.now()}.json`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="h-6 rounded text-[9px] font-display uppercase tracking-wide panel-inset text-muted-foreground hover:text-primary"
            >EXPORT EVENTS</button>
          </div>
        </div>

        <div className="hairline" />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground uppercase">psycho preset</span>
            <span className="font-display tabular-nums text-primary">{psychoPreset}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PSYCHO_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPsychoPreset(p)}
                className={cn(
                  "h-6 rounded text-[9px] font-display uppercase tracking-wide transition",
                  psychoPreset === p
                    ? "bg-primary text-primary-foreground shadow-glow-primary"
                    : "panel-inset text-muted-foreground hover:text-primary",
                )}
              >
                {p === "HI_DEF" ? "HI-DEF" : p}
              </button>
            ))}
          </div>
        </div>
        <div className="hairline" />

        <div className="space-y-0.5">
          {row("PATTERN", pat?.name ?? "—")}
          {row("PART SCENE", scene ? `${scene.length} steps` : "—")}
          {row("TRACK", part ? `${part.id + 1} · ${part.name}` : "—")}
          {row("SAMPLE", part?.sampleName ?? "—")}
          {row("PLAY HEAD", `step ${curStep + 1} · loop ${loopCt}`)}
        </div>
        <div className="hairline" />
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase">selected step</div>
          {step ? (
            <>
              {row("IDX", selectedStep! + 1)}
              {row("ON", step.on ? "YES" : "NO")}
              {row("VEL", step.velocity)}
              {row("PROB", `${step.probability}%`)}
              {row("GATE", step.gate)}
              {row("MICRO", step.micro)}
              {row("RATCH", step.ratchet)}
              {row("ACCENT", step.accent ? "YES" : "NO")}
              {row("COND", step.condition ?? "—")}
            </>
          ) : (
            <div className="text-muted-foreground">no step selected</div>
          )}
        </div>
      </div>
    </div>
  );
}
