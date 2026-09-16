import { useState, useRef } from "react";
import { Cpu, Pause, Play, Square, Circle, ChevronDown, ChevronUp, Disc3, Volume2, Activity, Gauge } from "lucide-react";
import { useGroove, type QualityMode } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GithubSyncDialog } from "./GithubSyncDialog";
import { setMasterVolume } from "@/lib/audio/engine";
import { tapTempo } from "@/lib/clock/tapTempo";
import { DiagnosticsModal } from "./DiagnosticsModal";
import { useDiagnosticsTrigger } from "@/hooks/useDiagnosticsTrigger";
import { useMeter } from "@/hooks/useMeter";
import { toggleRuntimePlay } from "@/lib/runtime/transport";

const QUALITY_CYCLE: QualityMode[] = ["AUTO", "HIGH", "MEDIUM", "LOW"];

export function TopBar() {
  const {
    bpm, setBpm, cpu, activeVoices, voices, transport, recording, toggleRec,
    selectedPattern, patterns,
    audioReady, masterVolume, setMasterVolume: setMV,
    showDiag, toggleDiag,
    qualityProfile, currentQuality, fps, setQualityProfile,
    resetTransport,
  } = useGroove();
  // ARP controls (mode/complexity) have been moved to the ARP module tab (GROOVE → ARP).
  // They are intentionally not rendered in the TopBar per the canonical one-touch workflow.
  const playheads = useGroove((s) => s.playheads);
  // Meters subscribe to the non-React meter bus → no rerender of TopBar
  // when other UI parts update; only on actual peakL/peakR change @ 10 Hz.
  const peakL = useMeter((s) => s.peakL);
  const peakR = useMeter((s) => s.peakR);
  const diag = useDiagnosticsTrigger();

  // Versteckter 5-Fach-Tap auf die VIBECORE-Schrift → GitHub-Sync-Setup.
  const [ghOpen, setGhOpen] = useState(false);
  const ghTaps = useRef(0);
  const ghTimer = useRef<number | null>(null);
  const onVibeCoreTap = () => {
    ghTaps.current += 1;
    if (ghTimer.current) window.clearTimeout(ghTimer.current);
    ghTimer.current = window.setTimeout(() => { ghTaps.current = 0; }, 1200);
    if (ghTaps.current >= 5) {
      ghTaps.current = 0;
      setGhOpen(true);
    }
  };

  const pat = patterns[transport.currentPattern] ?? patterns[selectedPattern];
  const queued = transport.queuedPattern != null ? patterns[transport.queuedPattern] : null;
  const playing = transport.playing;
  const currentStep = pat ? (playheads.step ?? 0) : 0;
  const currentScene = pat ? (playheads.sceneIdx ?? 0) : 0;
  const patternLen = pat?.scenes[currentScene]?.length ?? 0;

  const handlePlay = async () => {
    await toggleRuntimePlay();
  };

  const onMaster = (v: number) => { setMV(v); setMasterVolume(v); };

  const cycleQuality = () => {
    const i = QUALITY_CYCLE.indexOf(qualityProfile);
    setQualityProfile(QUALITY_CYCLE[(i + 1) % QUALITY_CYCLE.length]);
  };

  const pctL = Math.min(100, peakL * 140);
  const pctR = Math.min(100, peakR * 140);
  const qColor = currentQuality === "HIGH" ? "text-neon-lime"
    : currentQuality === "MEDIUM" ? "text-neon-amber" : "text-neon-crimson";

  return (
    <header className="relative z-20 border-b border-border bg-gradient-surface px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
      <div className="flex items-center gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-2 mr-1 border-r border-border/60">
          <div
            className="relative h-8 w-8 rounded-md bg-gradient-primary grid place-items-center shadow-glow-primary select-none touch-none"
            {...diag.logoHandlers}
            aria-label="VibeCore logo (long-press for diagnostics)"
          >
            <Disc3 className="h-5 w-5 text-primary-foreground pointer-events-none" />
          </div>
          <div className="leading-none">
            <button
              type="button"
              onClick={onVibeCoreTap}
              className="font-display text-[11px] tracking-[0.18em] text-primary select-none cursor-default"
              aria-label="VibeCore"
            >
              VIBECORE
            </button>
            <button
              type="button"
              onClick={diag.onVersionTap}
              className="font-mono text-[9px] text-muted-foreground cursor-pointer select-none"
              aria-label="Version (tap 5× for diagnostics)"
            >
              LIV3 · v1.0
            </button>
          </div>
        </div>

        {/* BPM — LCD screen */}
        <div className="hw-screen px-2.5 py-1.5 flex items-center gap-2 min-w-[88px]">
          <div className="font-mono text-[9px] opacity-70">BPM</div>
          <div className="font-display text-lg tabular-nums leading-none">{bpm.toFixed(1)}</div>
          <div className="flex flex-col -my-1">
            <button onClick={() => setBpm(bpm + 1)} className="h-3.5 w-5 grid place-items-center opacity-70 hover:opacity-100">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={() => setBpm(bpm - 1)} className="h-3.5 w-5 grid place-items-center opacity-70 hover:opacity-100">
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* VibeCore-Sync · Tap-Tempo — median of recent taps → store.bpm */}
        <button
          onClick={() => { const v = tapTempo(); if (v) setBpm(v); }}
          className="hw-screen h-9 min-w-[2.75rem] px-2 grid place-items-center font-display text-[10px] tracking-wider touch-none active:scale-95 transition-transform select-none"
          aria-label="Tap tempo"
          title="Tap tempo"
        >
          TAP
        </button>

        {/* Pattern + step */}
        <div className="panel-inset hidden sm:flex px-2.5 py-1.5 items-center gap-2">
          <div className="font-mono text-[9px] text-muted-foreground">PAT</div>
          <div className="font-display text-sm">{pat.name}</div>
          <div className="font-mono text-[10px] text-primary">{String(currentStep + 1).padStart(2, "0")}/{patternLen}</div>
          {queued && <div className="font-mono text-[9px] text-neon-amber">→ {queued.name}</div>}
        </div>

        <div className="flex-1" />

        {/* Audio ready */}
        <div
          className={cn(
            "panel-inset px-2 py-1 flex items-center gap-1.5 font-mono text-[9px]",
            audioReady ? "text-neon-lime" : "text-muted-foreground"
          )}
          title={audioReady ? "Audio engine running" : "Press play to start audio"}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full glow-dot",
            audioReady ? "bg-neon-lime" : "bg-muted-foreground")} />
          <span className="hidden sm:inline">{audioReady ? "AUDIO READY" : "AUDIO IDLE"}</span>
        </div>

        {/* Master + meters */}
        <div className="panel-inset px-2 py-1.5 flex items-center gap-2">
          <Volume2 className="h-3 w-3 text-primary" />
          <input
            type="range" min={0} max={100} value={masterVolume}
            onChange={(e) => onMaster(Number(e.target.value))}
            className="w-14 sm:w-20 accent-primary h-1"
            aria-label="Master volume"
          />
          <div className="flex flex-col gap-[2px]">
            <div className="h-1 w-12 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pctL}%` }} />
            </div>
            <div className="h-1 w-12 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-accent transition-all" style={{ width: `${pctR}%` }} />
            </div>
          </div>
        </div>

        {/* CPU / Vox */}
        <div className="panel-inset hidden md:flex px-2 py-1.5 items-center gap-2">
          <Cpu className="h-3 w-3 text-primary" />
          <div className="flex flex-col gap-0.5">
            <div className="font-mono text-[8px] text-muted-foreground leading-none">CPU {cpu}%</div>
            <div className="h-1 w-12 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: `${cpu}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="font-mono text-[8px] text-muted-foreground leading-none">VOX {activeVoices}/{voices}</div>
            <div className="h-1 w-12 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-accent" style={{ width: `${Math.min(100, (activeVoices / voices) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Quality / FPS — click to cycle AUTO → HIGH → MEDIUM → LOW */}
        <button
          onClick={cycleQuality}
          className={cn("panel-inset px-2 py-1.5 flex items-center gap-1.5", qColor)}
          title={`Quality: ${qualityProfile}${qualityProfile === "AUTO" ? ` (→ ${currentQuality})` : ""} · ${fps} FPS`}
          aria-label="Cycle quality profile"
        >
          <Gauge className="h-3 w-3" />
          <div className="flex flex-col gap-0.5 leading-none">
            <div className="font-mono text-[8px] text-muted-foreground">
              {qualityProfile === "AUTO" ? `AUTO·${currentQuality}` : qualityProfile}
            </div>
            <div className="font-display text-[10px] tabular-nums">{fps} FPS</div>
          </div>
        </button>

        {/* Diagnostics */}
        <button
          onClick={toggleDiag}
          className={cn(
            "h-9 w-9 rounded-lg grid place-items-center panel-inset",
            showDiag && "neon-border text-primary"
          )}
          title="Toggle diagnostics"
          aria-label="Toggle diagnostics"
        >
          <Activity className="h-4 w-4" />
        </button>

        {/* Transport */}
        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={toggleRec}
            className={cn(
              "h-9 w-9 rounded-lg grid place-items-center panel-inset",
              recording && "neon-border text-neon-crimson animate-pulse-neon"
            )}
          >
            <Circle className={cn("h-4 w-4", recording ? "fill-neon-crimson text-neon-crimson" : "text-muted-foreground")} />
          </button>
          <button
            onClick={handlePlay}
            className={cn(
              "h-9 w-12 rounded-lg grid place-items-center",
              playing ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "panel-inset text-foreground"
            )}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button onClick={() => resetTransport()} className="h-9 w-9 rounded-lg grid place-items-center panel-inset">
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <DiagnosticsModal open={diag.open} onClose={diag.closeModal} />
      <GithubSyncDialog open={ghOpen} onClose={() => setGhOpen(false)} />
    </header>
  );
}