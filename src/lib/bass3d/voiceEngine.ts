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
import { mulberry32, hashSeed, type Rng } from "@/lib/utils/random";
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
  // Ensure spatial chain output → chainInput (part's chain.input)
  try { spatial.output.connect(chainInput); } catch { /* already connected */ }

  // Collect modulatable AudioParams from the spatial chain for the mod matrix
  const spatialModParams: VoiceOpts3D["spatialModParams"] = {
    width: spatial.widthGain?.gain,
    azimuth: spatial.panner && "pan" in spatial.panner ? (spatial.panner as StereoPannerNode).pan : undefined,
    distance: spatial.distanceGain?.gain,
    elevation: spatial.panner && "positionY" in spatial.panner ? (spatial.panner as PannerNode).positionY : undefined,
  };

  // ── Unison ──────────────────────────────────────────────────────────────
  const uni = params.unison;
  const count = uni.enabled ? Math.max(1, Math.min(5, uni.count)) : 1; // bass: 1..5
  const rng = mulberry32(hashSeed(hashSeed(part.id, opts.semitone), Math.floor(when * 1000)));
  const bpm = useGroove.getState().bpm;

  // ── Mono / Legato: glide existing voices or fast-fade ──────────────
  if (perf.mode !== "poly" && engine.notes.length > 0) {
    if (perf.glideMode !== "off" && perf.glideTime > 0) {
      // REVIEW FIX R2: True legato glide — re-pitch existing oscillators via
      // detune ramp, extend the gate, no new attack. The voice stays alive
      // seamlessly. The amp env remains in sustain; only pitch glides.
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
      // Reschedule engine-level cleanup for the extended note
      const releaseDelayMs = Math.max(50, (newNoteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
      oldNote.cleanupTimer = setTimeout(() => {
        oldNote.handle.release();
        const idx = engine.notes.indexOf(oldNote);
        if (idx >= 0) engine.notes.splice(idx, 1);
        recordVoiceDestroyed();
      }, releaseDelayMs + 50);
      return; // don't create new voices — the existing note continues
    } else {
      // No glide: fast-fade + new note
      const oldNote = engine.notes[0];
      if (oldNote.cleanupTimer) { clearTimeout(oldNote.cleanupTimer); oldNote.cleanupTimer = null; }
      oldNote.voices.forEach((v) => v.steal(0.03));
      oldNote.handle.release();
      engine.notes = [];
    }
  }

  // REVIEW FIX R3: Enforce per-part polyphony limit in poly mode.
  // Without this, rapid triggering could exceed the intended polyphony and
  // consume the entire global voice budget. Steal the oldest note when the
  // per-part limit is reached (same fast-fade as allocator stealing).
  if (perf.mode === "poly" && engine.notes.length >= perf.polyphony) {
    const oldest = engine.notes[0];
    if (oldest.cleanupTimer) { clearTimeout(oldest.cleanupTimer); oldest.cleanupTimer = null; }
    oldest.voices.forEach((v) => v.steal(0.03));
    oldest.handle.release();
    engine.notes.shift();
    recordVoiceDestroyed();
  }

  // ── Create unison voices ────────────────────────────────────────────────
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
    // Bass voice: harmonic path → spatial.input, sub path → chainInput (direct mono)
    const voice = createVoice3DBass(ctx, spatial.input, chainInput, params, when, voiceOpts, rng);
    voices.push(voice);
    recordVoiceCreated();
  }

  // ── Register with allocator for stealing ────────────────────────────────
  handle.steal((fadeSec) => {
    voices.forEach((v) => v.steal(fadeSec));
  });

  // ── Schedule note-off ────────────────────────────────────────────────────
  const noteOffTime = when + opts.gateSec;
  voices.forEach((v) => v.noteOff(noteOffTime));

  // ── Track active note ──────────────────────────────────────────────────
  const note: ActiveNote = { midi: opts.semitone, voices, handle, startTime: when, cleanupTimer: null };
  engine.notes.push(note);
  engine.lastMidi = opts.semitone;

  // ── Schedule engine-level cleanup ────────────────────────────────────────
  const releaseDelayMs = Math.max(50, (noteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
  note.cleanupTimer = setTimeout(() => {
    handle.release();
    const idx = engine.notes.indexOf(note);
    if (idx >= 0) engine.notes.splice(idx, 1);
    recordVoiceDestroyed();
  }, releaseDelayMs + 50);
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