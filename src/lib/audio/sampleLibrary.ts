// VibeCoreLiv3 — Sample Library.
// Eine umfangreiche, eingebaut prozedural gerenderte Sample-Bibliothek.
// Rezepte = SynthParams-Varianten der bestehenden Synth-Engine; ein Klick
// rendert den One-Shot offline (OfflineAudioContext) und weist ihn dem
// gewählten Part zu. Keine externen Audiodateien nötig.

import { defaultSynth, engineForCategory, type PartCategory, type SynthParams } from "@/lib/model";
import { ensureAudio, getCtx, isValidAudioBuffer } from "@/lib/audio/engine";
import { triggerSynth } from "@/lib/audio/synthVoice";

export interface SampleRecipe {
  id: string;
  name: string;
  category: PartCategory;
  synth: SynthParams;
  durationSec: number;
  loop: boolean;
}

function ov(base: SynthParams, patch: Partial<SynthParams>): SynthParams {
  return { ...base, ...patch };
}

function recipe(
  category: PartCategory,
  name: string,
  patch: Partial<SynthParams>,
  durationSec: number,
  loop = false,
): SampleRecipe {
  const base = defaultSynth(engineForCategory(category));
  return { id: `${category}:${name}`, name, category, synth: ov(base, patch), durationSec, loop };
}

