// VibeCore DSP Core — Oscillator & Noise Factories.
//
// All oscillator and noise source creation goes through here. Web Audio's
// OscillatorNode covers the basic waveform types; the PeriodicWave API
// provides custom wavetable synthesis. Noise sources use pre-generated
// buffers (white, pink, brown) cached per sample-rate.
//
// Realtime-safe: factories run on the control thread. The noise buffer cache
// is module-scope but lazy-initialised once per sample rate — no per-trigger
// allocation after the first call. Buffers are Float32Array-backed.

import { clamp } from "./math";

// ── Basic oscillator ─────────────────────────────────────────────────────────

export type OscType = "sine" | "triangle" | "sawtooth" | "square";

/** Create an OscillatorNode with the given type and frequency. */
export function createOsc(
  ctx: BaseAudioContext, type: OscType, freq: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type as OscillatorType;
  osc.frequency.value = Math.max(0.1, freq);
  return osc;
}

// ── Wavetable (PeriodicWave) ─────────────────────────────────────────────────

/**
 * Create a PeriodicWave from an array of harmonic amplitudes.
 * @param harmonics  array of amplitudes (0..1), index 0 = fundamental
 * @param phases     optional phase offsets in radians (default: all 0)
 *
 * Example: [1, 0.5, 0.33, 0.25] → sawtooth-like rich spectrum.
 */
export function makeWavetable(
  ctx: BaseAudioContext, harmonics: number[], phases?: number[],
): PeriodicWave {
  const N = Math.max(1, harmonics.length);
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  // real[n] = cos(phase) * amp, imag[n] = sin(phase) * amp
  real[0] = 0;
  imag[0] = 0;
  for (let i = 0; i < N; i++) {
    const amp = clamp(harmonics[i], 0, 1);
    const ph = phases?.[i] ?? 0;
    real[i + 1] = amp * Math.cos(ph);
    imag[i + 1] = amp * Math.sin(ph);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/** Create an OscillatorNode driven by a custom wavetable. */
export function createWavetableOsc(
  ctx: BaseAudioContext, harmonics: number[], freq: number, phases?: number[],
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(makeWavetable(ctx, harmonics, phases));
  osc.frequency.value = Math.max(0.1, freq);
  return osc;
}

// ── Noise sources ────────────────────────────────────────────────────────────

export type NoiseType = "white" | "pink" | "brown";

// Module-scope noise buffer cache — keyed by `${type}:${sampleRate}`.
// Lazy-initialised once; subsequent calls return the cached buffer.
// This replaces the per-voice getNoiseBuf() in synthVoice.ts.
const _noiseCache = new Map<string, AudioBuffer>();

function generateNoise(type: NoiseType, sr: number): Float32Array {
  const len = sr * 2; // 2 seconds — enough for any percussive tail
  const out = new Float32Array(len);

  if (type === "white") {
    for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
    return out;
  }

  // Pink noise: Paul Kellet's filter (ref: "0.99765 × f + white × 0.02")
  if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.02;
      b1 = 0.98585 * b1 + w * 0.06;
      b2 = 0.97685 * b2 + w * 0.13;
      b3 = 0.95725 * b3 + w * 0.22;
      b4 = 0.93255 * b4 + w * 0.28;
      b5 = 0.87255 * b5 + w * 0.35;
      b6 = 0.69855 * b6 + w * 0.45;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6) * 0.12;
    }
    return out;
  }

  // Brown noise: leaky integrator of white noise
  if (type === "brown") {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      out[i] = last * 3.5;
    }
    return out;
  }

  return out;
}

/**
 * Get a cached noise AudioBuffer for the given type and sample rate.
 * The buffer is 2 seconds long, mono. Subsequent calls with the same
 * (type, sampleRate) return the cached buffer — no allocation.
 */
export function getNoiseBuffer(ctx: BaseAudioContext, type: NoiseType = "white"): AudioBuffer {
  const key = `${type}:${ctx.sampleRate}`;
  const cached = _noiseCache.get(key);
  if (cached) return cached;

  const data = generateNoise(type, ctx.sampleRate);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  _noiseCache.set(key, buf);
  return buf;
}

/** Create a BufferSourceNode playing the cached noise buffer (looped). */
export function createNoiseSource(
  ctx: BaseAudioContext, type: NoiseType = "white",
): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, type);
  src.loop = true;
  return src;
}