// In-app stress tests for the Diagnostics panel.
//
// Each test mutates the store deterministically, runs for N seconds while
// the scheduler is playing, samples the perf snapshot, then restores the
// previous state. Tests are dispatched via runStressTest(name).

import { useGroove } from "@/lib/store";
import { ensureAudio } from "./engine";
import { resetAudioPerf, getAudioPerf, type AudioPerf } from "./audioPerf";
import {
  SCENE_LENGTHS, buildScene, resizeScene, snapSceneLength,
  type Pattern, type Scene, type SceneLength, type Step,
} from "@/lib/model";

export type StressTestName = "all-on" | "polymetric" | "granular" | "ratchets";

export interface StressTestResult {
  name: StressTestName;
  durationSec: number;
  perf: AudioPerf;
  notes: string[];
}

let running = false;
let lastResult: StressTestResult | null = null;
const listeners = new Set<(r: StressTestResult | null) => void>();

export function getLastStressResult(): StressTestResult | null { return lastResult; }
export function isStressRunning(): boolean { return running; }
export function onStressResult(cb: (r: StressTestResult | null) => void): () => void {
  listeners.add(cb); return () => listeners.delete(cb);
}
function emit() { listeners.forEach((cb) => { try { cb(lastResult); } catch { /* noop */ } }); }

function cloneScene(sc: Scene): Scene {
  const partSteps: Record<number, Step[]> = {};
  for (const k of Object.keys(sc.partSteps)) {
    partSteps[Number(k)] = sc.partSteps[Number(k)].map((s) => ({ ...s }));
  }
  const partNotes: Record<number, Scene["partNotes"][number]> = {};
  for (const k of Object.keys(sc.partNotes)) {
    partNotes[Number(k)] = sc.partNotes[Number(k)].slice();
  }
  return { ...sc, partSteps, partNotes };
}

function snapshotPatterns(): Pattern[] {
  return useGroove.getState().patterns.map((p) => ({
    ...p,
    scenes: p.scenes.map(cloneScene),
  }));
}

/** Mutate every part's steps in the current scene of the current pattern. */
function setAllSteps(updater: (i: number, partId: number) => Partial<Step>) {
  const s = useGroove.getState();
  const patIdx = s.transport.currentPattern;
  const pat = s.patterns[patIdx];
  if (!pat) return;
  const sceneI = s.transport.currentSceneIdx;
  const sc = pat.scenes[sceneI];
  if (!sc) return;
  const partSteps: Record<number, Step[]> = { ...sc.partSteps };
  s.parts.forEach((part) => {
    const arr = partSteps[part.id];
    if (!arr) return;
    partSteps[part.id] = arr.map((st, i) => ({ ...st, ...updater(i, part.id) }));
  });
  const scenes = pat.scenes.slice();
  scenes[sceneI] = { ...sc, partSteps };
  const patterns = s.patterns.slice();
  patterns[patIdx] = { ...pat, scenes };
  useGroove.setState({ patterns });
}

/** Set the *current* scene's length (shared by all parts). */
function setCurrentSceneLen(len: SceneLength) {
  const s = useGroove.getState();
  const pat = s.patterns[s.transport.currentPattern];
  if (!pat) return;
  const sceneI = s.transport.currentSceneIdx;
  const sc = pat.scenes[sceneI];
  if (!sc) return;
  const scenes = pat.scenes.slice();
  scenes[sceneI] = resizeScene(sc, len);
  const patterns = s.patterns.slice();
  patterns[s.transport.currentPattern] = { ...pat, scenes };
  useGroove.setState({ patterns });
}

/** Replace the current pattern's scene chain with one Scene per length. */
function setSceneChainLengths(lens: SceneLength[]) {
  const s = useGroove.getState();
  const patIdx = s.transport.currentPattern;
  const pat = s.patterns[patIdx];
  if (!pat) return;
  const scenes = lens.map((L) => buildScene(snapSceneLength(L), s.parts));
  const patterns = s.patterns.slice();
  patterns[patIdx] = { ...pat, scenes };
  useGroove.setState({ patterns });
}

async function withRunningScheduler(seconds: number): Promise<void> {
  await ensureAudio();
  const wasPlaying = useGroove.getState().transport.playing;
  if (!wasPlaying) useGroove.getState().togglePlay();
  await new Promise<void>((res) => setTimeout(res, seconds * 1000));
  if (!wasPlaying) useGroove.getState().togglePlay();
}

async function runImpl(name: StressTestName): Promise<StressTestResult> {
  const seconds = 6;
  const restorePatterns = snapshotPatterns();
  const restoreFx = useGroove.getState().fx.slice();
  const notes: string[] = [];

  resetAudioPerf();
  try {
    switch (name) {
      case "all-on": {
        useGroove.setState({ fx: useGroove.getState().fx.map((f) => ({ ...f, bypass: true })) });
        setCurrentSceneLen(16);
        setAllSteps(() => ({ on: true, velocity: 100, ratchet: 1, probability: 100 }));
        notes.push("16 parts × 16 steps, ratchet=1, all FX bypassed");
        break;
      }
      case "polymetric": {
        // Polymetry now lives in the scene CHAIN, not between parts. Build
        // a 4/8/16 scene chain so the engine cycles through different
        // lengths within one pattern cycle.
        setSceneChainLengths([4, 8, 16, 8]);
        setAllSteps((i, partId) => ({ on: (i + partId) % 3 === 0, velocity: 100 }));
        useGroove.getState().setChain([0, 1, 2, 3]);
        notes.push("Scene chain 4/8/16/8, pattern chain [0,1,2,3]");
        break;
      }
      case "granular": {
        useGroove.setState({
          parts: useGroove.getState().parts.map((p) => ({
            ...p,
            wave: { ...p.wave, granEnabled: true, grainDensity: 80, grainSize: 50 },
          })),
        });
        setAllSteps((i) => ({ on: i % 4 === 0, velocity: 100 }));
        notes.push("Granular ON on all parts, density 80, size 50");
        break;
      }
      case "ratchets": {
        setCurrentSceneLen(16);
        setAllSteps(() => ({ on: true, ratchet: 4, velocity: 110 }));
        notes.push("All steps on, ratchet=4 → max repeat density");
        break;
      }
    }

    await withRunningScheduler(seconds);
  } finally {
    useGroove.setState({ patterns: restorePatterns, fx: restoreFx });
  }
  const perf = getAudioPerf();
  const result: StressTestResult = { name, durationSec: seconds, perf, notes };
  if (perf.scheduler.lateTicks > 10) notes.push(`⚠ scheduler late ticks ${perf.scheduler.lateTicks}`);
  if (perf.droppedVoices > 0) notes.push(`⚠ dropped voices ${perf.droppedVoices}`);
  if (perf.grains.peak >= 120) notes.push(`⚠ grain pool saturation peak ${perf.grains.peak}`);
  if (perf.longTasks.gt100 > 0) notes.push(`⚠ long tasks >100ms ${perf.longTasks.gt100}`);
  return result;
}

export async function runStressTest(name: StressTestName): Promise<StressTestResult | null> {
  if (running) return null;
  running = true;
  emit();
  try {
    const r = await runImpl(name);
    lastResult = r;
    emit();
    return r;
  } finally {
    running = false;
    emit();
  }
}

void SCENE_LENGTHS;
