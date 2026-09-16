// VibeCore 3D Bass — Voice Engine.
//
// Manages polyphony, unison, voice stealing, glide, and voice modes
// (mono / poly / legato) for the 3D Bass. Integrates with the central
// voice allocator (voiceAllocator.ts) using CRITICAL priority — bass
// voices are never stolen by less-critical modules (pads, granular, arp).
//
// Reuses the per-part spatial chain from synth3d/spatialEngine.ts —
// no spatial engine duplication. The bass voice splits the signal into
// sub (mono, direct) and harmonic (spatial chain) paths for mono-compat.
//
// Realtime-safe: all operations are control-thread. Voice creation delegates
// to voice.ts (which creates AudioNodes on the control thread).

import { requestVoice, partVoiceClass, type VoiceHandle } from "@/lib/audio/voiceAllocator";
import { recordVoiceCreated, recordVoiceDestroyed } from "@/lib/audio/audioPerf";
import { mulberry32, hashSeed } from "@/lib/utils/random";
import { useGroove } from "@/lib/store";
import { getSpatialChain } from "@/lib/synth3d/spatialEngine";
import { computeUnisonOffsets, type VoiceOpts3D } from "@/lib/synth3d/voice";
import { createVoice3DBass, type Bass3DVoice } from "./voice";
import { defaultBass3D, type Bass3DParams } from "./params";
import type { Part } from "@/lib/model";

