import type { VibeCoreNativeBridge } from "@/lib/audio/AudioBackend";
import type { Part, Scene, Step } from "@/lib/model";
import { instrumentAuthorityForCategory } from "@/lib/instruments/sourceBoundary";
import { nativeGrooveAssetRegistry, nativeGrooveSampleIdForPart } from "./nativeGrooveAssets";
import { asSixteenthStep, sixteenthToNativePpq } from "./timing";
import { useGroove } from "@/lib/store";

const MAX_NATIVE_TRACKS = 16;
const NATIVE_STEP_TICKS = 480;

export interface NativeMirrorReport {
  mirroredTracks: number;
  mirroredSteps: number;
  mirroredNotes: number;
  assignedSamples: number;
  missingRegisteredSamples: number;
  warnings: string[];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function trackModeForPart(part: Part): number {
  switch (part.category) {
    case "bass": return 1;
    case "synth": return 2;
    case "sample": return 3;
    case "kick":
    case "snare":
    case "perc":
    case "hat":
    default:
      return 0;
  }
}

/**
 * Web swing is centered at 50 (50 = straight). Native Groove is 0..100 delay
 * on odd steps (0 = straight). Native cannot represent negative/pre-beat swing,
 * so values below 50 are clamped to straight and reported as a warning.
 */
export function webSwingToNative(webSwing: number): number {
  return clampInt((webSwing - 50) * 2, 0, 100);
}

/** Web ratchet counts total hits; Native rollCount counts extra hits. */
export function webRatchetToNativeExtraHits(ratchet: number): number {
  return clampInt((ratchet || 1) - 1, 0, 8);
}

/**
 * Web micro = -50..50 where +/-50 equals +/-25% of a 1/16 step.
 * Native uses PPQ ticks. 25% of 480 ticks = 120 ticks.
 */
export function webMicroToNativeTicks(micro: number): number {
  return clampInt((Math.max(-50, Math.min(50, micro)) / 50) * (NATIVE_STEP_TICKS / 4), -120, 120);
}

function stepMidiNote(part: Part, step: Step): number {
  // Web scheduler treats Step.pitch as a semitone offset. The trigger base is C4.
  return clampInt(60 + (part.pitch || 0) + (step.pitch || 0), 0, 127);
}

function mirrorTrackSample(
  native: VibeCoreNativeBridge,
  track: number,
  part: Part,
  report: NativeMirrorReport,
): void {
  const authority = instrumentAuthorityForCategory(part.category);
  if (authority !== "sample-domain") {
    // Explicitly clear any stale sample assignment from a previous project.
    native.grooveSetTrackSample(track, -1);
    return;
  }

  const sampleId = nativeGrooveSampleIdForPart(part);
  if (sampleId == null || !nativeGrooveAssetRegistry.isRegistered(part)) {
    native.grooveSetTrackSample(track, -1);
    if (part.sampleName) report.missingRegisteredSamples += 1;
    return;
  }

  native.grooveSetTrackSample(track, sampleId);
  report.assignedSamples += 1;
}

function mirrorTrack(
  native: VibeCoreNativeBridge,
  track: number,
  part: Part,
  scene: Scene,
  patternSwing: number,
  report: NativeMirrorReport,
): void {
  const steps = scene.partSteps[part.id] ?? [];
  const notes = scene.partNotes[part.id] ?? [];

  native.grooveSetTrackMode(track, trackModeForPart(part));
  native.grooveSetTrackMute(track, !!part.mute);
  native.grooveSetTrackSolo(track, !!part.solo);
  native.grooveSetTrackVolume(track, clampInt((part.volume / 100) * 127, 0, 127));
  mirrorTrackSample(native, track, part, report);

  native.grooveClearPattern(track);
  native.grooveSetPatternLength(track, clampInt(scene.length, 1, 64));
  native.grooveSetSwing(track, webSwingToNative(patternSwing));

  for (let i = 0; i < Math.min(scene.length, steps.length, 64); i += 1) {
    const step = steps[i];
    if (!step) continue;

    native.grooveSetStep(
      track,
      i,
      !!step.on,
      clampInt(step.velocity, 0, 127),
      stepMidiNote(part, step),
    );
    native.grooveSetStepProbability(track, i, clampInt(step.probability, 0, 100));
    native.grooveSetStepAccent(track, i, !!step.accent);
    native.grooveSetStepRoll(track, i, webRatchetToNativeExtraHits(step.ratchet));
    native.grooveSetStepMicroTiming(track, i, webMicroToNativeTicks(step.micro || 0));
    report.mirroredSteps += 1;
  }

  native.grooveClearPianoRoll(track);
  for (const note of notes) {
    const microTicks = webMicroToNativeTicks(note.micro || 0);
    const startBase = sixteenthToNativePpq(asSixteenthStep(note.step));
    const endBase = sixteenthToNativePpq(asSixteenthStep(note.step + Math.max(0.25, note.length)));
    native.grooveAddPianoRollNote(
      track,
      Math.max(0, Math.round(startBase + microTicks)),
      Math.max(1, Math.round(endBase + microTicks)),
      clampInt(note.pitch, 0, 127),
      clampInt(note.velocity, 0, 127),
    );
    report.mirroredNotes += 1;
  }

  report.mirroredTracks += 1;
}

/**
 * Mirrors the currently active Pattern/Scene into Native Groove.
 *
 * Deliberate v1 boundary:
 * - Current scene only. The verified bridge exposes no complete Pattern-bank /
 *   Scene-bank load contract yet.
 * - First 16 parts only because Native Groove has kMaxTracks = 16.
 * - Stable Native sample id is Part.id, but the id is assigned to a track only
 *   after the session AssetRegistry confirms PCM registration in Groove.
 * - Gate/filter/pan-offset per-step values are not mirrored because Native
 *   Groove Step has no equivalent fields.
 *
 * Zustand remains the authoritative project state; this function creates no
 * parallel persistent state and is safe to replay after native engine restart.
 */
export function mirrorCurrentSceneToNative(
  state: ReturnType<typeof useGroove.getState> = useGroove.getState(),
  native: VibeCoreNativeBridge | undefined = typeof window !== "undefined" ? window.VibeCoreNative : undefined,
): NativeMirrorReport {
  const report: NativeMirrorReport = {
    mirroredTracks: 0,
    mirroredSteps: 0,
    mirroredNotes: 0,
    assignedSamples: 0,
    missingRegisteredSamples: 0,
    warnings: [],
  };

  if (!native?.isAvailable?.()) {
    report.warnings.push("native bridge unavailable");
    return report;
  }

  const pattern = state.patterns[state.transport.currentPattern];
  if (!pattern) {
    report.warnings.push(`pattern ${state.transport.currentPattern} missing`);
    return report;
  }

  const sceneIdx = clampInt(state.transport.currentSceneIdx, 0, Math.max(0, pattern.scenes.length - 1));
  const scene = pattern.scenes[sceneIdx];
  if (!scene) {
    report.warnings.push(`scene ${sceneIdx} missing`);
    return report;
  }

  if (pattern.swing < 50) {
    report.warnings.push("negative/pre-beat web swing cannot be represented by native Groove v1; clamped to straight");
  }
  if (state.parts.length > MAX_NATIVE_TRACKS) {
    report.warnings.push(`${state.parts.length - MAX_NATIVE_TRACKS} part(s) exceed native 16-track limit and were not mirrored`);
  }

  const count = Math.min(MAX_NATIVE_TRACKS, state.parts.length);
  for (let track = 0; track < count; track += 1) {
    mirrorTrack(native, track, state.parts[track], scene, pattern.swing, report);
  }

  if (report.missingRegisteredSamples > 0) {
    report.warnings.push(
      `${report.missingRegisteredSamples} sample assignment(s) have Web project metadata but no registered Native Groove PCM asset`,
    );
  }

  return report;
}
