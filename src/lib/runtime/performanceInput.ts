import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
import { activateNativeAudio } from "@/lib/audio/nativeAudioRuntime";
import { probeRuntimeCapability, type RuntimeCapabilityId } from "@/lib/capabilities/registry";
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

function instrumentCapability(
  runtime: "webaudio" | "oboe-native",
  instrument: PerformanceInstrument,
): RuntimeCapabilityId | null {
  if (instrument === "synth3d") {
    return runtime === "oboe-native" ? "instrument.synth3d.native" : "instrument.synth3d.web";
  }
  if (instrument === "bass3d") {
    return runtime === "oboe-native" ? "instrument.bass3d.native" : "instrument.bass3d.web";
  }
  return runtime === "webaudio" ? "audio.web" : null;
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
 * Capability availability is owned by the central registry. Runtime activation
 * remains separate: a capability can be source-proven/available and activation
 * can still fail at execution time.
 */
export async function performanceNoteOn(note: PerformanceNote): Promise<PerformanceInputResult> {
  const midi = clampMidi(note.midiNote);
  const semitone = midi - 60;
  const velocity = clampVelocity(note.velocity ?? 110);
  const runtime = selectedRuntimeKind();
  const capabilityId = instrumentCapability(runtime, note.instrument);

  if (capabilityId) {
    const capability = probeRuntimeCapability(capabilityId);
    if (!capability.available) {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: capability.reason ?? `${capabilityId} unavailable`,
      };
    }
  }

  if (runtime === "oboe-native") {
    if (note.instrument === "part") {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: "Generic native Part performance routing is not defined yet",
      };
    }

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

    // Synth3D currently cannot reach this branch because the registry reports
    // the native capability unavailable. Keeping an explicit guard here makes
    // the authority rule robust against future registry changes.
    return {
      accepted: false,
      runtime,
      releaseMode: "none",
      reason: "No source-proven native renderer for this instrument",
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

  // Arm acknowledgement BEFORE triggerPart. triggerPart intentionally keeps its
  // scheduler-friendly void API while 3D modules load asynchronously.
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
  const capabilityId = instrumentCapability(runtime, note.instrument);

  if (capabilityId) {
    const capability = probeRuntimeCapability(capabilityId);
    if (!capability.available) {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: capability.reason ?? `${capabilityId} unavailable`,
      };
    }
  }

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
      reason: "No proven native release route for this instrument",
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
  const capabilityId = instrumentCapability(runtime, instrument);

  if (capabilityId) {
    const capability = probeRuntimeCapability(capabilityId);
    if (!capability.available) {
      return {
        accepted: false,
        runtime,
        releaseMode: "none",
        reason: capability.reason ?? `${capabilityId} unavailable`,
      };
    }
  }

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
