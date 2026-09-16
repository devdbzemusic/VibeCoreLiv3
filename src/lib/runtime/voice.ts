import { activateNativeAudio } from "@/lib/audio/nativeAudioRuntime";
import { selectedRuntimeKind } from "./selection";

export type RuntimeVoiceCapability = "supported" | "unsupported" | "unknown";

export interface RuntimeVoiceInputStatus {
  capability: RuntimeVoiceCapability;
  requested: boolean;
  active: boolean;
  monitoring: boolean;
  inputLevel: number | null;
  outputLevel: number | null;
  activeUnits: number | null;
  playing: boolean | null;
  error: string | null;
}

export interface RuntimeVoiceResult {
  accepted: boolean;
  runtime: "webaudio" | "oboe-native";
  reason?: string;
}

let inputRequested = false;

function unsupported(reason: string): RuntimeVoiceResult {
  return { accepted: false, runtime: selectedRuntimeKind(), reason };
}

async function nativeBridge() {
  if (selectedRuntimeKind() !== "oboe-native") return null;
  if (!await activateNativeAudio()) return null;
  return window.VibeCoreNative ?? null;
}

/**
 * Current RuntimeVoice capability.
 *
 * Native Voice is source-proven. A browser Voice adapter has not yet been
 * contract-audited, so Browser returns unsupported rather than reusing generic
 * Part controls and pretending they are Voice-DSP commands.
 */
export function runtimeVoiceCapability(): RuntimeVoiceCapability {
  if (selectedRuntimeKind() === "oboe-native") {
    return typeof window !== "undefined" && window.VibeCoreNative ? "supported" : "unknown";
  }
  return "unsupported";
}

export async function setRuntimeVoicePitch(semitones: number, enabled = true): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice DSP pitch adapter is not available for the selected runtime");
  native.voiceSetPitchSemitones(Math.max(-24, Math.min(24, semitones)));
  native.voiceSetPitchEnabled(enabled);
  return { accepted: true, runtime: "oboe-native" };
}

export async function setRuntimeVoiceFormant(semitones: number, enabled = true): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice DSP formant adapter is not available for the selected runtime");
  native.voiceSetFormantSemitones(Math.max(-12, Math.min(12, semitones)));
  native.voiceSetFormantEnabled(enabled);
  return { accepted: true, runtime: "oboe-native" };
}

/** Native Voice volume domain is 0..2 (1 = unity). */
export async function setRuntimeVoiceVolume(value: number): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice DSP volume adapter is not available for the selected runtime");
  native.voiceSetVolume(Math.max(0, Math.min(2, value)));
  return { accepted: true, runtime: "oboe-native" };
}

export async function setRuntimeVoiceDryWet(value01: number): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice DSP dry/wet adapter is not available for the selected runtime");
  native.voiceSetDryWet(Math.max(0, Math.min(1, value01)));
  return { accepted: true, runtime: "oboe-native" };
}

export async function setRuntimeVoiceMonitor(value01: number): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice monitor adapter is not available for the selected runtime");
  native.voiceSetMonitor(Math.max(0, Math.min(1, value01)));
  return { accepted: true, runtime: "oboe-native" };
}

export async function setRuntimeVoiceGlideMs(ms: number): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice glide adapter is not available for the selected runtime");
  native.voiceSetGlideMs(Math.max(0, Math.min(5000, ms)));
  return { accepted: true, runtime: "oboe-native" };
}

/** Native stereo pan is normalized to -1..1 at the Runtime boundary. */
export async function setRuntimeVoicePan(pan: number, enabled = true): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice stereo adapter is not available for the selected runtime");
  native.voiceSetStereoPan(Math.max(-1, Math.min(1, pan)));
  native.voiceSetStereoEnabled(enabled);
  return { accepted: true, runtime: "oboe-native" };
}

export async function setRuntimeVoiceWidth(width: number, enabled = true): Promise<RuntimeVoiceResult> {
  const native = await nativeBridge();
  if (!native) return unsupported("Voice stereo-width adapter is not available for the selected runtime");
  native.voiceSetStereoWidth(width);
  native.voiceSetStereoEnabled(enabled);
  return { accepted: true, runtime: "oboe-native" };
}

/**
 * Requests the Native Voice live-input stream. `requested` and `active` are
 * deliberately distinct so UI cannot claim recording/input success merely
 * because the user tapped a button.
 */
export async function setRuntimeVoiceLiveInput(enabled: boolean): Promise<RuntimeVoiceResult> {
  inputRequested = enabled;
  const native = await nativeBridge();
  if (!native) return unsupported("Voice live input is not available for the selected runtime");
  const accepted = native.voiceSetLiveInputEnabled(enabled);
  return accepted
    ? { accepted: true, runtime: "oboe-native" }
    : { accepted: false, runtime: "oboe-native", reason: "Native Voice input stream could not change state" };
}

/**
 * Read-only runtime snapshot. No values in this object are persisted project
 * state; they are diagnostics/runtime state only.
 */
export function getRuntimeVoiceInputStatus(): RuntimeVoiceInputStatus {
  if (selectedRuntimeKind() !== "oboe-native") {
    return {
      capability: "unsupported",
      requested: inputRequested,
      active: false,
      monitoring: false,
      inputLevel: null,
      outputLevel: null,
      activeUnits: null,
      playing: null,
      error: "Browser Voice runtime adapter has not been contract-audited yet",
    };
  }

  const native = typeof window !== "undefined" ? window.VibeCoreNative : undefined;
  if (!native) {
    return {
      capability: "unknown",
      requested: inputRequested,
      active: false,
      monitoring: false,
      inputLevel: null,
      outputLevel: null,
      activeUnits: null,
      playing: null,
      error: "Native Voice bridge is not available",
    };
  }

  const active = native.voiceLiveInputEnabled();
  return {
    capability: "supported",
    requested: inputRequested,
    active,
    // The bridge exposes monitor as a write-only parameter. Until a getter is
    // added, do not infer monitor state from input activity.
    monitoring: false,
    inputLevel: native.voiceInputLevel(),
    outputLevel: native.voiceOutputLevel(),
    activeUnits: native.voiceActiveUnits(),
    playing: native.voiceIsPlaying(),
    error: null,
  };
}
