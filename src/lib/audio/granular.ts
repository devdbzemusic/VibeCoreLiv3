// Granular runtime — continuously schedules grains for any part whose
// wave.granEnabled or wave.granFreeze flag is on.
//
// Hot path: grains are mixed inside the 'vibe-granular' AudioWorklet
// (see src/workers/granular-processor.worklet.ts). The main thread only
// allocates Float32Array slices and posts them — no per-grain
// AudioBufferSourceNode / GainNode / StereoPannerNode creation.
// Freeze voices keep using a single looping BufferSource per part (low cost).

import { useGroove } from "@/lib/store";
import { getBuffer, getCtx, getPartChain, getGranularNode, grainModOffsets, partLastVelocity, onGrainsEnded } from "./engine";

import { getQuality } from "./quality";
import { getPsychoPreset, psychoacousticGrainScale } from "./psychoPresets";
import { recordActiveGrains, recordGrainSpawned } from "./audioPerf";
import type { Part } from "@/lib/model";
import { dbToLin } from "@/lib/dsp";

let started = false;
const nextScheduleAt = new Map<number, number>();
const revBufferCache = new WeakMap<AudioBuffer, AudioBuffer>();
/** Live count of grains the main thread *believes* are alive in the worklet.
 *  Incremented on every successful add-message, decremented when worklet
 *  reports them ended (or full-pool drop). Used to enforce per-profile caps
 *  BEFORE postMessage so we don't spam the message port under overload. */
let liveGrainCount = 0;
/**
 * Freeze voice.
 *  - HIGH/MEDIUM quality: src → xfade (seam-dip) → outGain → dest.
 *    `xfade` performs a 3 ms cosine dip exactly at every native-loop seam
 *    (precomputed from start time + loopLen). This masks the click that
 *    `AudioBufferSourceNode.loop=true` produces at the wrap point.
 *  - LOW quality (low-cost mode): src → outGain → dest. No seam dips, no
 *    extra GainNode, no scheduler work — just a native loop. Saves an
 *    AudioParam-curve scheduling call per loop period (≈ 1-5 Hz) which
 *    matters on weak mobile devices, and trades one click per loop for
 *    measurably lower CPU.
 */
interface FreezeVoice {
  src: AudioBufferSourceNode;
  xfade: GainNode | null;     // seam-dip gain (null in low-cost mode)
  outGain: GainNode;          // mix-level gain
  buffer: AudioBuffer;
  loopStart: number;
  loopEnd: number;
  startTime: number;          // ctx time when src was started, at loopStart
  nextSeamTime: number;       // next loop-wrap ctx time to schedule a dip for
  scheduledUntil: number;     // horizon up to which seam dips are scheduled
  lowCost: boolean;
}

const freezeVoices = new Map<number, FreezeVoice>();
const MIN_GRAIN_MS = 40;
const MAX_GRAIN_MS = 500;
const MAX_SPRAY = 0.5;
const MAX_RANDOM = 0.25;
// Half-width of the seam dip in seconds. 3 ms keeps the perceptual loss
// below ~1 dB while completely hiding the wrap-point click.
const SEAM_DIP_SEC = 0.003;
const SEAM_DIP_TC = 0.0015; // setTargetAtTime time-constant: ~63% in 1.5ms
// Reference pitch for psychoacoustic frequency mapping. C4 (≈261.6 Hz) is the
// neutral anchor: rate=1 → ~261.6 Hz fundamental. Used to derive the perceived
// frequency band when scaling grain length.
const PITCH_REF_HZ = 261.6256;

function getReversedBuffer(c: AudioContext, buf: AudioBuffer): AudioBuffer {
  const cached = revBufferCache.get(buf);
  if (cached) return cached;
  const out = c.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const s = buf.getChannelData(ch);
    const d = out.getChannelData(ch);
    for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
  }
  revBufferCache.set(buf, out);
  return out;
}

function stopFreezeVoice(id: number, when?: number) {
  const v = freezeVoices.get(id);
  if (!v) return;
  const c = getCtx();
  const t = when ?? c?.currentTime ?? 0;
  try {
    v.outGain.gain.cancelScheduledValues(t);
    v.outGain.gain.setValueAtTime(v.outGain.gain.value, t);
    v.outGain.gain.linearRampToValueAtTime(0, t + 0.005);
    v.src.stop(t + 0.012);
  } catch { /* already stopped */ }
  freezeVoices.delete(id);
}

