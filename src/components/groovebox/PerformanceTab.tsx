import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Play, Pause, Square, Zap, Sliders, Grid3x3,
} from "lucide-react";
import { useMeter, useVisibleParts } from "@/hooks/useMeter";
import { toggleRuntimePlay } from "@/lib/runtime/transport";

export function PerformanceTab() {
  const {
    patterns, transport, selectedPattern, selectPattern, queuePattern,
    playheads, bpm,
    parts,
    seekTo, selectSceneIdx, selectedSceneIdx,
  } = useGroove();

  const pat = patterns[transport.currentPattern] ?? patterns[selectedPattern];
  const scene = pat?.scenes[Math.min(selectedSceneIdx, (pat?.scenes.length ?? 1) - 1)];
  const playing = transport.playing;
  const curStep = playheads.step ?? 0;
  const sceneLen = scene?.length ?? 16;
  const visibleIds = parts.map((p) => p.id);
  useVisibleParts(visibleIds);

  const handlePlay = async () => {
    await toggleRuntimePlay();
  };

  const onClipTap = (i: number) => {
    if (playing) queuePattern(i);
    else selectPattern(i);
  };

  // ── Macros ──────────────────────────────────────────────────────────────
  const [macros, setMacros] = useState({ filter: 80, reverb: 0, delay: 0, drive: 0 });

  const applyMacro = (key: keyof typeof macros, v: number) => {
    setMacros((m) => ({ ...m, [key]: v }));
    const st = useGroove.getState();
    if (key === "filter") st.parts.forEach((p) => st.setChannel(p.id, { lpCut: v }));
    if (key === "reverb") st.parts.forEach((p) => st.setSend(p.id, 2, v));
    if (key === "delay") st.parts.forEach((p) => st.setSend(p.id, 1, v));
    if (key === "drive") st.parts.forEach((p) => st.setChannel(p.id, { drive: v }));
  };

  return (
    <div className="space-y-3">
      {/* Transport bar */}
      <div className="panel p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlay}
            className={cn(
              "h-12 w-16 rounded-lg grid place-items-center shrink-0",
              playing ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "panel-inset text-foreground",
            )}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            onClick={() => useGroove.getState().resetTransport()}
            className="h-12 w-12 rounded-lg grid place-items-center panel-inset shrink-0"
          >
            <Square className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="hw-screen px-3 py-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm text-primary truncate">{pat?.name ?? "—"}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                SCN {String.fromCharCode(65 + (playheads.sceneIdx ?? 0))} · {curStep + 1}/{sceneLen} · {bpm.toFixed(1)} BPM
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1 w-full bg-surface-0 rounded mt-1 overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${((curStep + 1) / sceneLen) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pattern clip grid */}
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2 flex items-center gap-1.5">
          <Grid3x3 className="h-3.5 w-3.5" /> PATTERN CLIPS · {patterns.length}
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto no-scrollbar">
          {patterns.map((p, i) => {
            const isCur = transport.currentPattern === i;
            const isQueued = transport.queuedPattern === i;
            return (
              <button
                key={p.id}
                onClick={() => onClipTap(i)}
                className={cn(
                  "aspect-square rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform",
                  isCur && playing && "text-neon-lime neon-border",
                  isCur && !playing && "neon-border text-primary",
                  isQueued && "text-neon-amber",
                )}
              >
                <span className="font-mono text-[7px] text-muted-foreground">{String(p.id + 1).padStart(3, "0")}</span>
                <span className="font-display text-[8px] truncate w-full text-center leading-tight px-0.5">{p.name}</span>
                <span className="font-mono text-[6px] text-muted-foreground">{p.scenes.length}sc</span>
              </button>
            );
          })}
        </div>
        <div className="font-mono text-[8px] text-muted-foreground mt-1.5">
          {playing ? "TAP TO QUEUE · SWITCH AT NEXT BAR" : "TAP TO SELECT"}
        </div>
      </div>

      {/* Scene trigger pads */}
      {pat && pat.scenes.length > 1 && (
        <div className="panel p-3">
          <div className="font-display text-xs text-primary mb-2">SCENE TRIGGERS</div>
          <div className="hairline mb-2" />
          <div className="grid grid-cols-8 gap-1">
            {pat.scenes.map((sc, i) => {
              const isCur = (playheads.sceneIdx ?? 0) === i && transport.currentPattern === selectedPattern;
              return (
                <button
                  key={sc.id}
                  onClick={() => { seekTo(i, 0); selectSceneIdx(i); }}
                  className={cn(
                    "h-12 rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95",
                    isCur ? "neon-border text-neon-lime" : "text-muted-foreground",
                  )}
                >
                  <span className="font-display text-sm">{String.fromCharCode(65 + i)}</span>
                  <span className="font-mono text-[7px]">{sc.length}st</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Macros + Live Mixer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Macros */}
        <div className="panel p-3">
          <div className="font-display text-xs text-primary mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> MACROS
          </div>
          <div className="hairline mb-2" />
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: "filter" as const, label: "FLT", color: "neon-cyan" },
              { key: "reverb" as const, label: "REV", color: "neon-magenta" },
              { key: "delay" as const, label: "DLY", color: "neon-violet" },
              { key: "drive" as const, label: "DRV", color: "neon-amber" },
            ]).map(({ key, label, color }) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <div className="font-mono text-[8px] text-muted-foreground">{label}</div>
                <div className={cn("relative h-24 w-8 panel-inset rounded overflow-hidden")}>
                  <div
                    className="absolute inset-x-0 bottom-0"
                    style={{ height: `${macros[key]}%`, background: `hsl(var(--${color}))` }}
                  />
                  <input
                    type="range" min={0} max={100} value={macros[key]}
                    onChange={(e) => applyMacro(key, Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
                  />
                </div>
                <div className="font-mono text-[8px] text-primary">{macros[key]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Mini Mixer */}
        <div className="panel p-3">
          <div className="font-display text-xs text-primary mb-2 flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> LIVE MIXER · {parts.length} CH
          </div>
          <div className="hairline mb-2" />
          <div className="no-scrollbar overflow-x-auto -mx-2 px-2">
            <div className="flex gap-1.5 min-w-max">
              {parts.map((p) => (
                <LiveChannel key={p.id} partId={p.id} part={p} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveChannel({ partId, part }: {
  partId: number;
  part: ReturnType<typeof useGroove.getState>["parts"][number];
}) {
  const peak = useMeter((s) => s.partPeaks[partId] ?? 0);
  const { setPartVolume, toggleMute, toggleSolo } = useGroove();
  return (
    <div className="w-12 shrink-0 panel-inset rounded p-1 flex flex-col items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: `hsl(var(--${part.color}))` }} />
      <span className="font-mono text-[7px] text-muted-foreground truncate w-full text-center">{part.name}</span>
      <div className="relative h-16 w-4 bg-surface-0 rounded overflow-hidden shrink-0">
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${part.volume}%`, background: "var(--gradient-primary)" }}
        />
        <input
          type="range" min={0} max={100} value={part.volume}
          onChange={(e) => setPartVolume(partId, Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
        />
      </div>
      <div className="flex gap-0.5 w-full">
        <button
          onClick={() => toggleMute(partId)}
          className={cn("flex-1 h-5 rounded text-[8px] font-mono", part.mute ? "bg-neon-crimson text-primary-foreground" : "panel-inset text-muted-foreground")}
        >M</button>
        <button
          onClick={() => toggleSolo(partId)}
          className={cn("flex-1 h-5 rounded text-[8px] font-mono", part.solo ? "bg-neon-amber text-background" : "panel-inset text-muted-foreground")}
        >S</button>
      </div>
    </div>
  );
}
