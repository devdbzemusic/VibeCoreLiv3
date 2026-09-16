import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
import { activateNativeAudio } from "@/lib/audio/nativeAudioRuntime";
import { killAllNotes3D, releaseNote3D, waitForNoteStart3D } from "@/lib/synth3d/voiceEngine";
import { killAllNotes3DBass, releaseNote3DBass, waitForNoteStart3DBass } from "@/lib/bass3d/voiceEngine";
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
 * Authority rules:
 * - Native Android never falls through to an audible WebAudio renderer.
 * - Native Bass uses its source-proven bridge.
 * - Native 3D Synth remains unsupported until a real native synth path exists.
 * - Browser reuses triggerPart, but for 3D instruments does not report success
 *   until the existing voice engine acknowledges actual note registration.
 */
export async function performanceNoteOn(note: PerformanceNote): Promise<PerformanceInputResult> {
  const midi = clampMidi(note.midiNote);
  const semitone = midi - 60;
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

  // Arm the acknowledgement BEFORE triggerPart. triggerPart intentionally
  // keeps its scheduler-friendly void API and starts 3D dynamic imports
  // asynchronously; the voice engines provide the actual registration signal.
  const registration = note.instrument === "synth3d"
    ? waitForNoteStart3D(note.partId, semitone)
    : note.instrument === "bass3d"
      ? waitForNoteStart3DBass(note.partId, semitone)
      : null;

  triggerPart(note.partId, ctx.currentTime, {
    velocity,
    semitone,
    gateSec: note.gateSec,
  });

  if (registration) {
    const started = await registration;
    if (!started) {
      return {
        accepted: false,
        runtime: "webaudio",
        releaseMode: "none",
        reason: `${note.instrument} voice registration timed out`,
      };
    }
    return { accepted: true, runtime: "webaudio", releaseMode: "explicit" };
  }

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

  const ctx = getCtx();
  if (ctx && note.instrument === "synth3d") {
    const released = releaseNote3D(note.partId, midi - 60, ctx.currentTime);
    return {
      accepted: released,
      runtime: "webaudio",
      releaseMode: "explicit",
      reason: released ? undefined : "No matching active 3D Synth note",
    };
  }
  if (ctx && note.instrument === "bass3d") {
    const released = releaseNote3DBass(note.partId, midi - 60, ctx.currentTime);
    return {
      accepted: released,
      runtime: "webaudio",
      releaseMode: "explicit",
      reason: released ? undefined : "No matching active 3D Bass note",
    };
  }

  return {
    accepted: true,
    runtime: "webaudio",
    releaseMode: "gate",
    reason: "Generic browser Part release remains scheduled by gate",
  };
}

/** Panic/recovery boundary for live input. */
export function performanceAllNotesOff(instrument: PerformanceInstrument, partId?: number): PerformanceInputResult {
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

  if (partId != null && instrument === "synth3d") {
    killAllNotes3D(partId);
    return { accepted: true, runtime: "webaudio", releaseMode: "explicit" };
  }
  if (partId != null && instrument === "bass3d") {
    killAllNotes3DBass(partId);
    return { accepted: true, runtime: "webaudio", releaseMode: "explicit" };
  }

  return {
    accepted: false,
    runtime: "webaudio",
    releaseMode: "gate",
    reason: "Generic browser Part has no public all-notes-off boundary yet",
  };
}