/** Schedule cosine-style seam dips up to ~1 s ahead so that
 *  the audio thread always has the next few loop wraps prepared. */
function scheduleFreezeSeams(c: AudioContext, v: FreezeVoice) {
  if (!v.xfade) return;
  const loopLen = v.loopEnd - v.loopStart;
  if (loopLen <= 0.01) return;
  const horizon = c.currentTime + 1.0;
  while (v.nextSeamTime < horizon) {
    const t = v.nextSeamTime;
    if (t > c.currentTime + 0.01) {
      v.xfade.gain.setTargetAtTime(0, Math.max(c.currentTime, t - SEAM_DIP_SEC), SEAM_DIP_TC);
      v.xfade.gain.setTargetAtTime(1, t + SEAM_DIP_SEC, SEAM_DIP_TC);
    }
    v.nextSeamTime += loopLen;
  }
  v.scheduledUntil = horizon;
}

function ensureFreezeVoice(c: AudioContext, buf: AudioBuffer, dest: AudioNode, part: Part) {
  const w = part.wave;
  const id = part.id;
  const posNorm = Math.max(0, Math.min(0.999, (w.freezePos / 100) + (grainModOffsets.freezePos.get(id) ?? 0)));
  // freezeFb (0..100) acts as a psycho-acoustic "blur": stretches the freeze
  // loop window so the frozen texture smears across more material → natural,
  // less "stuttery" freeze. Coherence is *sample-rate dependent* — at lower
  // SR we lengthen slightly more so the same number of cycles fits the loop
  // window, preserving analog warmth instead of "digital edge".
  const fb = Math.max(0, Math.min(1, (w.freezeFb || 0) / 100));
  const srExp = getPsychoPreset().srCoherenceExp;
  const srCoherence = Math.pow(48000 / Math.max(8000, c.sampleRate), srExp);
  const baseSizeMs = (w.freezeSize || MIN_GRAIN_MS) * (1 + fb * 2) * srCoherence;
  const sizeSec = Math.max(0.04, Math.min(8, baseSizeMs / 1000));
  const center = posNorm * buf.duration;
  const loopStart = Math.max(0, center - sizeSec * 0.5);
  const loopEnd = Math.min(buf.duration, Math.max(loopStart + 0.04, center + sizeSec * 0.5));
  const mix = Math.max(0, Math.min(1, (w.freezeMix / 100) + (grainModOffsets.freezeMix.get(id) ?? 0)));
  const target = dbToLin(w.granGain || 0) * Math.max(0.0001, mix || 1);
  const lowCost = getQuality().level === "LOW";

  let voice = freezeVoices.get(id);

  // Recreate when buffer, quality mode, or loop window changes substantially.
  const windowChangedTooMuch = voice && (
    Math.abs(voice.loopStart - loopStart) > 0.02 ||
    Math.abs((voice.loopEnd - voice.loopStart) - (loopEnd - loopStart)) > 0.02
  );
  const modeChanged = voice && voice.lowCost !== lowCost;
  const bufChanged = voice && voice.buffer !== buf;

  if (!voice || bufChanged || modeChanged || windowChangedTooMuch) {
    stopFreezeVoice(id, c.currentTime);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;

    const outGain = c.createGain();
    outGain.gain.setValueAtTime(0, c.currentTime);
    outGain.gain.linearRampToValueAtTime(target, c.currentTime + 0.005);

    let xfade: GainNode | null = null;
    if (!lowCost) {
      xfade = c.createGain();
      xfade.gain.setValueAtTime(1, c.currentTime);
      src.connect(xfade).connect(outGain).connect(dest);
    } else {
      src.connect(outGain).connect(dest);
    }

    const startTime = c.currentTime + 0.005;
    src.start(startTime, loopStart);
    voice = {
      src, xfade, outGain,
      buffer: buf,
      loopStart, loopEnd,
      startTime,
      nextSeamTime: startTime + (loopEnd - loopStart),
      scheduledUntil: 0,
      lowCost,
    };
    freezeVoices.set(id, voice);
  }

  // Smooth live updates (loop bounds & stretch only — large window jumps
  // already recreated the voice above).
  voice.src.loopStart = loopStart;
  voice.src.loopEnd = loopEnd;
  voice.loopStart = loopStart;
  voice.loopEnd = loopEnd;
  voice.src.playbackRate.setTargetAtTime(
    Math.max(0.25, Math.min(1, 100 / Math.max(100, w.timeStretch || 100))),
    c.currentTime, 0.03,
  );
  voice.outGain.gain.setTargetAtTime(target, c.currentTime, 0.01);

  if (!voice.lowCost) scheduleFreezeSeams(c, voice);
}

