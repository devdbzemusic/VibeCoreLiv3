// VibeCore UI Architect — Unified Module Header.
//
// Every module page shares this identical Kopfbereich (master prompt spec):
//   Modulname · BPM · Transport · Pattern · Scene · Synchronisationsstatus
// Hardware-style compact strip, no desktop metaphors, touch targets ≥40px.

import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Play, Pause } from "lucide-react";

export function ModuleHeader({ moduleName }: { moduleName: string }) {
  const { bpm, transport, togglePlay, patterns, selectedPattern, selectedSceneIdx } = useGroove();
  const pattern = patterns[selectedPattern];
  const sync = transport.syncStatus;
  const syncColor = sync?.error ? "crimson" : sync?.externalActive ? "lime" : "cyan";

  return (
    <div className="panel p-2 flex items-center gap-2 sm:gap-3">
      <div className="font-display text-sm text-primary neon-text shrink-0 tracking-wider">{moduleName}</div>
      <div className="h-8 w-px bg-border shrink-0" />

      <div className="flex flex-col items-center leading-none shrink-0">
        <span className="font-mono text-[7px] text-muted-foreground tracking-widest">BPM</span>
        <span className="font-display text-sm text-primary mt-0.5">{bpm}</span>
      </div>

      <button onClick={togglePlay}
        className={cn("h-10 w-10 rounded-full grid place-items-center touch-none shrink-0",
          transport.playing ? "bg-primary/15 text-primary neon-border" : "panel-inset text-muted-foreground")}
        aria-label={transport.playing ? "pause" : "play"}>
        {transport.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <div className="flex flex-col items-center leading-none shrink-0 min-w-0">
        <span className="font-mono text-[7px] text-muted-foreground tracking-widest">PTN</span>
        <span className="font-display text-[11px] mt-0.5 truncate max-w-[5rem]">{pattern?.name ?? "—"}</span>
      </div>

      <div className="flex flex-col items-center leading-none shrink-0">
        <span className="font-mono text-[7px] text-muted-foreground tracking-widest">SCN</span>
        <span className="font-display text-[11px] text-primary mt-0.5">
          {(selectedSceneIdx ?? 0) + 1}/{pattern?.scenes.length ?? 1}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <span className="h-2 w-2 rounded-full"
          style={{ background: `hsl(var(--${syncColor}))`, boxShadow: `0 0 6px hsl(var(--${syncColor}))` }} />
        <span className="font-mono text-[8px] text-muted-foreground uppercase">
          {(sync?.source ?? "internal").slice(0, 4)}
        </span>
      </div>
    </div>
  );
}