/**
 * Native audio runtime coordinator.
 *
 * Android owns the real-time VibeCoreSync/Oboe path. The browser never gets a
 * native backend, and a native startup error is reported instead of silently
 * activating a second WebAudio transport.
 */
import { createAudioBackend, type AudioBackend } from "./AudioBackend";
import { useGroove } from "@/lib/store";
import { probeRuntimeCapability } from "@/lib/capabilities/registry";
import { asSixteenthStep, sixteenthToNativePpq } from "@/lib/runtime/timing";

export interface NativeAudioStatus {
  available: boolean;
  active: boolean;
  engineRunning: boolean;
  latencyMs: number;
  diagnostic: string;
  error: string | null;
}

let backend: AudioBackend | null = null;
let bound = false;
let lastError: string | null = null;
let transportWork: Promise<void> = Promise.resolve();

function reportError(error: unknown) {
  lastError = error instanceof Error ? error.message : String(error);
  useGroove.setState({ audioReady: false });
  console.error("[native-audio]", lastError);
}

/**
 * Side-effect-free runtime-path check. Capability Registry is the single
 * frontend owner for Native availability; activation remains separate.
 */
export function isNativeAudioPath(): boolean {
  return probeRuntimeCapability("audio.native").available;
}

export function getNativeAudioBackend(): AudioBackend | null {
  return backend;
}

export function getNativeAudioStatus(): NativeAudioStatus {
  const capability = probeRuntimeCapability("audio.native");
  if (!capability.available) {
    return {
      available: false,
      active: false,
      engineRunning: false,
      latencyMs: -1,
      diagnostic: capability.reason ?? "browser:webaudio",
      error: null,
    };
  }
  return {
    available: true,
    active: backend?.kind === "oboe-native",
    engineRunning: backend?.isEngineRunning() ?? false,
    latencyMs: backend?.getOutputLatencyMs() ?? -1,
    diagnostic: backend?.getDiagnosticStatus() ?? capability.reason ?? "native:ready",
    error: lastError,
  };
}

/** Starts native audio only after a user-triggered action requests it. */
export async function activateNativeAudio(): Promise<boolean> {
  if (!isNativeAudioPath()) return false;
  try {
    backend ??= createAudioBackend();
    if (!backend) return false;
    await backend.init();
    await backend.startEngine();
    const state = useGroove.getState();
    backend.setTempo(state.bpm);
    backend.setMasterGain(state.masterVolume / 100);
    syncNativeSeek(state);
    lastError = null;
    useGroove.setState({ audioReady: true });
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

export function setNativeMasterGain(value01: number): boolean {
  if (!backend) return false;
  backend.setMasterGain(Math.max(0, Math.min(1, value01)));
  return true;
}

function syncNativeSeek(state: ReturnType<typeof useGroove.getState>): void {
  const seek = state.transport.pendingSeek;
  const pattern = state.patterns[state.transport.currentPattern];
  if (!backend || !seek || !pattern) return;
  const sceneIdx = Math.max(0, Math.min(pattern.scenes.length - 1, seek.sceneIdx));
  const previousSteps = pattern.scenes
    .slice(0, sceneIdx)
    .reduce((total, scene) => total + scene.length, 0);
  const scene = pattern.scenes[sceneIdx];
  const step = Math.max(0, Math.min(Math.max(0, (scene?.length ?? 1) - 1), seek.step));
  const songSteps = previousSteps + step;
  const nativeTick = sixteenthToNativePpq(asSixteenthStep(songSteps));

  backend.setPosition(nativeTick);
  useGroove.setState({
    transport: {
      ...state.transport,
      pendingSeek: null,
      currentStep: step,
      currentSceneIdx: sceneIdx,
    },
    playheads: {
      ...state.playheads,
      step,
      sceneIdx,
      songTicks: songSteps,
    },
  });
}

/**
 * Routes state changes to native transport. The browser does not bind this
 * subscriber, and the native path does not start the WebAudio scheduler.
 */
export function bindNativeAudioRuntime(): void {
  if (bound || !isNativeAudioPath()) return;
  bound = true;
  let prevBpm = useGroove.getState().bpm;
  let prevGain = useGroove.getState().masterVolume;
  let prevPlaying = useGroove.getState().transport.playing;
  let previousSeekKey: string | null = null;

  useGroove.subscribe((state) => {
    if (state.bpm !== prevBpm) {
      prevBpm = state.bpm;
      backend?.setTempo(state.bpm);
    }
    if (state.masterVolume !== prevGain) {
      prevGain = state.masterVolume;
      backend?.setMasterGain(state.masterVolume / 100);
    }
    if (state.transport.playing !== prevPlaying) {
      prevPlaying = state.transport.playing;
      transportWork = transportWork
        .catch(() => undefined)
        .then(async () => {
          if (state.transport.playing) {
            if (await activateNativeAudio()) backend?.play();
          } else {
            await backend?.stop();
          }
        })
        .catch(reportError);
    }
    const pending = state.transport.pendingSeek;
    const seekKey = pending
      ? `${state.transport.currentPattern}:${pending.sceneIdx}:${pending.step}`
      : null;
    if (seekKey !== previousSeekKey) {
      previousSeekKey = seekKey;
      if (seekKey) syncNativeSeek(state);
    }
  });
}
