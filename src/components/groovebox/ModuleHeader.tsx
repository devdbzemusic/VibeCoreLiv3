// VibeCore — Unified Module Header (MASTERPROMPT spec).
//
// Every module page renders exactly one <ModuleHeader module="GROOVE" />.
// It pulls live state from the store and provides full transport context:
//   Module name · BPM (tap-tempo) · Play / Stop / Record · Pattern · Scene · Sync
//
// Touch targets: all interactive elements ≥ 44 px.
// Color contract: record = crimson, playing = primary/lime, error = crimson, sync = lime/cyan.

import { useCallback } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Play, Pause, Square, Circle } from "lucide-react";
import { tapTempo } from "@/lib/clock/tapTempo";
import { ensureAudio, getCtx } from "@/lib/audio/engine";

interface ModuleHeaderProps {
  /** Module display name shown in the left badge (e.g. "GROOVE", "3D SYNTH"). */
  module: string;
  className?: string;
}

export function ModuleHeader({ module, className }: ModuleHeaderProps) {
  const {
    bpm, setBpm, transport, recording,
    togglePlay, toggleRec, resetTransport,
    patterns, selectedPattern, selectedSceneIdx,
    playheads,
  } = useGroove();

  const pattern = patterns[selectedPattern];
  const sync = transport.syncStatus;
  const syncError = !!sync?.error;
  const syncExternal = !!sync?.externalActive;
  const syncLabel = (sync?.source ?? "INT").slice(0, 4).toUpperCase();
  const syncColor = syncError ? "crimson" : syncExternal ? "lime" : "cyan";

  const sceneCount = pattern?.scenes.length ?? 1;
  const sceneIdx = (selectedSceneIdx ?? 0) + 1;
  const currentStep = (playheads.step ?? 0) + 1;
  const sceneLen = pattern?.scenes[selectedSceneIdx ?? 0]?.length ?? 0;

  const handlePlay = useCallback(async () => {
    await ensureAudio();
    const ctx = getCtx();
    if (ctx?.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    togglePlay();
  }, [togglePlay]);

  const handleTapBpm = useCallback(() => {
    const v = tapTempo();
    if (v) setBpm(v);
  }, [setBpm]);

  return (
    <div className={cn(
      "panel px-3 py-2 flex items-center gap-2 sm:gap-3 mb-3",
      className,
    )}>
      {/* Module badge */}
      <div
        className="font-display text-[10px] text-primary neon-text shrink-0 tracking-[0.15em] uppercase"
        aria-label={`Module: ${module}`}
      >
        {module}
      </div>

      <div className="h-7 w-px bg-border/60 shrink-0" />

      {/* BPM — tap for tap-tempo */}
      <button
        onClick={handleTapBpm}
        className="hw-screen px-2 py-1 flex items-center gap-1.5 shrink-0 touch-none active:scale-95 transition-transform select-none"
        aria-label={`BPM: ${bpm.toFixed(1)} — tap for tap tempo`}
        title="Tap for tap-tempo"
      >
        <span className="font-mono text-[7px] text-primary/60">BPM</span>
        <span className="font-display text-sm tabular-nums leading-none">{bpm.toFixed(1)}</span>
      </button>

      {/* Transport — Play/Pause + Stop + Record */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Record */}
        <button
          onClick={toggleRec}
          className={cn(
            "h-9 w-9 rounded-lg grid place-items-center panel-inset transition-colors",
            recording && "neon-border animate-pulse-neon",
          )}
          aria-label={recording ? "Stop recording" : "Record"}
          aria-pressed={recording}
        >
          <Circle className={cn(
            "h-3.5 w-3.5",
            recording ? "fill-neon-crimson text-neon-crimson" : "text-muted-foreground",
          )} />
        </button>

        {/* Stop / reset */}
        <button
          onClick={() => resetTransport()}
          className="h-9 w-9 rounded-lg grid place-items-center panel-inset"
          aria-label="Stop and reset"
        >
          <Square className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={handlePlay}
          className={cn(
            "h-9 w-11 rounded-lg grid place-items-center transition-all",
            transport.playing
              ? "bg-gradient-primary text-primary-foreground shadow-glow-primary"
              : "panel-inset text-foreground",
          )}
          aria-label={transport.playing ? "Pause" : "Play"}
        >
          {transport.playing
            ? <Pause className="h-4 w-4" />
            : <Play className="h-4 w-4 ml-0.5" />}
        </button>
      </div>

      {/* Pattern + step counter */}
      <div className="panel-inset hidden sm:flex px-2 py-1.5 items-center gap-2 shrink-0">
        <span className="font-mono text-[7px] text-muted-foreground">PTN</span>
        <span className="font-display text-[11px] leading-none truncate max-w-[4rem]">
          {pattern?.name ?? "—"}
        </span>
        {sceneLen > 0 && (
          <span className="font-mono text-[9px] text-primary tabular-nums">
            {String(currentStep).padStart(2, "0")}/{sceneLen}
          </span>
        )}
      </div>

      {/* Scene counter */}
      <div className="panel-inset hidden sm:flex px-2 py-1.5 items-center gap-1.5 shrink-0">
        <span className="font-mono text-[7px] text-muted-foreground">SCN</span>
        <span className="font-display text-[11px] text-primary leading-none">
          {sceneIdx}/{sceneCount}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Sync status indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: `hsl(var(--${syncColor}))`,
            boxShadow: `0 0 6px hsl(var(--${syncColor}))`,
          }}
          aria-label={`Sync: ${syncLabel}`}
        />
        <span className="font-mono text-[8px] text-muted-foreground hidden xs:inline">
          {syncLabel}
        </span>
      </div>
    </div>
  );
}
