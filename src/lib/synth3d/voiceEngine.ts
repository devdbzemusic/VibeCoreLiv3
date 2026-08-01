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
import { mulberry32, hashSeed, type Rng } from "@/lib/utils/random";
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
}

// Per-part voice engines
const _engines = new Map<number, { notes: ActiveNote[]; lastMidi: number }>();

function getEngine(partId: number) {
  let e = _engines.get(partId);
  if (!e) { e = { notes: [], lastMidi: -1 }; _engines.set(partId, e); }
  return e;
}

/** Trigger a 3D Synth note. Called from the engine's triggerPart path. */
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

  // ── Voice allocation via central allocator ─────────────────────────────
  const { module, priority } = partVoiceClass(part);
  const handle = requestVoice(part.id, module, priority);
  if (!handle) return; // dropped — all active voices are more critical

  // ── Spatial chain (shared per-part) ────────────────────────────────────
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
  const count = uni.enabled ? Math.max(1, Math.min(7, uni.count)) : 1;
  const rng = mulberry32(hashSeed(hashSeed(part.id, opts.semitone), Math.floor(when * 1000)));
  const bpm = useGroove.getState().bpm;

  // ── Mono / Legato: retrigger existing voices ──────────────────────────
  if (perf.mode !== "poly" && engine.notes.length > 0) {
    // For mono/legato, we steal the existing note's voices and create new ones
    // with the new pitch. Glide is handled by the oscillator frequency ramp.
    // For simplicity, we fast-fade old voices and create new ones — true
    // legato glide would re-pitch existing oscillators.
    const oldNote = engine.notes[0];
    oldNote.voices.forEach((v) => v.steal(0.03));
    oldNote.handle.release();
    engine.notes = [];
  }

  // ── Create unison voices ────────────────────────────────────────────────
  const voices: Synth3DSynthVoice[] = [];
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
    const voice = createVoice3D(ctx, spatial.input, params, when, voiceOpts, rng);
    voices.push(voice);
    recordVoiceCreated();
  }

  // ── Register with allocator for stealing ────────────────────────────────
  handle.steal((fadeSec) => {
    voices.forEach((v) => v.steal(fadeSec));
  });

  // ── Track active note ──────────────────────────────────────────────────
  const note: ActiveNote = { midi: opts.semitone, voices, handle, startTime: when };
  engine.notes.push(note);
  engine.lastMidi = opts.semitone;

  // ── Schedule note-off + cleanup ────────────────────────────────────────
  const noteOffTime = when + opts.gateSec;
  voices.forEach((v) => v.noteOff(noteOffTime));

  // Release the allocator handle after the note completes
  const releaseDelayMs = Math.max(50, (noteOffTime + params.ampEnv.release + 0.3 - ctx.currentTime) * 1000);
  window.setTimeout(() => {
    handle.release();
    const idx = engine.notes.indexOf(note);
    if (idx >= 0) engine.notes.splice(idx, 1);
    recordVoiceDestroyed();
  }, releaseDelayMs + 50);
}

/** Stop all notes for a part immediately (used on transport stop / audio restart). */
export function killAllNotes3D(partId: number): void {
  const engine = _engines.get(partId);
  if (!engine) return;
  engine.notes.forEach((note) => {
    note.voices.forEach((v) => v.kill());
    note.handle.release();
  });
  engine.notes = [];
}

/** Clear all voice engines (call on audio restart). */
export function clearAll3D(): void {
  _engines.forEach((e) => {
    e.notes.forEach((n) => {
      n.voices.forEach((v) => v.kill());
      n.handle.release();
    });
  });
  _engines.clear();
}