// VibeCore Sample Forge — Module barrel export.
//
// Central entry point for the Sample Forge module. All sub-modules are
// re-exported from here so consumers import from "@/lib/sampleforge".
//
// Architecture: Sample Forge is an orchestration layer that extends — never
// duplicates — the existing platform modules (DSP Core, Audio Engine,
// sampleForge.ts, groove/analysis, forge graph engine).

// ── Audio Analysis (pure, no AudioContext) ──
export {
  computePeak, computeRMS, computeCrest, computeLoudness,
  computeDCOffset, detectClipping, computeSpectrum,
  detectFundamental, pitchClassHistogramFromAudio, detectKeyFromAudio,
  detectBPM, analyzeDynamics, analyzeSample,
  type SampleAnalysis, type DynamicsReport, type ClippingReport,
} from "./analysis";

// ── Audio Editor (pure, non-destructive) ──
export {
  copyRegion, cutRegion, deleteRegion, pasteRegion,
  insertSilence, silenceRegion, mergeBuffers, splitAt,
  applyGain, applyGainDb, normalizePCM,
  reversePCM, reverseRegion, crossfadeBuffers,
  stereoToMono, monoToStereo,
} from "./editor";

// ── Slice Engine (pure, Groove-compatible) ──
export {
  autoSlice, equalSlice, addSlice, mergeSlices, splitSlice,
  moveSlice, deleteSlice, renameSlice, colorSlice, setSliceVelocity,
  sliceRegion, allSliceRegions, slicesToSteps,
  type Slice,
} from "./sliceEngine";

// ── Loop Engine (pure) ──
export {
  applyLoopCrossfade, extractLoopRegion, barsToSamples,
  snapLoopToBars, makePingPongLoop,
  defaultLoopSettings,
  type LoopMode, type LoopSettings,
} from "./loopEngine";

// ── Recorder (requires AudioContext + getUserMedia) ──
export {
  startRecording, stopRecording, cancelRecording,
  autoTrimPCM, subscribeRecordingState,
  type RecordingState, type RecordingResult,
} from "./recorder";

// ── AI Sample Assistant (pure, assistive) ──
export {
  classifyDrum, classifyInstrument,
  suggestSlices, suggestLoopPoints,
  generateSampleTags,
  computeFingerprint, fingerprintSimilarity, findSimilarSamples,
  type DrumClass, type DrumClassification, type InstrumentClass,
  type SliceSuggestion, type LoopSuggestion, type SampleFingerprint,
} from "./aiAssistant";

// ── Self-test ──
export { runSampleForgeTests } from "./sampleForgeSelfTest";

// ── Re-export existing sampleForge PCM operations (unified API surface) ──
export {
  trimRegion, applyFade, granularSOLA, pitchShiftBuffer, timeStretchBuffer,
  spectralFreezeBuffer, detectTransients, autoChop,
  bufferToPCM, pcmToBuffer,
  trimBufferRegion, applyFadeBuffer, pitchShiftAudioBuffer,
  timeStretchAudioBuffer, spectralFreezeAudioBuffer, autoChopBuffer,
  type PCM,
} from "@/lib/audio/sampleForge";