// VibeCore 3D Synth — Voice Engine.
//
// Manages polyphony, unison, voice stealing, glide, and voice modes
// (mono / poly / legato) for the 3D Synth. Integrates with the central
// voice allocator (voiceAllocator.ts) so the 3D Synth shares the same
// priority language as all other modules.
//
// Realtime-safe: all operations are control-thread. Voice creation delegates
// to voice.ts (which creates AudioNodes on the control thread). Voice stealing
// uses the central allocator's steal callback (fast fade on the audio thread).

import { requestVoice, partVoiceClass, type VoiceHandle } from "@/lib/audio/voiceAllocator";
import { recordVoiceCreated, recordVoiceDestroyed } from "@/lib/audio/audioPerf";
import { mulberry32, hashSeed } from "@/lib/utils/random";
import { useGroove } from "@/lib/store";
import { getSpatialChain } from "./spatialEngine";
import { createVoice3D, computeUnisonOffsets, type Synth3DSynthVoice, type VoiceOpts3D } from "./voice";
import { defaultSynth3D, type Synth3DParams } from "./params";
import type { Part } from "@/lib/model";

interface ActiveNote {
  midi: number;
  voices: Synth3DSynthVoice[];
  handle: VoiceHandle;
  startTime: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

type NoteStartWaiter = () => void;

const _engines = new Map<number, { notes: ActiveNote[]; lastMidi: number }>();
const _noteStartWaiters = new Map<string, Set<NoteStartWaiter>>();

function noteKey(partId: number, semitone: number): string {
  return `${partId}:${semitone}`;
}

function notifyNoteStarted(partId: number, semitone: number): void {
  const key = noteKey(partId, semitone);
  const waiters = _noteStartWaiters.get(key);
  if (!waiters?.size) return;
  _noteStartWaiters.delete(key);
  for (const resolve of waiters) resolve();
}

/**
 * Await acknowledgement from the existing voice engine that a newly-triggered
 * 3D Synth note has actually been registered. Call this BEFORE triggerPart().
 * It closes the dynamic-import acknowledgement gap without adding a second
 * allocator or renderer.
 */
export function waitForNoteStart3D(
  partId: number,
  semitone: number,
  timeoutMs = 1000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const key = noteKey(partId, semitone);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (started: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const set = _noteStartWaiters.get(key);
      set?.delete(onStarted);
      if (set && set.size === 0) _noteStartWaiters.delete(key);
      resolve(started);
    };
    const onStarted = () => finish(true);

    let set = _noteStartWaiters.get(key);
    if (!set) {
      set = new Set();
      _noteStartWaiters.set(key, set);
    }
    set.add(onStarted);
    timer = setTimeout(() => finish(false), Math.max(50, timeoutMs));
  });
}

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

export function triggerNote3D(
  ctx: AudioContext,
  chainInput: AudioNode,
  part: Part,
  when: number,
  opts: { velocity: number; semitone: number; gateSec: number; aftertouch?: number },
): void {
  const params: Synth3DParams = part.synth3d ?? defaultSynth3D();
  const engine = getEngine(part.id);
  const perf = params.performance;

  const { module, priority } = partVoiceClass(part);
  const handle = requestVoice(part.id, module, priority);
  if (!handle) return;

  const spatial = getSpatialChain(ctx, part.id, params.spatial);
  try { spatial.output.connect(chainInput); } catch { /* already connected */ }

  const spatialModParams: VoiceOpts3D["spatialModParams"] = {
    width: spatial.widthGain?.gain,
    azimuth: spatial.panner && "pan" in spatial.panner ? (spatial.panner as StereoPannerNode).pan : undefined,
    distance: spatial.distanceGain?.gain,
    elevation: spatial.panner && "positionY" in spatial.panner ? (spatial.panner as PannerNode).positionY : undefined,
  };

  const uni = params.unison;
  const count = uni.enabled ? Math.max(1, Math.min(7, uni.count)) : 1;
  const rng = mulberry32(hashSeed(hashSeed(part.id, opts.semitone), Math.floor(when * 1000)));
  const bpm = useGroove.getState().bpm;

  if (perf.mode !== "poly" && engine.notes.length > 0) {
    const oldNote = engine.notes[0];
    if (oldNote.cleanupTimer) { clearTimeout(oldNote.cleanupTimer); oldNote.cleanupTimer = null; }
    oldNote.voices.forEach((v) => v.steal(0.03));
    oldNote.handle.release();
    engine.notes = [];
  }

  const voices: Synth3DSynthVoice[] = [];
  for (let i = 0; i < count; i++) {
    const offsets = computeUnisonOffsets(i, count, uni.detune, uni.spread, uni.phaseRandom, rng);
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
    const voice = createVoice3D(ctx, spatial.input, params, when, voiceOpts, rng);
    voices.push(voice);
    recordVoiceCreated();
  }

  handle.steal((fadeSec) => {
    voices.forEach((v) => v.steal(fadeSec));
  });

  const note: ActiveNote = { midi: opts.semitone, voices, handle, startTime: when, cleanupTimer: null };
  engine.notes.push(note);
  engine.lastMidi = opts.semitone;
  notifyNoteStarted(part.id, opts.semitone);

  const noteOffTime = when + opts.gateSec;
  voices.forEach((v) => v.noteOff(noteOffTime));

  const releaseDelayMs = Math.max(50, (noteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
  note.cleanupTimer = window.setTimeout(() => cleanupNote(part.id, note), releaseDelayMs + 50);
}

/**
 * Release one live-performance 3D Synth note using the existing voice engine.
 * The underlying voice.noteOff() currently does not re-schedule an already
 * planned ADSR gate, while steal() explicitly cancels scheduled gain events and
 * fades from the live value. For live key-up, reuse that proven fade primitive
 * with the patch's release time rather than pretending the scheduled gate was
 * shortened.
 */
export function releaseNote3D(partId: number, semitone: number, _when: number): boolean {
  const engine = _engines.get(partId);
  if (!engine) return false;
  const note = [...engine.notes].reverse().find((candidate) => candidate.midi === semitone);
  if (!note) return false;

  if (note.cleanupTimer) { clearTimeout(note.cleanupTimer); note.cleanupTimer = null; }
  const part = useGroove.getState().parts.find((candidate) => candidate.id === partId);
  const releaseSec = Math.max(0.005, (part?.synth3d ?? defaultSynth3D()).ampEnv.release);
  note.voices.forEach((voice) => voice.steal(releaseSec));
  note.cleanupTimer = window.setTimeout(
    () => cleanupNote(partId, note),
    Math.max(50, (releaseSec + 0.1) * 1000),
  );
  return true;
}

export function killAllNotes3D(partId: number): void {
  const engine = _engines.get(partId);
  if (!engine) return;
  engine.notes.forEach((note) => {
    if (note.cleanupTimer) { clearTimeout(note.cleanupTimer); note.cleanupTimer = null; }
    note.voices.forEach((v) => v.kill());
    note.handle.release();
  });
  engine.notes = [];
}

export function clearAll3D(): void {
  _engines.forEach((e) => {
    e.notes.forEach((n) => {
      if (n.cleanupTimer) { clearTimeout(n.cleanupTimer); n.cleanupTimer = null; }
      n.voices.forEach((v) => v.kill());
      n.handle.release();
    });
  });
  _engines.clear();
}
