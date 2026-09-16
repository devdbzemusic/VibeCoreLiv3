import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
import { activateNativeAudio } from "@/lib/audio/nativeAudioRuntime";
import { useGroove } from "@/lib/store";
import { selectedRuntimeKind } from "./selection";

export type PerformanceInstrument = "synth3d" | "bass3d" | "part";

export interface PerformanceNote {
  instrument: PerformanceInstrument;
  partId: number;
  midiNote: number;
  velocity?: number;
  gateSec?: number;
}

export interface PerformanceInputResult {
  accepted: boolean;
  runtime: "webaudio" | "oboe-native";
  releaseMode: "explicit" | "gate" | "none";
  reason?: string;
}

function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function clampVelocity(value: number): number {
  return Math.max(1, Math.min(127, Math.round(value)));
}

/** Resolve a live-performance route from the canonical Part model. */
export function inferPerformanceInstrument(partId: number): PerformanceInstrument {
  const part = useGroove.getState().parts.find((candidate) => candidate.id === partId);
  if (part?.synth.engine === "3D Bass") return "bass3d";
  if (part?.synth.engine === "3D") return "synth3d";
  return "part";
}

/**
 * Backend-neutral live performance note-on.
 *
 * Important authority rule:
 * - Native Android may never fall through to an audible WebAudio renderer.
 * - Native Bass has a source-proven bridge and therefore uses it directly.
 * - Native 3D Synth is intentionally rejected until a real native synth path
 *   exists/is source-proven. TrackMode::Synth alone is not renderer evidence.
 * - Browser mode reuses the existing WebAudio triggerPart implementation.
 */
export async function performanceNoteOn(note: PerformanceNote): Promise<PerformanceInputResult> {
  const midi = clampMidi(note.midiNote);
  const velocity = clampVelocity(note.velocity ?? 110);
  const runtime = selectedRuntimeKind();

  if (runtime === "oboe-native") {
    if (!await activateNativeAudio()) {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: "Native audio could not be activated",
      };
    }

    const native = window.VibeCoreNative;
    if (!native) {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: "Native bridge unavailable after activation",
      };
    }

    if (note.instrument === "bass3d") {
      native.bassNoteOn(midi, velocity);
      return { accepted: true, runtime, releaseMode: "explicit" };
    }

    if (note.instrument === "synth3d") {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: "Native 3D Synth renderer is not source-proven yet",
      };
    }

    return {
      accepted: false,
      runtime,
      releaseMode: "none",
      reason: "Generic native Part performance routing is not defined yet",
    };
  }

  await ensureAudio();
  const ctx = getCtx();
  if (!ctx) {
    return {
      accepted: false,
      runtime: "webaudio",
      releaseMode: "none",
      reason: "WebAudio context unavailable",
    };
  }

  triggerPart(note.partId, ctx.currentTime, {
    velocity,
    semitone: midi - 60,
    gateSec: note.gateSec,
  });

  // The current browser engine schedules a finite gate and does not expose a
  // per-note release handle from triggerPart(). Keeping this explicit prevents
  // the UI from pretending browser noteOff is already implemented.
  return { accepted: true, runtime: "webaudio", releaseMode: "gate" };
}

/** Explicit live performance release where the selected runtime supports it. */
export function performanceNoteOff(note: PerformanceNote): PerformanceInputResult {
  const midi = clampMidi(note.midiNote);
  const runtime = selectedRuntimeKind();

  if (runtime === "oboe-native") {
    const native = window.VibeCoreNative;
    if (note.instrument === "bass3d" && native) {
      native.bassNoteOff(midi);
      return { accepted: true, runtime, releaseMode: "explicit" };
    }
    return {
      accepted: false,
      runtime,
      releaseMode: "none",
      reason: note.instrument === "synth3d"
        ? "Native 3D Synth renderer is not source-proven yet"
        : "Generic native Part release routing is not defined yet",
    };
  }

  return {
    accepted: true,
    runtime: "webaudio",
    releaseMode: "gate",
    reason: "Browser triggerPart currently releases by scheduled gate",
  };
}

/** Panic/recovery boundary for live input. */
export function performanceAllNotesOff(instrument: PerformanceInstrument): PerformanceInputResult {
  const runtime = selectedRuntimeKind();
  if (runtime === "oboe-native") {
    const native = window.VibeCoreNative;
    if (instrument === "bass3d" && native) {
      native.bassAllNotesOff();
      return { accepted: true, runtime, releaseMode: "explicit" };
    }
    return {
      accepted: false,
      runtime,
      releaseMode: "none",
      reason: "No proven native all-notes-off route for this instrument",
    };
  }

  return {
    accepted: false,
    runtime: "webaudio",
    releaseMode: "gate",
    reason: "Browser engine has no public per-performance all-notes-off boundary yet",
  };
}
