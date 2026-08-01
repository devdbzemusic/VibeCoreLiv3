import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Copy, ClipboardPaste, ChevronLeft, ChevronRight, Play,
} from "lucide-react";
import { MAX_SCENES_PER_PATTERN, SCENE_LENGTHS } from "@/lib/model";
import type { SceneLength } from "@/lib/model";

export function SceneManager() {
  const {
    patterns, selectedPattern, selectedSceneIdx, selectSceneIdx,
    addScene, removeScene, setSceneLength,
    copyScene, pasteScene, duplicateScene, moveScene,
    transport, seekTo,
  } = useGroove();

  const playheads = useGroove((s) => s.playheads);
  const pattern = patterns[selectedPattern];
  if (!pattern) return null;
  const scenes = pattern.scenes;
  const isPlaying = transport.playing && transport.currentPattern === selectedPattern;

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs text-primary">
          {pattern.name} · SCENES {scenes.length}/{MAX_SCENES_PER_PATTERN}
        </div>
        <button
          onClick={() => { const i = addScene(pattern.id, 16); if (i != null) selectSceneIdx(i); }}
          disabled={scenes.length >= MAX_SCENES_PER_PATTERN}
          className="h-7 px-2 rounded panel-inset font-mono text-[10px] flex items-center gap-1 text-primary disabled:opacity-30 touch-none"
        >
          <Plus className="h-3 w-3" /> ADD
        </button>
      </div>
      <div className="hairline mb-2" />

      {/* Scene strip */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {scenes.map((sc, i) => {
          const sel = i === selectedSceneIdx;
          const playing = isPlaying && playheads.sceneIdx === i;
          return (
            <div key={sc.id} className={cn(
              "shrink-0 w-20 rounded-md panel-inset p-1.5 flex flex-col gap-1",
              sel && "neon-border",
            )}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => selectSceneIdx(i)}
                  className={cn(
                    "font-display text-sm leading-none",
                    playing ? "text-neon-lime" : sel ? "text-primary" : "text-muted-foreground",
                  )}
                >{String.fromCharCode(65 + i)}</button>
                {playing && <span className="h-1.5 w-1.5 rounded-full bg-neon-lime glow-dot animate-pulse" />}
              </div>

              {/* Length selector */}
              <select
                value={sc.length}
                onChange={(e) => setSceneLength(pattern.id, i, Number(e.target.value) as SceneLength)}
                className="h-7 px-1 rounded panel-inset font-mono text-[9px] bg-transparent text-primary outline-none"
              >
                {SCENE_LENGTHS.map((L) => (
                  <option key={L} value={L} className="bg-background">{L}st</option>
                ))}
              </select>

              {/* Per-scene actions */}
              <div className="grid grid-cols-3 gap-0.5">
                <ScBtn onClick={() => copyScene(pattern.id, i)} aria-label="copy"><Copy className="h-2.5 w-2.5" /></ScBtn>
                <ScBtn onClick={() => pasteScene(pattern.id, i)} aria-label="paste" disabled={scenes.length >= MAX_SCENES_PER_PATTERN}><ClipboardPaste className="h-2.5 w-2.5" /></ScBtn>
                <ScBtn onClick={() => duplicateScene(pattern.id, i)} aria-label="dup" disabled={scenes.length >= MAX_SCENES_PER_PATTERN}><Copy className="h-2.5 w-2.5" /></ScBtn>
                <ScBtn onClick={() => moveScene(pattern.id, i, i - 1)} aria-label="left" disabled={i === 0}><ChevronLeft className="h-2.5 w-2.5" /></ScBtn>
                <ScBtn onClick={() => { seekTo(i, 0); selectSceneIdx(i); }} aria-label="trigger"><Play className="h-2.5 w-2.5" /></ScBtn>
                <ScBtn onClick={() => moveScene(pattern.id, i, i + 1)} aria-label="right" disabled={i === scenes.length - 1}><ChevronRight className="h-2.5 w-2.5" /></ScBtn>
              </div>

              {/* Delete */}
              {scenes.length > 1 && (
                <button
                  onClick={() => removeScene(pattern.id, i)}
                  className="h-5 rounded bg-neon-crimson/80 grid place-items-center text-primary-foreground"
                  aria-label="delete scene"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Step / loop info */}
      <div className="flex items-center gap-3 mt-2 font-mono text-[9px] text-muted-foreground">
        <span>STEP {playheads.step ?? 0}</span>
        <span>LOOP {playheads.sceneLoop ?? 0}</span>
        <span>TICKS {playheads.songTicks ?? 0}</span>
      </div>
    </div>
  );
}

function ScBtn({ children, onClick, disabled, ...rest }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-5 rounded panel-inset grid place-items-center text-muted-foreground disabled:opacity-30 active:scale-90 touch-none"
      {...rest}
    >{children}</button>
  );
}