function spawnGrain(
  c: AudioContext,
  buf: AudioBuffer,
  dest: AudioNode,
  part: Part,
  sizeSec: number,
  whenSec: number,
) {
  const w = part.wave;
  const id = part.id;
  const isFreeze = w.granFreeze || w.freeze;

  // Position (0..1)
  const baseRaw = isFreeze
    ? (w.freezePos / 100) + (grainModOffsets.freezePos.get(id) ?? 0)
    : (w.grainPos / 100) + (grainModOffsets.pos.get(id) ?? 0);
  const sprayBase = Math.min(MAX_SPRAY, w.grainSpray / 100) + (grainModOffsets.spray.get(id) ?? 0);
  const spray = Math.max(0, Math.min(MAX_SPRAY, sprayBase));
  const sprayOff = (Math.random() * 2 - 1) * spray * 0.5;
  let posNorm = Math.max(0, Math.min(0.999, baseRaw + sprayOff));

  // Direction (per-grain choice for "rnd")
  let useBuf = buf;
  let reverse = false;
  if (w.granDir === "rev") reverse = true;
  else if (w.granDir === "rnd") reverse = Math.random() < 0.5;
  if (reverse) {
    useBuf = getReversedBuffer(c, buf);
    posNorm = 1 - posNorm;
  }

  // Pitch
  const rp = Math.min(MAX_RANDOM, w.granRandPitch / 100) * (Math.random() * 2 - 1) * 12;
  const semis = (w.granPitch || 0) + (w.pitchShift || 0) + rp;
  const rate = Math.max(0.05, Math.min(8, Math.pow(2, semis / 12)));

  // ── Psychoacoustic + velocity grain-size shaping ──────────────────────────
  // Estimate perceived fundamental: rate=1 anchors at C4. This is an approx —
  // sample content may be arbitrary, but rate is the dominant pitch indicator.
  const perceivedHz = PITCH_REF_HZ * rate;
  const preset = getPsychoPreset();
  const psyScale = psychoacousticGrainScale(perceivedHz);
  // Velocity 0..127 → 0..1. Hard hit shortens grain; soft hit lengthens it.
  const vel01 = Math.max(0, Math.min(1, (partLastVelocity.get(id) ?? 100) / 127));
  const velScale = 1 + (0.5 - vel01) * preset.velLenCoupling;
  const minSize = Math.max(preset.minGrainMs, MIN_GRAIN_MS) / 1000;
  const shapedSize = Math.max(minSize, Math.min(MAX_GRAIN_MS / 1000 * 1.8, sizeSec * psyScale * velScale));

  const startSec = posNorm * buf.duration;
  const playLen = shapedSize / rate;
  if (startSec + playLen >= buf.duration - 0.001) {
    // wrap → just clamp
  }

  // Pan + width
  const widthMod = grainModOffsets.width.get(id) ?? 0;
  const widthPct = Math.max(0, Math.min(2, (w.granWidth / 100) + widthMod));
  const randPan = Math.min(MAX_RANDOM, w.granRandPan / 100) * (Math.random() * 2 - 1);
  const panNorm = Math.max(-1, Math.min(1, randPan * widthPct));

  // Velocity-coupled gain: hard hits get a small +dB lift to mimic the
  // increased harmonic energy of a strong attack on real instruments.
  const velGainLift = 1 + (vel01 - 0.5) * preset.velGainCoupling;
  const gainLin = dbToLin(w.granGain || 0)
    * velGainLift
    * (isFreeze ? Math.max(0.0001, (w.freezeMix / 100) + (grainModOffsets.freezeMix.get(id) ?? 0)) : 1);

  // Equal-power pan curve, baked into per-channel gains for the worklet.
  const panAng = (panNorm + 1) * 0.25 * Math.PI; // -1..1 → 0..π/2
  const panL = Math.cos(panAng) * gainLin;
  const panR = Math.sin(panAng) * gainLin;

  // ─── Worklet path (off-main-thread mixing) ───────────────────────────────
  const node = getGranularNode();
  if (node) {
    // Per-profile hard cap — drop spawns under overload BEFORE postMessage.
    if (liveGrainCount >= getQuality().maxGrains) return;
    const sr = c.sampleRate;
    const startSample = posNorm * buf.duration * sr;
    const lengthSamples = Math.max(8, Math.floor(shapedSize * sr));
    const fadeInEnd = Math.max(1, Math.floor(lengthSamples * 0.05));
    const fadeOutStart = Math.max(fadeInEnd + 1, Math.floor(lengthSamples * 0.75));

    const startIdx = Math.max(0, Math.floor(startSample));
    const span = Math.min(useBuf.length - startIdx, Math.ceil(lengthSamples * rate) + 4);
    if (span <= 4) return;
    const src0 = useBuf.getChannelData(0);
    const slice = new Float32Array(span);
    slice.set(src0.subarray(startIdx, startIdx + span));

    nextGrainId = (nextGrainId + 1) | 0;
    try {
      node.port.postMessage({
        type: "add",
        id: nextGrainId,
        buffer: slice,
        startSample: startSample - startIdx,
        length: lengthSamples,
        pitchRatio: rate,
        panL, panR,
        fadeInEnd,
        fadeOutStart,
      }, [slice.buffer]);
      liveGrainCount++;
      recordGrainSpawned();
      recordActiveGrains(liveGrainCount);
    } catch { /* full pool — drop grain */ }
    return;
  }

  // ─── Fallback path (no worklet support) ──────────────────────────────────
  const env = c.createGain();
  env.gain.setValueAtTime(0, whenSec);
  env.gain.linearRampToValueAtTime(1, whenSec + 0.001);
  env.gain.setValueAtTime(1, whenSec + shapedSize - 0.001);
  env.gain.linearRampToValueAtTime(0, whenSec + shapedSize);
  const pan = c.createStereoPanner();
  pan.pan.value = panNorm;
  const post = c.createGain();
  post.gain.value = gainLin;
  const src = c.createBufferSource();
  src.buffer = useBuf;
  src.playbackRate.value = rate;
  src.connect(env).connect(pan).connect(post).connect(dest);
  try { src.start(whenSec, startSec); } catch { return; }
  src.stop(whenSec + shapedSize + 0.05);
}

