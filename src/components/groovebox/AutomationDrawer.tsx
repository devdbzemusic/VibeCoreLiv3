// VibeCoreLiv3 — Automation Drawer
//
// Collapsible lane strip showing per-step automation data for the current
// part in the current scene. Lanes: VEL (step velocity), PROB (step
// probability), GATE (step gate length). Each lane is a draggable bar chart
// aligned 1:1 with the Piano Roll step columns. Drag a bar up/down to edit.
//
// Signal flow: reads from store partSteps → writes back via updateStep.
// No audio thread contact; all changes propagate via store listeners.

import { useRef } from "react";
import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/model";
import { ChevronDown } from "lucide-react";

type Lane = "VEL" | "PROB" | "GATE";

const LANE_LABELS: Record<Lane, string> = {
  VEL: "VELOCITY",
  PROB: "PROBABILITY",
  GATE: "GATE",
};

function laneValue(s: Step, lane: Lane): number {
  if (lane === "VEL")  return s.velocity ?? 100;
  if (lane === "PROB") return s.probability ?? 100;
  if (lane === "GATE") return Math.min(100, (s.gate ?? 100) / 2);
  return 0;
}
function laneMax(lane: Lane): number {
  return lane === "GATE" ? 200 : 100;
}
function laneMin(lane: Lane): number {
  return lane === "GATE" ? 0 : 0;
}

export function AutomationDrawer({ onClose }: { onClose: () => void }) {
  const patterns       = useGroove((s) => s.patterns);
  const selectedPattern = useGroove((s) => s.selectedPattern);
  const selectedSceneIdx = useGroove((s) => s.selectedSceneIdx);
  const parts          = useGroove((s) => s.parts);
  const selectedPart   = useGroove((s) => s.selectedPart);
  const updateStep     = useGroove((s) => s.updateStep);

  const pattern = patterns[selectedPattern];
  const part    = parts[selectedPart];
  const scene   = pattern?.scenes[Math.min(selectedSceneIdx, (pattern?.scenes.length ?? 1) - 1)];
  const steps   = (scene?.partSteps[part?.id ?? -1] ?? []) as Step[];
  const stepCount = steps.length;

  const [activeLane, setActiveLane] = useState<Lane>("VEL");
  const dragging = useRef<number | null>(null);   // step index being dragged
  const barContainerRef = useRef<HTMLDivElement>(null);

  if (!pattern || !part || !scene || stepCount === 0) {
    return (
      <div className="panel p-3 text-xs text-muted-foreground text-center">
        No scene data for automation.
      </div>
    );
  }

  // ── Bar drag: pointer down on a bar → drag to set value ──────────────────
  const setValueFromEvent = (e: PointerEvent | React.PointerEvent, idx: number) => {
    const el = barContainerRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const relY = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const max  = laneMax(activeLane);
    const min  = laneMin(activeLane);
    const val  = Math.round(min + relY * (max - min));
    const patch: Partial<Step> =
      activeLane === "VEL"  ? { velocity: val } :
      activeLane === "PROB" ? { probability: val } :
                              { gate: val };
    updateStep(part.id, idx, patch);
  };

  const onBarPointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    dragging.current = idx;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setValueFromEvent(e, idx);
  };

  const onBarPointerMove = (e: React.PointerEvent, idx: number) => {
    if (dragging.current !== idx) return;
    setValueFromEvent(e, idx);
  };

  const onBarPointerUp = () => { dragging.current = null; };

  return (
    <div className="panel p-3 space-y-2 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-display text-xs text-primary flex items-center gap-2">
          AUTO — {LANE_LABELS[activeLane]}
          <span className="font-mono text-[8px] text-muted-foreground">
            {part.name} · SCN {Math.min(selectedSceneIdx, pattern.scenes.length - 1) + 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Lane selector */}
          {(["VEL", "PROB", "GATE"] as Lane[]).map((lane) => (
            <button
              key={lane}
              onClick={() => setActiveLane(lane)}
              className={cn(
                "h-7 px-2 rounded panel-inset font-mono text-[9px] transition-colors",
                activeLane === lane ? "neon-border text-primary" : "text-muted-foreground",
              )}
            >
              {lane}
            </button>
          ))}
          <button
            onClick={onClose}
            className="h-7 w-7 rounded panel-inset grid place-items-center text-muted-foreground ml-1"
            aria-label="Close automation drawer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="hairline" />

      {/* Bar chart */}
      <div
        ref={barContainerRef}
        className="relative h-20 select-none touch-none"
        style={{ display: "grid", gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))`, gap: 2 }}
      >
        {steps.map((s, idx) => {
          const max  = laneMax(activeLane);
          const min  = laneMin(activeLane);
          const val  = laneValue(s, activeLane);
          const pct  = ((val - min) / (max - min)) * 100;
          const on   = s.on;
          return (
            <div
              key={idx}
              className="relative flex flex-col justify-end rounded-sm overflow-hidden cursor-ns-resize bg-surface-0"
              onPointerDown={(e) => onBarPointerDown(e, idx)}
              onPointerMove={(e) => onBarPointerMove(e, idx)}
              onPointerUp={onBarPointerUp}
              onPointerCancel={onBarPointerUp}
              aria-label={`step ${idx + 1} ${activeLane} ${val}`}
            >
              <div
                className={cn(
                  "w-full rounded-sm transition-none",
                  on ? "bg-primary" : "bg-muted-foreground/40",
                )}
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              {/* Step number */}
              {idx % 4 === 0 && (
                <span className="absolute top-0.5 left-0.5 font-mono text-[6px] text-muted-foreground/60 pointer-events-none">
                  {idx + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[8px] text-muted-foreground text-center">
        drag bars to edit · only triggered steps show full color
      </p>
    </div>
  );
}
