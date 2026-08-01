import { useGroove } from "@/lib/store";

// VibeCoreLiv3 — Piano Roll isolated playhead.
//
// Phase 3 real-time optimization: this child subscribes ONLY to the
// transport + playhead slice, so the ~20 Hz playhead writes re-render this
// 1-line element instead of the whole Roll (grid + notes + inspector). Keeps
// the UI thread off the audio scheduler's back during playback and during
// live edits while the transport is running.
export function RollPlayhead({
  selectedPattern,
  selectedSceneIdx,
  sceneCount,
  stepCount,
}: {
  selectedPattern: number;
  selectedSceneIdx: number;
  sceneCount: number;
  stepCount: number;
}) {
  const playing = useGroove((s) => s.transport.playing);
  const currentPattern = useGroove((s) => s.transport.currentPattern);
  const sceneIdx = useGroove((s) => s.playheads.sceneIdx);
  const step = useGroove((s) => s.playheads.step);

  const activeScene = Math.min(selectedSceneIdx, Math.max(0, sceneCount - 1));
  const visible = playing && currentPattern === selectedPattern && sceneIdx === activeScene;
  if (!visible) return null;
  const cur = step ?? 0;
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-neon-lime pointer-events-none"
      style={{ left: `${((cur + 0.5) / stepCount) * 100}%`, boxShadow: "0 0 8px hsl(var(--neon-lime))" }}
    />
  );
}