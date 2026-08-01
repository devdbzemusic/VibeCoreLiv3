// Synth voice generators for VibeCore LIV3 Sound Editor.
// Each trigger creates short-lived nodes that feed into the part's channel input.

import type { SynthParams } from "@/lib/model";
import { triggerGravLaceBass } from "./gravLaceBass";
import { MIDI_A4, semiToHz, getNoiseBuffer } from "@/lib/dsp";

interface VoiceOpts {
  velocity?: number; // 0..127
  semitone?: number;
  gateSec?: number;
}

export function triggerSynth(
  c: AudioContext,
  destination: AudioNode,
  s: SynthParams,
  when: number,
  opts: VoiceOpts = {},
) {
  const vel = (opts.velocity ?? 100) / 127;
  const semi = opts.semitone ?? 0;

  switch (s.engine) {
    case "Kick":  return voiceKick(c, destination, s, when, vel);
    case "Snare": return voiceSnare(c, destination, s, when, vel);
    case "Hat":   return voiceHat(c, destination, s, when, vel);
    case "Bass":  return triggerGravLaceBass(c, destination, s, when, vel, semi, opts.gateSec ?? 0.25);
    case "Synth": return voiceFmMorph(c, destination, s, when, vel, semi, opts.gateSec ?? 0.6);
  }
}

function voiceKick(c: AudioContext, dest: AudioNode, s: SynthParams, when: number, vel: number) {
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(dest);

  // Body osc with pitch envelope
  const osc = c.createOscillator(); osc.type = "sine";
  const startHz = 50 + (s.kPitch / 100) * 300;     // 50..350
  const endHz   = 30 + (s.kPitch / 100) * 30;       // 30..60
  osc.frequency.setValueAtTime(startHz, when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), when + 0.08);

  // Drive
  const shaper = c.createWaveShaper();
  const k = 1 + (s.kDrive / 100) * 8;
  const N = 1024; const cv = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; cv[i] = Math.tanh(x * k); }
  shaper.curve = cv;

  const body = c.createGain();
  body.gain.setValueAtTime(0, when);
  body.gain.linearRampToValueAtTime((s.kBody / 100) * vel, when + 0.002);
  const decay = 0.08 + (s.kDecay / 100) * 0.7;
  body.gain.exponentialRampToValueAtTime(0.0001, when + decay);

  osc.connect(body).connect(shaper).connect(out);

  // Sub
  const sub = c.createOscillator(); sub.type = "sine";
  sub.frequency.value = 40 + (s.kPitch / 100) * 30;
  const subG = c.createGain();
  subG.gain.setValueAtTime(0, when);
  subG.gain.linearRampToValueAtTime((s.kSub / 100) * vel * 0.7, when + 0.005);
  subG.gain.exponentialRampToValueAtTime(0.0001, when + decay * 1.2);
  sub.connect(subG).connect(out);

  // Click (filtered noise burst)
  const click = c.createBufferSource(); click.buffer = getNoiseBuffer(c, "white");
  const clickHp = c.createBiquadFilter(); clickHp.type = "highpass"; clickHp.frequency.value = 2500;
  const clickG = c.createGain();
  clickG.gain.setValueAtTime((s.kClick / 100) * vel * 0.8, when);
  clickG.gain.exponentialRampToValueAtTime(0.0001, when + 0.02);
  click.connect(clickHp).connect(clickG).connect(out);

  out.gain.setValueAtTime(1, when);
  osc.start(when); sub.start(when); click.start(when);
  osc.stop(when + decay + 0.05); sub.stop(when + decay * 1.2 + 0.05); click.stop(when + 0.05);
}

function voiceSnare(c: AudioContext, dest: AudioNode, s: SynthParams, when: number, vel: number) {
  const out = c.createGain(); out.gain.value = 1; out.connect(dest);
  const decay = 0.05 + (s.sDecay / 100) * 0.5;

  // Tonal layer (two oscillators)
  const o1 = c.createOscillator(); o1.type = "triangle"; o1.frequency.value = 180;
  const o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.value = 330;
  const tone = c.createGain();
  tone.gain.setValueAtTime(0, when);
  tone.gain.linearRampToValueAtTime((s.sTone / 100) * vel * 0.6, when + 0.001);
  tone.gain.exponentialRampToValueAtTime(0.0001, when + decay * 0.6);
  o1.connect(tone); o2.connect(tone); tone.connect(out);

  // Noise
  const n = c.createBufferSource(); n.buffer = getNoiseBuffer(c, "white");
  const nhp = c.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 800 + (s.sSnap / 100) * 3000;
  const nG = c.createGain();
  // 1ms attack ramp — instant-on noise gain caused a broadband click.
  nG.gain.setValueAtTime(0.0001, when);
  nG.gain.exponentialRampToValueAtTime(Math.max(0.0001, (s.sNoise / 100) * vel), when + 0.001);
  nG.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  n.connect(nhp).connect(nG).connect(out);

  o1.start(when); o2.start(when); n.start(when);
  o1.stop(when + decay + 0.05); o2.stop(when + decay + 0.05); n.stop(when + decay + 0.05);
}

