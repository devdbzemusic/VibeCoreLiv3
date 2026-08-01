// VibeCore AI — Voice Assistant.
//
// Erzeugt Vocal-Timing-, Pitch-, Harmonie- und Layer-Vorschläge. Die AI kennt
// keine Vocals direkt — sie schlägt Note-Arrays vor, die über `setNotes` auf
// einem Vocal/Sample-Part angewendet werden. Deterministisch, seed-basiert.

import type { Note } from "@/lib/model";
import type { ContextSnapshot, Suggestion, VoicePayload } from "./types";
import { makeRng, suggestionId, randInt, scaleDegreeToMidi, isInScale } from "./engine";

export interface VoiceOpts {
  seed?: number;
  partId?: number;
}

function findVoicePart(ctx: ContextSnapshot): number {
  return ctx.parts.find((p) => p.category === "sample")?.id
    ?? ctx.parts.find((p) => p.category === "synth")?.id ?? 10;
}

export function suggestVocalTiming(
  ctx: ContextSnapshot, notes: Omit<Note, "id">[], opts: VoiceOpts = {},
): Suggestion<VoicePayload> {
  const seed = opts.seed ?? 101100;
  const partId = opts.partId ?? findVoicePart(ctx);
  const stepsPerBeat = 4;

  const adjusted = notes.map((n) => ({
    ...n,
    step: Math.max(0, Math.round(n.step / stepsPerBeat) * stepsPerBeat),
    length: Math.max(stepsPerBeat, Math.round(n.length / stepsPerBeat) * stepsPerBeat),
  }));

  return {
    id: suggestionId("voice", seed), kind: "voice", label: "Vocal Timing",
    description: "Quantize vocal onsets to the beat grid for tighter timing.",
    confidence: 0.6, seed, payload: { partId, notes: adjusted },
  };
}

export function suggestVocalPitch(
  ctx: ContextSnapshot, notes: Omit<Note, "id">[], opts: VoiceOpts = {},
): Suggestion<VoicePayload> {
  const seed = opts.seed ?? 102100;
  const partId = opts.partId ?? findVoicePart(ctx);
  const { root, scale } = ctx.harmony;

  const corrected = notes.map((n) => {
    let pitch = n.pitch;
    if (!isInScale(root, scale, pitch)) {
      for (let d = 1; d <= 2; d++) {
        if (isInScale(root, scale, pitch + d)) { pitch += d; break; }
        if (isInScale(root, scale, pitch - d)) { pitch -= d; break; }
      }
    }
    return { ...n, pitch };
  });

  return {
    id: suggestionId("voice", seed), kind: "voice", label: "Pitch Correction",
    description: `Snap vocal pitches to the nearest scale note (${scale}).`,
    confidence: 0.7, seed, payload: { partId, notes: corrected },
  };
}

export function suggestVocalHarmony(
  ctx: ContextSnapshot, melody: Omit<Note, "id">[], opts: VoiceOpts = {},
): Suggestion<VoicePayload> {
  const seed = opts.seed ?? 103100;
  const partId = opts.partId ?? findVoicePart(ctx);
  const { root, scale } = ctx.harmony;

  // Diatonic third above: add the scale-degree-2 interval to the melody pitch.
  // This keeps the harmony in the same octave as the melody (a third higher),
  // and if the melody is in-scale, the harmony is too (diatonic transposition).
  const thirdInterval = scaleDegreeToMidi(0, scale, 2) - scaleDegreeToMidi(0, scale, 0);
  const harmony = melody.map((n) => {
    const harmonyPitch = n.pitch + thirdInterval;
    return { ...n, pitch: Math.min(84, harmonyPitch), velocity: Math.max(40, n.velocity - 20) };
  });

  return {
    id: suggestionId("voice", seed), kind: "voice", label: "Harmony Line",
    description: "Diatonic thirds above the melody — classic vocal harmony.",
    confidence: 0.7, seed, payload: { partId, notes: melody, harmony },
  };
}

export function suggestVocalLayer(
  ctx: ContextSnapshot, notes: Omit<Note, "id">[], opts: VoiceOpts = {},
): Suggestion<VoicePayload> {
  const seed = opts.seed ?? 104100;
  const partId = opts.partId ?? findVoicePart(ctx);
  const rng = makeRng(seed, 9);

  const layered = notes.map((n) => ({
    ...n,
    pitch: n.pitch - 12,
    velocity: Math.max(30, n.velocity - 15 + randInt(rng, -5, 5)),
  }));

  return {
    id: suggestionId("voice", seed), kind: "voice", label: "Octave Layer",
    description: "Octave-down double for vocal thickness and depth.",
    confidence: 0.6, seed, payload: { partId, notes: layered },
  };
}

export function suggestVocalPhrase(
  ctx: ContextSnapshot, opts: VoiceOpts = {},
): Suggestion<VoicePayload> {
  const seed = opts.seed ?? 105100;
  const partId = opts.partId ?? findVoicePart(ctx);
  const rng = makeRng(seed, 33);
  const { root, scale } = ctx.harmony;
  const length = ctx.sceneLength;
  const numNotes = Math.max(2, Math.floor(length / 4));

  const notes: Omit<Note, "id">[] = [];
  let pos = 0;
  let deg = 0;
  for (let i = 0; i < numNotes && pos < length; i++) {
    const dur = randInt(rng, 2, 4);
    const pitch = scaleDegreeToMidi(root + 60, scale, deg);
    notes.push({ step: pos, pitch, length: Math.min(dur, length - pos), velocity: 70 + randInt(rng, -10, 15) });
    pos += dur;
    deg += randInt(rng, -1, 2);
    deg = Math.max(-3, Math.min(5, deg));
  }

  return {
    id: suggestionId("voice", seed), kind: "voice", label: "Vocal Phrase",
    description: `${numNotes}-note phrase in ${scale} — stepwise motion with rests.`,
    confidence: 0.6, seed, payload: { partId, notes },
  };
}