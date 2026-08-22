import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/model";

const EMPTY: Step[] = [];

// VibeCoreLiv3 — Roll drum lane.
// Unifies the step-sequencer trigger row with the Piano Roll: the same
// `scene.partSteps[part.id]` the SeqTab edits, rendered as a compact strip
// aligned 1:1 with the Roll's step columns. Toggle triggers without leaving
// the melodic editor → one clean workflow for drum + melodic programming.
export function RollDrumLane({ partId, stepCount }: { partId: number; stepCount: number }) {
  const steps = useGroove((s) => {
    const pat = s.patterns[s.selectedPattern];
    const sc = pat?.scenes[Math.min(s.selectedSceneIdx, (pat?.scenes.length ?? 1) - 1)];
    return sc?.partSteps[partId] ?? EMPTY;
  });
  const toggleStep = useGroove((s) => s.toggleStep);
  const selectedStep = useGroove((s) => s.selectedStep);
  const selectStep = useGroove((s) => s.selectStep);
  const playing = useGroove((s) => s.transport.playing);
  const curPattern = useGroove((s) => s.transport.currentPattern);
  const selPattern = useGroove((s) => s.selectedPattern);
  const sceneIdx = useGroove((s) => s.playheads.sceneIdx);
  const selSceneIdx = useGroove((s) => s.selectedSceneIdx);
  const curStep = useGroove((s) => s.playheads.step) ?? 0;

  const active = playing && curPattern === selPattern && sceneIdx === selSceneIdx;

  return (
    <div className="flex items-center gap-1 mb-1.5">
      <div style={{ width: 38 }} className="shrink-0 font-mono text-[8px] text-muted-foreground leading-none pt-1">
        DRUM
      </div>
      <div
        className="flex-1 grid gap-px"
        style={{ gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: stepCount }, (_, idx) => {
          const s = steps[idx];
          const on = !!s?.on;
          const isCur = active && curStep === idx;
          return (
            <button
              key={idx}
              onPointerDown={(e) => { e.preventDefault(); selectStep(idx); toggleStep(partId, idx); }}
              data-active={on}
              data-playing={isCur}
              className={cn(
                "h-5 rounded-sm border touch-none transition-colors",
                on ? "bg-primary/25 border-primary/60" : "bg-muted border-border",
                isCur && "ring-1 ring-neon-lime",
                selectedStep === idx && "neon-border",
              )}
              aria-label={`step ${idx + 1} ${on ? "on" : "off"}`}
            />
          );
        })}
      </div>
    </div>
  );
}