function voiceHat(c: AudioContext, dest: AudioNode, s: SynthParams, when: number, vel: number) {
  const out = c.createGain(); out.gain.value = 1; out.connect(dest);
  const decay = 0.02 + (s.hDecay / 100) * 0.4;

  // Metallic: 6 square oscillators with inharmonic ratios → bandpass
  const ratios = [1, 1.342, 1.781, 2.199, 2.671, 3.157];
  const metalGain = c.createGain();
  metalGain.gain.value = (s.hMetal / 100) * 0.25;
  const base = 320;
  const oscs: OscillatorNode[] = [];
  ratios.forEach((r) => {
    const o = c.createOscillator(); o.type = "square"; o.frequency.value = base * r;
    o.connect(metalGain); oscs.push(o);
  });

  // Noise layer
  const n = c.createBufferSource(); n.buffer = getNoiseBuffer(c, "white");
  const noiseG = c.createGain(); noiseG.gain.value = (s.hNoise / 100) * 0.6;
  n.connect(noiseG);

  const bp = c.createBiquadFilter(); bp.type = "highpass";
  bp.frequency.value = 2000 + (s.hFilter / 100) * 10000;
  bp.Q.value = 1.2;

  const env = c.createGain();
  // 1ms attack ramp — avoids the instant-on DC step (audible click) the
  // previous setValueAtTime(vel, when) produced on every hat trigger.
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, vel), when + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, when + decay);

  metalGain.connect(bp); noiseG.connect(bp);
  bp.connect(env).connect(out);

  oscs.forEach((o) => { o.start(when); o.stop(when + decay + 0.05); });
  n.start(when); n.stop(when + decay + 0.05);
}

// Bass voice is implemented by the GravLace engine module — see gravLaceBass.ts.
// Routed from triggerSynth's "Bass" case so the shared arp coupling, voice-cap
// and channel strip all apply unchanged.

function voiceFmMorph(c: AudioContext, dest: AudioNode, s: SynthParams, when: number, vel: number, semi: number, gate: number) {
  const out = c.createGain(); out.gain.value = 1; out.connect(dest);
  const root = semiToHz(MIDI_A4, semi);
  const voices = Math.max(1, Math.min(8, Math.round(s.voices)));
  const spread = (s.spread / 100);
  const detuneCents = s.detune * 2; // 0..200 cents max

  // Morph between sine ↔ triangle ↔ sawtooth via two layered oscillators
  const morph = s.morph / 100; // 0=sine, .5=tri, 1=saw
  const typeA: OscillatorType = morph < 0.5 ? "sine" : "triangle";
  const typeB: OscillatorType = morph < 0.5 ? "triangle" : "sawtooth";
  const blendB = morph < 0.5 ? morph * 2 : (morph - 0.5) * 2;

  // FM modulator (per voice, shared ratio)
  const ratio = 0.25 + (s.fmRatio / 100) * 7.75; // 0.25..8

  const env = c.createGain();
  const att = 0.001 + (s.fAttack / 100) * 1.5;
  const dec = 0.01 + (s.fDecay / 100) * 1.5;
  const sus = s.fSustain / 100;
  const rel = 0.01 + (s.fRelease / 100) * 2;
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(vel, when + att);
  env.gain.linearRampToValueAtTime(vel * sus, when + att + dec);
  const noteOff = when + Math.max(gate, att + dec + 0.05);
  env.gain.setTargetAtTime(0.0001, noteOff, rel * 0.4);
  env.connect(out);

  const oscs: OscillatorNode[] = [];
  for (let v = 0; v < voices; v++) {
    const pan = voices === 1 ? 0 : ((v / (voices - 1)) * 2 - 1) * spread;
    const panner = c.createStereoPanner(); panner.pan.value = pan;
    const detune = voices === 1 ? 0 : ((v / (voices - 1)) * 2 - 1) * detuneCents;

    const a = c.createOscillator(); a.type = typeA; a.frequency.value = root; a.detune.value = detune;
    const b = c.createOscillator(); b.type = typeB; b.frequency.value = root; b.detune.value = detune;
    const aG = c.createGain(); aG.gain.value = (1 - blendB) / voices;
    const bG = c.createGain(); bG.gain.value = blendB / voices;

    // FM modulator
    const mod = c.createOscillator(); mod.type = "sine"; mod.frequency.value = root * ratio;
    const modG = c.createGain(); modG.gain.value = (s.fmAmount / 100) * root * 4;
    mod.connect(modG); modG.connect(a.frequency); modG.connect(b.frequency);

    a.connect(aG).connect(panner);
    b.connect(bG).connect(panner);
    panner.connect(env);

    a.start(when); b.start(when); mod.start(when);
    const stopAt = noteOff + rel + 0.2;
    a.stop(stopAt); b.stop(stopAt); mod.stop(stopAt);
    oscs.push(a, b, mod);
  }
}