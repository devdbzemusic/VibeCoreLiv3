import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PartStrip } from "./PartStrip";
import { ChannelStrip } from "./ChannelStrip";
import { Dices, Sparkles, Zap, Plus, X } from "lucide-react";
import { SCENE_LENGTHS, MAX_SCENES_PER_PATTERN } from "@/lib/model";
import type { SceneLength, Step } from "@/lib/model";

type EditMode = "TRIG" | "VEL" | "PROB" | "GATE" | "RATCH" | "MICRO" | "ACC";

const EDIT_MODES: { key: EditMode; label: string }[] = [
  { key: "TRIG", label: "TRIG" },
  { key: "VEL", label: "VEL" },
  { key: "PROB", label: "PROB" },
  { key: "GATE", label: "GATE" },
  { key: "RATCH", label: "RAT" },
  { key: "MICRO", label: "μ" },
  { key: "ACC", label: "ACC" },
];

const COND_PRESETS = ["—", "1:2", "1:4", "2:4", "3:4", "FILL", "!FILL", "PRE", "NEI"];

export function SeqTab() {
  const {
    patterns, selectedPattern, selectedSceneIdx, selectSceneIdx,
    transport, selectedPart, parts,
    selectedStep, selectStep,
    toggleStep, updateStep, setSwing, setSceneLength,
    addScene, removeScene,
  } = useGroove();
  const [mode, setMode] = useState<EditMode>("TRIG");

  const pattern = patterns[selectedPattern];
  if (!pattern) return null;
  const part = parts[selectedPart];
  if (!part) return null;
  const sceneIdx = Math.min(selectedSceneIdx, pattern.scenes.length - 1);
  const scene = pattern.scenes[sceneIdx];
  if (!scene) return null;
  const steps = scene.partSteps[part.id] ?? [];

  const playheads = useGroove((s) => s.playheads);
  const isPlayingThis = transport.playing && transport.currentPattern === selectedPattern;
  const isQueuedHere = transport.queuedPattern != null && transport.queuedPattern === selectedPattern;
  const isPlayingThisScene = isPlayingThis && playheads.sceneIdx === sceneIdx;
  const curStep = playheads.step ?? 0;

  const handleStep = (idx: number) => {
    if (mode === "TRIG") toggleStep(part.id, idx);
    selectStep(idx);
  };

  const selStep = selectedStep !== null && selectedStep < steps.length ? steps[selectedStep] : null;

  return (
    <div className="space-y-3">
      <PartStrip />

      {/* Pattern + Scene chain header */}
      <div className="panel p-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">
            {pattern.name} · {part.name} · SCENE {sceneIdx + 1}/{pattern.scenes.length} · {scene.length} STEPS
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            {isQueuedHere && <span className="text-neon-amber">QUEUED</span>}
            <span>LOOP {playheads.sceneLoop ?? 0}</span>
          </div>
        </div>
        <div className="hairline mb-2" />

        {/* Scene chain selector */}
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap mb-2">
          <span className="text-muted-foreground">SCENES</span>
          <div className="flex gap-1 flex-wrap">
            {pattern.scenes.map((sc, i) => (
              <div key={sc.id} className="relative">
                <button
                  onClick={() => selectSceneIdx(i)}
                  className={cn(
                    "h-10 min-w-[3rem] px-2 rounded panel-inset font-display text-xs",
                    i === sceneIdx ? "neon-border text-primary" : "text-muted-foreground",
                    isPlayingThis && playheads.sceneIdx === i && "text-neon-lime",
                  )}
                >{String.fromCharCode(65 + i)}·{sc.length}</button>
                {pattern.scenes.length > 1 && i === sceneIdx && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeScene(pattern.id, i); }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-neon-crimson grid place-items-center"
                    aria-label="remove scene"
                  ><X className="h-2.5 w-2.5 text-primary-foreground" /></button>
                )}
              </div>
            ))}
            {pattern.scenes.length < MAX_SCENES_PER_PATTERN && (
              <button
                onClick={() => { const i = addScene(pattern.id, 16); if (i != null) selectSceneIdx(i); }}
                className="h-10 w-10 rounded panel-inset grid place-items-center text-primary"
                aria-label="add scene"
              ><Plus className="h-3 w-3" /></button>
            )}
          </div>
        </div>

        {/* Scene length + swing */}
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="text-muted-foreground">LEN</span>
          <select
            value={scene.length}
            onChange={(e) => setSceneLength(pattern.id, sceneIdx, Number(e.target.value) as SceneLength)}
            className="h-10 px-2 rounded panel-inset font-display text-xs text-primary bg-transparent neon-border"
            aria-label="scene step length"
          >
            {SCENE_LENGTHS.map((L) => (
              <option key={L} value={L} className="bg-background text-primary">{L} STEPS</option>
            ))}
          </select>
          <div className="h-7 w-px bg-border mx-1" />
          <span className="text-muted-foreground">SWING</span>
          <input
            type="range" min={50} max={75} value={pattern.swing}
            onChange={(e) => setSwing(Number(e.target.value))}
            className="flex-1 min-w-[80px] accent-primary"
          />
          <span className="font-display text-primary w-8 text-right">{pattern.swing}%</span>
          <button className="h-10 px-2 rounded panel-inset flex items-center gap-1 text-muted-foreground hover:text-primary">
            <Dices className="h-3 w-3" /> RND
          </button>
        </div>
      </div>

      {/* Edit-mode selector */}
      <div className="grid grid-cols-7 gap-1">
        {EDIT_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "h-11 rounded-md panel-inset font-mono text-[11px] transition-all",
              mode === m.key ? "neon-border text-primary" : "text-muted-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Step grid */}
      <div className="panel p-2.5 relative scanline">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full glow-dot" style={{ color: `hsl(var(--${part.color}))`, background: `hsl(var(--${part.color}))` }} />
            <span className="font-display text-xs">{part.name}</span>
            <span className="font-mono text-[9px] text-muted-foreground">{scene.length}st</span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">{mode}</span>
        </div>

        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(scene.length, 16)}, minmax(0, 1fr))` }}
        >
          {steps.map((s: Step, idx: number) => {
            const isBar = Math.floor(idx / 4) % 2 === 0;
            const valHeight =
              mode === "VEL" ? s.velocity :
              mode === "PROB" ? s.probability :
              mode === "GATE" ? Math.min(100, s.gate / 2) :
              0;
            const isPlaying = isPlayingThisScene && curStep === idx;
            return (
              <button
                key={idx}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  handleStep(idx);
                }}
                className={cn(
                  "step-cell aspect-square select-none flex flex-col items-center justify-end p-0.5 touch-none",
                  !isBar && "opacity-95",
                  selectedStep === idx && "neon-border"
                )}
                data-active={s.on}
                data-accent={s.accent}
                data-playing={isPlaying}
              >
                {mode !== "TRIG" && s.on && (
                  <div
                    className="w-full rounded-sm pointer-events-none"
                    style={{
                      height: `${Math.max(8, valHeight)}%`,
                      background: "hsl(var(--primary-foreground) / 0.85)",
                    }}
                  />
                )}
                <span className={cn(
                  "absolute top-0.5 left-0.5 font-mono text-[8px] pointer-events-none",
                  s.on ? "text-primary-foreground/70" : "text-muted-foreground/60"
                )}>{idx + 1}</span>
                {s.ratchet > 1 && <Zap className="absolute top-0.5 right-0.5 h-2 w-2 text-neon-amber pointer-events-none" />}
                {s.condition && (
                  <span className="absolute bottom-0.5 right-0.5 font-mono text-[7px] text-neon-cyan pointer-events-none">{s.condition}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ChannelStrip />

      {/* Step detail editor */}
      <div className={cn("panel p-3 transition-all", selStep ? "opacity-100" : "opacity-60")}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> STEP DETAILS
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>TRK {part.id + 1}</span>
            <span>·</span>
            <span className="text-primary">{selectedStep !== null ? `STEP ${selectedStep + 1}` : "tap a step"}</span>
            {selStep && (
              <button
                onClick={() => selectStep(null)}
                className="ml-1 h-7 px-1.5 rounded panel-inset text-[9px]"
              >CLR</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          {(["velocity", "probability", "gate", "micro", "pitch", "humanize", "ratchet"] as const).map((k) => {
            const range =
              k === "micro" ? { min: -50, max: 50 } :
              k === "gate" ? { min: 0, max: 200 } :
              k === "ratchet" ? { min: 1, max: 4 } :
              k === "pitch" ? { min: -24, max: 24 } :
              { min: 0, max: 100 };
            const labelMap: Record<string, string> = { ratchet: "repeat" };
            const val = selStep ? Number(((selStep as unknown as Record<string, number>)[k]) ?? 0) : 0;

            return (
              <div key={k} className="panel-inset px-2 py-2">
                <div className="flex items-center justify-between text-muted-foreground uppercase">
                  <span>{labelMap[k] ?? k}</span>
                  <span className="text-primary font-display text-xs">{val}</span>
                </div>
                <input
                  type="range" min={range.min} max={range.max} value={val}
                  disabled={selectedStep === null}
                  onChange={(e) => selectedStep !== null && updateStep(part.id, selectedStep, { [k]: Number(e.target.value) } as Partial<Step>)}
                  className="w-full accent-primary mt-1 touch-none"
                />
              </div>
            );
          })}
          <div className="panel-inset px-2 py-2 flex items-center justify-between">
            <span className="text-muted-foreground uppercase">accent</span>
            <button
              disabled={selectedStep === null}
              onClick={() => selectedStep !== null && selStep && updateStep(part.id, selectedStep, { accent: !selStep.accent })}
              className={cn(
                "h-9 px-3 rounded panel-inset font-mono text-[10px]",
                selStep?.accent && "neon-border text-primary"
              )}
            >{selStep?.accent ? "ON" : "OFF"}</button>
          </div>
        </div>

        <div className="mt-2">
          <div className="font-mono text-[9px] text-muted-foreground mb-1">CONDITION</div>
          <div className="flex flex-wrap gap-1">
            {COND_PRESETS.map((c) => (
              <button
                key={c}
                disabled={selectedStep === null}
                onClick={() => selectedStep !== null && updateStep(part.id, selectedStep, { condition: c === "—" ? undefined : c })}
                className={cn(
                  "h-9 px-2 rounded panel-inset font-mono text-[10px]",
                  selStep?.condition === c && "neon-border text-primary"
                )}
              >{c}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}