export const SAMPLE_CATALOG: SampleRecipe[] = [
  // ── KICK ───────────────────────────────────────────────────────────────
  recipe("kick", "Kick Deep",   { kPitch: 28, kDecay: 78, kSub: 72, kClick: 14, kBody: 70, kDrive: 12 }, 0.8),
  recipe("kick", "Kick Punch",  { kPitch: 55, kDecay: 42, kSub: 50, kClick: 28, kBody: 82, kDrive: 18 }, 0.6),
  recipe("kick", "Kick 808",    { kPitch: 35, kDecay: 90, kSub: 85, kClick: 6,  kBody: 60, kDrive: 6 },  1.0),
  recipe("kick", "Kick Sub",    { kPitch: 22, kDecay: 70, kSub: 95, kClick: 8,  kBody: 55 }, 0.9),
  recipe("kick", "Kick Click",  { kPitch: 60, kDecay: 38, kSub: 35, kClick: 55, kBody: 75 }, 0.5),
  recipe("kick", "Kick Tape",   { kPitch: 45, kDecay: 55, kSub: 60, kClick: 20, kBody: 70, kDrive: 35 }, 0.6),
  recipe("kick", "Kick Boomy",  { kPitch: 30, kDecay: 85, kSub: 78, kClick: 10, kBody: 65 }, 0.9),
  recipe("kick", "Kick Tight",  { kPitch: 65, kDecay: 32, kSub: 30, kClick: 35, kBody: 80, kDrive: 22 }, 0.4),
  recipe("kick", "Kick Hard",   { kPitch: 50, kDecay: 40, kSub: 45, kClick: 40, kBody: 88, kDrive: 45 }, 0.5),
  recipe("kick", "Kick Soft",   { kPitch: 40, kDecay: 50, kSub: 55, kClick: 12, kBody: 60 }, 0.6),

  // ── SNARE ──────────────────────────────────────────────────────────────
  recipe("snare", "Snare Crack", { sNoise: 70, sTone: 35, sSnap: 70, sDecay: 22 }, 0.5),
  recipe("snare", "Snare Fat",  { sNoise: 55, sTone: 65, sSnap: 40, sDecay: 45 }, 0.7),
  recipe("snare", "Snare Room", { sNoise: 60, sTone: 50, sSnap: 55, sDecay: 60 }, 0.8),
  recipe("snare", "Snare Dry",  { sNoise: 80, sTone: 30, sSnap: 45, sDecay: 25 }, 0.4),
  recipe("snare", "Snare Snap", { sNoise: 85, sTone: 25, sSnap: 80, sDecay: 20 }, 0.4),
  recipe("snare", "Snare Rim",   { sNoise: 40, sTone: 70, sSnap: 60, sDecay: 18 }, 0.4),
  recipe("snare", "Snare Brush", { sNoise: 50, sTone: 40, sSnap: 35, sDecay: 38 }, 0.6),
  recipe("snare", "Snare Tight", { sNoise: 75, sTone: 45, sSnap: 50, sDecay: 16 }, 0.35),

  // ── PERC (Snare-engine, getönt) ─────────────────────────────────────────
  recipe("perc", "Perc Tom",    { sNoise: 25, sTone: 80, sSnap: 20, sDecay: 40 }, 0.6),
  recipe("perc", "Perc Clap",  { sNoise: 90, sTone: 20, sSnap: 35, sDecay: 30 }, 0.5),
  recipe("perc", "Perc Rim",   { sNoise: 35, sTone: 70, sSnap: 75, sDecay: 15 }, 0.3),
  recipe("perc", "Perc Click",  { sNoise: 60, sTone: 30, sSnap: 90, sDecay: 10 }, 0.25),
  recipe("perc", "Perc Wood",  { sNoise: 30, sTone: 75, sSnap: 65, sDecay: 14 }, 0.3),
  recipe("perc", "Perc Conga", { sNoise: 18, sTone: 85, sSnap: 25, sDecay: 35 }, 0.5),

  // ── HAT ─────────────────────────────────────────────────────────────────
  recipe("hat", "Hat Closed",  { hMetal: 60, hNoise: 55, hFilter: 75, hDecay: 12 }, 0.2),
  recipe("hat", "Hat Open",    { hMetal: 65, hNoise: 50, hFilter: 70, hDecay: 60 }, 0.5),
  recipe("hat", "Hat Tight",   { hMetal: 55, hNoise: 60, hFilter: 85, hDecay: 8 },  0.15),
  recipe("hat", "Hat Splash",  { hMetal: 75, hNoise: 45, hFilter: 65, hDecay: 70 }, 0.6),
  recipe("hat", "Hat Crash",   { hMetal: 80, hNoise: 40, hFilter: 55, hDecay: 90 }, 0.8),
  recipe("hat", "Hat Metallic", { hMetal: 95, hNoise: 30, hFilter: 80, hDecay: 25 }, 0.3),
  recipe("hat", "Hat Soft",    { hMetal: 40, hNoise: 70, hFilter: 60, hDecay: 20 }, 0.25),
  recipe("hat", "Hat Short",   { hMetal: 50, hNoise: 65, hFilter: 90, hDecay: 6 },  0.12),

  // ── BASS ────────────────────────────────────────────────────────────────
  recipe("bass", "Bass Sub",   { bOsc: 20, bSub: 90, bFilter: 35, bFm: 5,  bDecay: 80, bGlide: 0 },  0.5),
  recipe("bass", "Bass Reese", { bOsc: 60, bSub: 50, bFilter: 50, bFm: 15, bDecay: 70, bGlide: 10 }, 0.6),
  recipe("bass", "Bass Saw",   { bOsc: 90, bSub: 30, bFilter: 60, bFm: 10, bDecay: 55, bGlide: 0 },  0.5),
  recipe("bass", "Bass Square", { bOsc: 10, bSub: 60, bFilter: 55, bFm: 8,  bDecay: 60, bGlide: 0 },  0.5),
  recipe("bass", "Bass FM",    { bOsc: 50, bSub: 40, bFilter: 70, bFm: 65, bDecay: 50, bGlide: 5 },  0.5),
  recipe("bass", "Bass Acid",   { bOsc: 80, bSub: 25, bFilter: 85, bFm: 20, bDecay: 45, bGlide: 25 }, 0.4),
  recipe("bass", "Bass Pluck", { bOsc: 70, bSub: 35, bFilter: 65, bFm: 12, bDecay: 30, bGlide: 0 },  0.35),
  recipe("bass", "Bass Wobble", { bOsc: 55, bSub: 55, bFilter: 75, bFm: 40, bDecay: 75, bGlide: 15 }, 0.6),

  // ── SYNTH ───────────────────────────────────────────────────────────────
  recipe("synth", "Synth Pad",    { morph: 30, fmAmount: 20, fmRatio: 30, voices: 4, detune: 30, spread: 70, fAttack: 50, fDecay: 40, fSustain: 80, fRelease: 60 }, 1.2),
  recipe("synth", "Synth Pluck",  { morph: 60, fmAmount: 30, fmRatio: 40, voices: 1, detune: 0,  spread: 0,  fAttack: 5,  fDecay: 50, fSustain: 10, fRelease: 30 }, 0.5),
  recipe("synth", "Synth Stab",   { morph: 70, fmAmount: 45, fmRatio: 50, voices: 2, detune: 15, spread: 40, fAttack: 5,  fDecay: 30, fSustain: 20, fRelease: 25 }, 0.4),
  recipe("synth", "Synth Lead",   { morph: 85, fmAmount: 35, fmRatio: 35, voices: 2, detune: 10, spread: 30, fAttack: 8,  fDecay: 35, fSustain: 70, fRelease: 35 }, 0.8),
  recipe("synth", "Synth FM",     { morph: 20, fmAmount: 80, fmRatio: 60, voices: 1, detune: 0,  spread: 0,  fAttack: 10, fDecay: 40, fSustain: 60, fRelease: 45 }, 0.7),
  recipe("synth", "Synth Saw",    { morph: 95, fmAmount: 10, fmRatio: 20, voices: 3, detune: 25, spread: 60, fAttack: 5,  fDecay: 30, fSustain: 75, fRelease: 40 }, 0.8),
  recipe("synth", "Synth Sine",   { morph: 5,  fmAmount: 15, fmRatio: 25, voices: 1, detune: 0,  spread: 0,  fAttack: 20, fDecay: 30, fSustain: 80, fRelease: 50 }, 0.9),
  recipe("synth", "Synth Detune", { morph: 75, fmAmount: 25, fmRatio: 45, voices: 5, detune: 50, spread: 85, fAttack: 15, fDecay: 35, fSustain: 70, fRelease: 55 }, 1.0),

  // ── SAMPLE / TEXTURE (loopbar) ───────────────────────────────────────────
  recipe("sample", "Texture Pad",   { morph: 25, fmAmount: 30, fmRatio: 35, voices: 4, detune: 35, spread: 80, fAttack: 60, fDecay: 50, fSustain: 90, fRelease: 70 }, 4.0, true),
  recipe("sample", "Texture Drone", { morph: 40, fmAmount: 55, fmRatio: 70, voices: 2, detune: 45, spread: 60, fAttack: 80, fDecay: 40, fSustain: 95, fRelease: 80 }, 5.0, true),
  recipe("sample", "Texture Sweep", { morph: 80, fmAmount: 40, fmRatio: 50, voices: 3, detune: 30, spread: 90, fAttack: 90, fDecay: 60, fSustain: 70, fRelease: 60 }, 3.5, true),
  recipe("sample", "Texture Bell", { morph: 10, fmAmount: 60, fmRatio: 80, voices: 1, detune: 0,  spread: 0,  fAttack: 5,  fDecay: 80, fSustain: 20, fRelease: 90 }, 2.5, true),
  recipe("sample", "Texture Air",   { morph: 50, fmAmount: 20, fmRatio: 25, voices: 6, detune: 60, spread: 100, fAttack: 70, fDecay: 30, fSustain: 85, fRelease: 65 }, 4.0, true),
  recipe("sample", "Texture Voxel", { morph: 65, fmAmount: 70, fmRatio: 65, voices: 3, detune: 40, spread: 70, fAttack: 40, fDecay: 45, fSustain: 80, fRelease: 75 }, 3.0, true),
];

/** Rendert ein Rezept offline zu einem AudioBuffer (One-Shot/Loop). */
export async function renderSampleRecipe(r: SampleRecipe): Promise<AudioBuffer> {
  await ensureAudio();
  const live = getCtx();
  const sr = live?.sampleRate ?? 48000;
  const tail = 0.15;
  const length = Math.ceil(sr * (r.durationSec + tail));
  const Ctor = (window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext) as typeof OfflineAudioContext;
  const off = new Ctor(1, length, sr);
  const dest = off.createGain();
  dest.connect(off.destination);
  triggerSynth(off, dest, r.synth, 0.01, { velocity: 110, gateSec: r.durationSec });
  const buf = await off.startRendering();
  if (!isValidAudioBuffer(buf)) throw new Error("Sample render failed");
  return buf;
}