interface ActiveNote {
  midi: number;
  voices: Bass3DVoice[];
  handle: VoiceHandle;
  startTime: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

// Per-part voice engines
const _engines = new Map<number, { notes: ActiveNote[]; lastMidi: number }>();

function getEngine(partId: number) {
  let e = _engines.get(partId);
  if (!e) { e = { notes: [], lastMidi: -1 }; _engines.set(partId, e); }
  return e;
}

function cleanupNote(partId: number, note: ActiveNote): void {
  const engine = _engines.get(partId);
  if (!engine) return;
  if (note.cleanupTimer) {
    clearTimeout(note.cleanupTimer);
    note.cleanupTimer = null;
  }
  note.handle.release();
  const idx = engine.notes.indexOf(note);
  if (idx >= 0) engine.notes.splice(idx, 1);
  recordVoiceDestroyed();
}

/** Trigger a 3D Bass note. Called from the engine's triggerPart path. */
export function triggerNote3DBass(
  ctx: AudioContext,
  chainInput: AudioNode,
  part: Part,
  when: number,
  opts: { velocity: number; semitone: number; gateSec: number; aftertouch?: number },
): void {
  const params: Bass3DParams = part.bass3d ?? defaultBass3D();
  const engine = getEngine(part.id);
  const perf = params.performance;

  // ── Voice allocation via central allocator (CRITICAL priority) ──────────
  const { module, priority } = partVoiceClass(part);
  const handle = requestVoice(part.id, module, priority);
  if (!handle) return; // dropped — all active voices are more critical

  // ── Spatial chain (shared per-part, reused from synth3d) ────────────────
  const spatial = getSpatialChain(ctx, part.id, params.spatial);
  try { spatial.output.connect(chainInput); } catch { /* already connected */ }

  const spatialModParams: VoiceOpts3D["spatialModParams"] = {
    width: spatial.widthGain?.gain,
    azimuth: spatial.panner && "pan" in spatial.panner ? (spatial.panner as StereoPannerNode).pan : undefined,
    distance: spatial.distanceGain?.gain,
    elevation: spatial.panner && "positionY" in spatial.panner ? (spatial.panner as PannerNode).positionY : undefined,
  };

  const uni = params.unison;
  const count = uni.enabled ? Math.max(1, Math.min(5, uni.count)) : 1;
  const rng = mulberry32(hashSeed(hashSeed(part.id, opts.semitone), Math.floor(when * 1000)));
  const bpm = useGroove.getState().bpm;

  // ── Mono / Legato: glide existing voices or fast-fade ─────────────────
  if (perf.mode !== "poly" && engine.notes.length > 0) {
    if (perf.glideMode !== "off" && perf.glideTime > 0) {
      const oldNote = engine.notes[0];
      if (oldNote.cleanupTimer) { clearTimeout(oldNote.cleanupTimer); oldNote.cleanupTimer = null; }
      const newNoteOffTime = when + opts.gateSec;
      oldNote.voices.forEach((v) => {
        v.rePitch(opts.semitone, perf.glideTime, when);
        v.extendGate(newNoteOffTime, when);
      });
      oldNote.midi = opts.semitone;
      oldNote.startTime = when;
      engine.lastMidi = opts.semitone;
      const releaseDelayMs = Math.max(50, (newNoteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
      oldNote.cleanupTimer = setTimeout(() => cleanupNote(part.id, oldNote), releaseDelayMs + 50);
      return;
    } else {
      const oldNote = engine.notes[0];
      if (oldNote.cleanupTimer) { clearTimeout(oldNote.cleanupTimer); oldNote.cleanupTimer = null; }
      oldNote.voices.forEach((v) => v.steal(0.03));
      oldNote.handle.release();
      engine.notes = [];
    }
  }

  // Enforce per-part polyphony limit in poly mode.
  if (perf.mode === "poly" && engine.notes.length >= perf.polyphony) {
    const oldest = engine.notes[0];
    if (oldest.cleanupTimer) { clearTimeout(oldest.cleanupTimer); oldest.cleanupTimer = null; }
    oldest.voices.forEach((v) => v.steal(0.03));
    oldest.handle.release();
    engine.notes.shift();
    recordVoiceDestroyed();
  }

  const voices: Bass3DVoice[] = [];
  for (let i = 0; i < count; i++) {
    const offsets = computeUnisonOffsets(
      i, count, uni.detune, uni.spread, uni.phaseRandom, rng,
    );
    const voiceOpts: VoiceOpts3D = {
      velocity: opts.velocity,
      semitone: opts.semitone,
      gateSec: opts.gateSec,
      aftertouch: opts.aftertouch,
      unisonIndex: i,
      unisonCount: count,
      unisonOffsets: offsets,
      bpm,
      spatialModParams,
    };
    const voice = createVoice3DBass(ctx, spatial.input, chainInput, params, when, voiceOpts, rng);
    voices.push(voice);
    recordVoiceCreated();
  }

  handle.steal((fadeSec) => {
    voices.forEach((v) => v.steal(fadeSec));
  });

  const noteOffTime = when + opts.gateSec;
  voices.forEach((v) => v.noteOff(noteOffTime));

  const note: ActiveNote = { midi: opts.semitone, voices, handle, startTime: when, cleanupTimer: null };
  engine.notes.push(note);
  engine.lastMidi = opts.semitone;

  const releaseDelayMs = Math.max(50, (noteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
  note.cleanupTimer = setTimeout(() => cleanupNote(part.id, note), releaseDelayMs + 50);
}

/**
 * Release one live-performance 3D Bass note using the existing voice engine.
 * `semitone` uses the same MIDI-60 domain as triggerPart.
 */
export function releaseNote3DBass(partId: number, semitone: number, when: number): boolean {
  const engine = _engines.get(partId);
  if (!engine) return false;
  const note = [...engine.notes].reverse().find((candidate) => candidate.midi === semitone);
  if (!note) return false;

  if (note.cleanupTimer) { clearTimeout(note.cleanupTimer); note.cleanupTimer = null; }
  note.voices.forEach((voice) => voice.noteOff(when));

  const part = useGroove.getState().parts.find((candidate) => candidate.id === partId);
  const releaseSec = (part?.bass3d ?? defaultBass3D()).ampEnv.release;
  note.cleanupTimer = setTimeout(
    () => cleanupNote(partId, note),
    Math.max(50, (releaseSec + 0.35) * 1000),
  );
  return true;
}

/** Stop all notes for a part immediately (transport stop / audio restart). */
export function killAllNotes3DBass(partId: number): void {
  const engine = _engines.get(partId);
  if (!engine) return;
  engine.notes.forEach((note) => {
    if (note.cleanupTimer) { clearTimeout(note.cleanupTimer); note.cleanupTimer = null; }
    note.voices.forEach((v) => v.kill());
    note.handle.release();
  });
  engine.notes = [];
}

/** Clear all bass voice engines (call on audio restart). */
export function clearAll3DBass(): void {
  _engines.forEach((e) => {
    e.notes.forEach((n) => {
      if (n.cleanupTimer) { clearTimeout(n.cleanupTimer); n.cleanupTimer = null; }
      n.voices.forEach((v) => v.kill());
      n.handle.release();
    });
  });
  _engines.clear();
}