let nextGrainId = 0;

export function startGranularLoop() {
  if (started) return;
  started = true;
  // Subscribe to worklet "ended" batches so liveGrainCount stays honest.
  onGrainsEnded((ids) => {
    liveGrainCount = Math.max(0, liveGrainCount - ids.length);
    recordActiveGrains(liveGrainCount);
  });


  const tick = () => {
    const c = getCtx();
    if (!c) { setTimeout(tick, 60); return; }
    const state = useGroove.getState();
    const horizon = c.currentTime + 0.12;

    state.parts.forEach((p) => {
      const w = p.wave;
      const active = w.granEnabled || w.granFreeze || (w.freeze && (w.freezeMix > 0 || w.freezeSize > 0));
      if (!active) { nextScheduleAt.delete(p.id); stopFreezeVoice(p.id, c.currentTime); return; }
      const buf = getBuffer(p.id);
      const chain = getPartChain(p.id);
      if (!buf || buf.length <= 0 || buf.duration <= 0 || !chain) return;

      const isFreeze = w.granFreeze || w.freeze;
      if (isFreeze) {
        nextScheduleAt.delete(p.id);
        ensureFreezeVoice(c, buf, chain.input, p);
        return;
      }
      stopFreezeVoice(p.id, c.currentTime);

      // Grain size 40..500 ms (mod ±200ms), Android-safe minimum.
      const sizeMs =
        MIN_GRAIN_MS +
        (w.grainSize / 100) * (MAX_GRAIN_MS - MIN_GRAIN_MS) +
        (grainModOffsets.size.get(p.id) ?? 0) * 200;
      const size = Math.max(MIN_GRAIN_MS / 1000, Math.min(MAX_GRAIN_MS / 1000, sizeMs / 1000));

      // Density 1..16, capped solely by the current quality profile.
      const q = getQuality();
      const dens = Math.max(
        1,
        Math.min(
          q.densityCap,
          1 + (w.grainDensity / 100) * 15 + (grainModOffsets.density.get(p.id) ?? 0) * 8,
        ),
      );
      const interval = 1 / dens;

      let next = nextScheduleAt.get(p.id) ?? c.currentTime + 0.01;
      // catch up if we fell behind
      if (next < c.currentTime - 0.5) next = c.currentTime + 0.01;
      while (next < horizon) {
        spawnGrain(c, buf, chain.input, p, size, next);
        next += interval;
      }
      nextScheduleAt.set(p.id, next);
    });
    setTimeout(tick, getQuality().grainTickMs);
  };
  tick();
}

