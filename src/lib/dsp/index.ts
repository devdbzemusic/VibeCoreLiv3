// VibeCore DSP Core — Public API Surface.
//
// This is the single import point for all DSP primitives. All sound modules
// (synthVoice, gravLaceBass, granular, engine FX, future modules) import
// from `@/lib/dsp` — never from individual sub-modules.
//
// Architecture: the DSP Core is a library of factory functions and pure
// utilities that wrap and extend Web Audio's native DSP nodes with:
//   • consistent, typed parameter handling
//   • shared curve/IR generation (no duplication)
//   • denormal protection
//   • SIMD-ready data structures (Float32Array)
//   • deterministic, testable algorithms
//
// The DSP Core contains NO UI, NO sequencer logic, NO transport logic, and
// NO project logic. It is purely a signal-processing library.

// ── Math & conversions ───────────────────────────────────────────────────────
export {
  MIDI_A4, MIDI_A4_SEMITONE, TAU,
  DENORMAL_THRESHOLD,
  clamp, lerp, mapRange,
  dbToLin, linToDb,
  midiToFreq, semiToHz, hzToMidi,
  fastTanh, fastAtan,
  equalPowerPan,
  wrapPhase,
  denormalFlush, flushBuffer,
} from "./math";

// ── Wave shaper curves ───────────────────────────────────────────────────────
export {
  DEFAULT_CURVE_SIZE,
  makeTanhCurve, makeTubeCurve, makeTapeCurve,
  makeFoldbackCurve, makeSoftClipCurve, makeOverdriveCurve,
  makeBitcrushCurve, makeDriveCurve,
} from "./curves";

// ── Envelopes ────────────────────────────────────────────────────────────────
export {
  type ADSRParams, type AHDSRParams, type EnvStage, type MultiStageParams,
  computeADSR, applyADSR, applyAHDSR, applyMultiStage,
} from "./envelope";

// ── Filters ───────────────────────────────────────────────────────────────────
export {
  type FilterType, type FilterParams, type CombParams, type CombNode,
  type MorphPair, type MorphFilterParams, type MorphFilterNode,
  createLP, createHP, createBP, createNotch,
  createComb, createMorphFilter,
} from "./filter";

// ── Oscillators & noise ───────────────────────────────────────────────────────
export {
  type OscType, type NoiseType,
  createOsc, makeWavetable, createWavetableOsc,
  getNoiseBuffer, createNoiseSource,
} from "./oscillator";

// ── LFO ──────────────────────────────────────────────────────────────────────
export {
  type LFOWaveform, type LFOParams, type LFONode,
  computeLFO, lfoRateHz, createLFO, sampledLFO,
} from "./lfo";

// ── Dynamics ─────────────────────────────────────────────────────────────────
export {
  type CompressorParams, type LimiterParams, type ExpanderParams, type GateParams,
  createCompressor, createLimiter, createExpander, createGate,
  createSoftClip, createOverdrive,
} from "./dynamics";

// ── Distortion ────────────────────────────────────────────────────────────────
export {
  type DistortionType, type DistortionParams, type DistortionNode,
  createDistortion,
  createSaturation, createTube, createTape, createFoldback,
  createDrive, createBitcrush,
} from "./distortion";

// ── Delay ─────────────────────────────────────────────────────────────────────
export {
  type DelayDivision, type DelayParams, type DelayFXNode,
  type BPMDelayParams, type StereoDelayParams, type TapParams,
  bpmToDelaySec, createDelay, createBPMDelay,
  createStereoDelay, createPingPongDelay, createMultitapDelay,
} from "./delay";

// ── Reverb ────────────────────────────────────────────────────────────────────
export {
  type ReverbType, type ReverbParams, type ReverbNode,
  createReverb, createHallReverb, createRoomReverb,
  createPlateReverb, createAlgorithmicReverb,
} from "./reverb";

// ── Spatial ───────────────────────────────────────────────────────────────────
export {
  type StereoWidthNode, type MSMode, type BinauralParams, type Spatial3DParams,
  createStereoWidth, createMidSide, createBinaural, createSpatial3D,
  crossFadeGains, equalPowerPan as spatialEqualPowerPan,
} from "./spatial";

// ── Pitch ──────────────────────────────────────────────────────────────────────
export {
  type PitchShiftParams, type FormantParams,
  createPitchShift, createResampler, createFormantBank,
  semisToRatio, ratioToSemis,
} from "./pitch";

// ── Utility DSP ───────────────────────────────────────────────────────────────
export {
  createDCBlocker, createGainSmoother,
  computeLevel,
  createMonoToStereo, createStereoToMono,
} from "./utility";