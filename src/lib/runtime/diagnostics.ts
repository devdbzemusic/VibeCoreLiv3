import { runtimeCapabilitySnapshot } from "@/lib/capabilities/registry";
import { getNativeAudioStatus, getNativeProjectMirrorStatus } from "@/lib/audio/nativeAudioRuntime";
import { useGroove } from "@/lib/store";
import { sourceBoundaryDecision } from "@/lib/instruments/sourceBoundary";
import { runtimeSelectionInfo } from "./selection";

export interface RuntimeDiagnosticsSnapshot {
  backend: ReturnType<typeof runtimeSelectionInfo>;
  native: ReturnType<typeof getNativeAudioStatus> | null;
  nativeProjectMirror: ReturnType<typeof getNativeProjectMirrorStatus> | null;
  capabilities: ReturnType<typeof runtimeCapabilitySnapshot>;
  project: {
    playing: boolean;
    bpm: number;
    currentPattern: number;
    currentSceneIdx: number;
    currentStep: number;
    selectedPart: number;
    audioReady: boolean;
  };
  instrumentSources: {
    totalParts: number;
    canonicalParts: number;
    invalidActiveSources: number;
    legacyCompatibilityParts: number;
  };
  reportedMetrics: {
    cpu: number;
    voices: number;
    activeVoices: number;
    fps: number;
  };
  cache: {
    integratedAudioAssetCache: boolean;
    reason: string;
  };
  verification: {
    runtimeExecuted: false;
    performanceMeasured: false;
  };
}

/**
 * Side-effect-free runtime snapshot for diagnostics UI/log export.
 *
 * Values reported by the store are exposed as reported metrics only. This
 * function must not upgrade them to VERIFIED evidence; formal performance
 * evidence still requires the documented execution gates.
 */
export function getRuntimeDiagnosticsSnapshot(): RuntimeDiagnosticsSnapshot {
  const state = useGroove.getState();
  const backend = runtimeSelectionInfo();
  const nativeSelected = backend.kind === "oboe-native";
  let canonicalParts = 0;
  let invalidActiveSources = 0;
  let legacyCompatibilityParts = 0;

  for (const part of state.parts) {
    const decision = sourceBoundaryDecision(part.category, part.source);
    if (decision.compatible) canonicalParts += 1;
    else invalidActiveSources += 1;
    if ((part as typeof part & { legacyInstrument?: unknown }).legacyInstrument) {
      legacyCompatibilityParts += 1;
    }
  }

  return {
    backend,
    native: nativeSelected ? getNativeAudioStatus() : null,
    nativeProjectMirror: nativeSelected ? getNativeProjectMirrorStatus() : null,
    capabilities: runtimeCapabilitySnapshot(),
    project: {
      playing: state.transport.playing,
      bpm: state.bpm,
      currentPattern: state.transport.currentPattern,
      currentSceneIdx: state.transport.currentSceneIdx,
      currentStep: state.transport.currentStep,
      selectedPart: state.selectedPart,
      audioReady: state.audioReady,
    },
    instrumentSources: {
      totalParts: state.parts.length,
      canonicalParts,
      invalidActiveSources,
      legacyCompatibilityParts,
    },
    reportedMetrics: {
      cpu: state.cpu,
      voices: state.voices,
      activeVoices: state.activeVoices,
      fps: state.fps,
    },
    cache: {
      integratedAudioAssetCache: false,
      reason: "Budgeted cache core exists but engine.ts still owns the legacy unbounded AudioBuffer Map",
    },
    verification: {
      runtimeExecuted: false,
      performanceMeasured: false,
    },
  };
}