// Offline resample: render a granular pass of `seconds` using current part wave settings.
export async function renderGranularToBuffer(partId: number, seconds = 4): Promise<AudioBuffer | null> {
  const c = getCtx();
  if (!c) return null;
  const part = useGroove.getState().parts[partId];
  const buf = getBuffer(partId);
  if (!part || !buf) return null;

  const sr = c.sampleRate;
  const Off = window.OfflineAudioContext as typeof OfflineAudioContext;
  const off = new Off(2, Math.max(1, Math.floor(seconds * sr)), sr);

  const w = part.wave;
  // Mirror live path — apply current modulation offsets so offline render
  // matches what the user hears live (consistent Live/Offline pipeline).
  const sizeMod = (grainModOffsets.size.get(partId) ?? 0) * 200;
  const sizeMs = MIN_GRAIN_MS + (w.grainSize / 100) * (MAX_GRAIN_MS - MIN_GRAIN_MS) + sizeMod;
  const size = Math.max(MIN_GRAIN_MS / 1000, Math.min(MAX_GRAIN_MS / 1000, sizeMs / 1000));
  const q = getQuality();
  const densBase = 1 + (w.grainDensity / 100) * 15 + (grainModOffsets.density.get(partId) ?? 0) * 8;
  const dens = Math.max(1, Math.min(q.densityCap, densBase));
  const interval = 1 / dens;
  const posMod = grainModOffsets.pos.get(partId) ?? 0;
  const sprayMod = grainModOffsets.spray.get(partId) ?? 0;
  const widthMod = grainModOffsets.width.get(partId) ?? 0;
  const freezePosMod = grainModOffsets.freezePos.get(partId) ?? 0;
  const fb = Math.max(0, Math.min(1, (w.freezeFb || 0) / 100));

  // tiny clone of spawnGrain that targets `off.destination`
  const reversedCache = new Map<AudioBuffer, AudioBuffer>();
  const reversed = (b: AudioBuffer) => {
    const hit = reversedCache.get(b);
    if (hit) return hit;
    const out = off.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const s = b.getChannelData(ch);
      const d = out.getChannelData(ch);
      for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
    }
    reversedCache.set(b, out);
    return out;
  };

  for (let t = 0; t < seconds; t += interval) {
    const isFreeze = w.granFreeze || w.freeze;
    const grainSize = isFreeze ? size * (1 + fb * 2) : size;
    const base = isFreeze
      ? (w.freezePos / 100) + freezePosMod
      : (w.grainPos / 100) + posMod + (t / seconds) * (w.granEnabled ? 0 : 0);
    const spray = Math.max(0, Math.min(MAX_SPRAY, (w.grainSpray / 100) + sprayMod)) * (Math.random() - 0.5);
    let pos = Math.max(0, Math.min(0.999, base + spray));
    let useBuf = buf;
    if (w.granDir === "rev" || (w.granDir === "rnd" && Math.random() < 0.5)) {
      useBuf = reversed(buf); pos = 1 - pos;
    }
    const rp = Math.min(MAX_RANDOM, w.granRandPitch / 100) * (Math.random() * 2 - 1) * 12;
    const rate = Math.max(0.05, Math.min(8, Math.pow(2, ((w.granPitch || 0) + (w.pitchShift || 0) + rp) / 12)));

    const env = off.createGain(); env.gain.value = 0;
    const curve = new Float32Array(24);
    for (let i = 0; i < 24; i++) curve[i] = Math.sin((i / 23) * Math.PI);
    env.gain.setValueCurveAtTime(curve, t, grainSize);
    const pan = off.createStereoPanner();
    const widthPct = Math.max(0, Math.min(2, (w.granWidth / 100) + widthMod));
    pan.pan.value = Math.min(MAX_RANDOM, w.granRandPan / 100) * (Math.random() * 2 - 1) * widthPct;
    const post = off.createGain(); post.gain.value = dbToLin(w.granGain || 0);


    const src = off.createBufferSource();
    src.buffer = useBuf;
    src.playbackRate.value = rate;
    src.connect(env).connect(pan).connect(post).connect(off.destination);
    try { src.start(t, pos * buf.duration); } catch { /* skip */ }
    src.stop(t + grainSize + 0.05);
  }
  const rendered = await off.startRendering();
  return rendered;
}