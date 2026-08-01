// VibeCore Adaptive Sync Engine
//
// Analyses an external audio signal (file, microphone, loopback / system
// audio via getDisplayMedia) to estimate tempo, detect beats and downbeats,
// and lock the phase of MasterClock to that signal.
//
// Design:
//   • Pure pull pipeline driven by an AnalyserNode + rAF (no setInterval in
//     the audio path; control-rate analysis is fine in rAF).
//   • Spectral-flux onset detector → adaptive threshold peak picking.
//   • Autocorrelation tempo estimator on inter-onset intervals (60–200 BPM).
//   • Simple PLL phase tracker re-anchors MasterClock on each confident beat.
//   • Confidence gate: clock only updates when the estimator agrees over
//     a sliding window.
//
// All times reported to MasterClock are AudioContext.currentTime — no
// setTimeout/setInterval in the timing path.

import { ensureAudio, getCtx } from "@/lib/audio/engine";
import { useGroove } from "@/lib/store";
import { masterClock } from "../clock/masterClock";

export type AdaptiveInputKind = "file" | "mic" | "loopback";

export interface AdaptiveStatus {
  running: boolean;
  inputKind: AdaptiveInputKind | null;
  bpm: number;
  confidence: number;     // 0..1
  beats: number;          // total beats detected
  lastBeatAt: number;     // audio time
  level: number;          // 0..1 peak level for UI meter
  error: string | null;
}

const status: AdaptiveStatus = {
  running: false, inputKind: null, bpm: 0, confidence: 0,
  beats: 0, lastBeatAt: 0, level: 0, error: null,
};

const listeners = new Set<(s: AdaptiveStatus) => void>();
export function subscribeAdaptive(cb: (s: AdaptiveStatus) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit() { listeners.forEach((l) => { try { l({ ...status }); } catch { /* ignore */ } }); }

// ─── Audio graph ───────────────────────────────────────────────────────────
let sourceNode: AudioNode | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let bufferSource: AudioBufferSourceNode | null = null;
let rafId: number | null = null;
let killSource: (() => void) | null = null;

// ─── Onset detection state ────────────────────────────────────────────────
const FFT_SIZE = 1024;
let lastSpectrum: Float32Array | null = null;
let fluxHist: number[] = [];          // recent flux for adaptive threshold
const FLUX_HIST_LEN = 43;             // ~1s at rAF
let lastOnsetTime = -Infinity;
const MIN_IOI = 60 / 200;             // 200 BPM = 0.3s
const MAX_IOI = 60 / 60;              // 60 BPM = 1.0s

// Inter-onset intervals (in seconds) for tempo estimation
const iois: number[] = [];
const IOI_WIN = 32;

// ─── Public control ──────────────────────────────────────────────────────
export function getAdaptiveStatus(): AdaptiveStatus { return { ...status }; }

export async function startAdaptiveFromMic(): Promise<void> {
  await stopAdaptive();
  try {
    const ctx = await ensureAudio();
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    stream = s;
    sourceNode = ctx.createMediaStreamSource(s);
    killSource = () => { s.getTracks().forEach((t) => t.stop()); };
    status.inputKind = "mic";
    finishStart();
  } catch (e) {
    status.error = (e as Error).message;
    emit();
    throw e;
  }
}

export async function startAdaptiveFromLoopback(): Promise<void> {
  await stopAdaptive();
  try {
    const ctx = await ensureAudio();
    // getDisplayMedia exposes system / tab audio when the user enables it.
    const gd = (navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
    }).getDisplayMedia;
    if (!gd) throw new Error("Loopback (getDisplayMedia) not supported");
    const s = await gd.call(navigator.mediaDevices, { audio: true, video: true });
    // Drop video tracks
    s.getVideoTracks().forEach((t) => t.stop());
    stream = s;
    sourceNode = ctx.createMediaStreamSource(s);
    killSource = () => { s.getTracks().forEach((t) => t.stop()); };
    status.inputKind = "loopback";
    finishStart();
  } catch (e) {
    status.error = (e as Error).message;
    emit();
    throw e;
  }
}

export async function startAdaptiveFromFile(file: File): Promise<void> {
  await stopAdaptive();
  try {
    const ctx = await ensureAudio();
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.loop = true;
    src.start();
    bufferSource = src;
    sourceNode = src;
    killSource = () => { try { src.stop(); } catch { /* ignore */ } };
    status.inputKind = "file";
    finishStart();
  } catch (e) {
    status.error = (e as Error).message;
    emit();
    throw e;
  }
}

function finishStart() {
  const ctx = getCtx();
  if (!ctx || !sourceNode) return;
  analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  sourceNode.connect(analyser);
  // Note: analyser is NOT connected to destination → no audio bleed.
  lastSpectrum = null;
  fluxHist = [];
  iois.length = 0;
  status.running = true;
  status.error = null;
  status.beats = 0;
  status.confidence = 0;
  emit();
  // Tell MasterClock to follow adaptive source
  masterClock.setSource("adaptive", ctx.currentTime);
  startLoop();
}

export async function stopAdaptive(): Promise<void> {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  if (analyser) { try { analyser.disconnect(); } catch { /* ignore */ } }
  if (bufferSource) { try { bufferSource.stop(); } catch { /* ignore */ } bufferSource = null; }
  if (killSource) { try { killSource(); } catch { /* ignore */ } killSource = null; }
  sourceNode = null;
  analyser = null;
  stream = null;
  status.running = false;
  status.inputKind = null;
  status.confidence = 0;
  emit();
  const c = getCtx();
  masterClock.setSource("internal", c?.currentTime ?? 0);
}

// ─── Analysis loop ────────────────────────────────────────────────────────
function startLoop() {
  const ctx = getCtx();
  if (!ctx || !analyser) return;
  const spec = new Float32Array(analyser.frequencyBinCount);
  const time = new Float32Array(analyser.fftSize);

  const tick = () => {
    if (!status.running || !analyser) return;
    analyser.getFloatFrequencyData(spec);
    analyser.getFloatTimeDomainData(time);

    // Level meter
    let peak = 0;
    for (let i = 0; i < time.length; i++) {
      const v = Math.abs(time[i]);
      if (v > peak) peak = v;
    }
    status.level = peak;

    // Spectral flux
    let flux = 0;
    if (lastSpectrum) {
      for (let i = 0; i < spec.length; i++) {
        const cur = isFinite(spec[i]) ? spec[i] : -100;
        const prev = isFinite(lastSpectrum[i]) ? lastSpectrum[i] : -100;
        const d = cur - prev;
        if (d > 0) flux += d;
      }
    }
    if (!lastSpectrum) lastSpectrum = new Float32Array(spec.length);
    lastSpectrum.set(spec);

    fluxHist.push(flux);
    if (fluxHist.length > FLUX_HIST_LEN) fluxHist.shift();

    // Adaptive threshold = mean + 1.6·stddev over window
    const mean = fluxHist.reduce((a, b) => a + b, 0) / fluxHist.length;
    const variance = fluxHist.reduce((a, b) => a + (b - mean) ** 2, 0) / fluxHist.length;
    const thr = mean + 1.6 * Math.sqrt(variance);

    const now = ctx.currentTime;
    if (flux > thr && now - lastOnsetTime > MIN_IOI && fluxHist.length >= 8) {
      if (lastOnsetTime > 0) {
        const ioi = now - lastOnsetTime;
        if (ioi >= MIN_IOI && ioi <= MAX_IOI) {
          iois.push(ioi);
          if (iois.length > IOI_WIN) iois.shift();
          updateTempo(now);
        }
      }
      lastOnsetTime = now;
      status.beats++;
      status.lastBeatAt = now;
    }

    emit();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/** Estimate tempo from recent IOIs via histogram of plausible BPM values. */
export function estimateBpmFromIois(intervals: number[]): { bpm: number; confidence: number } {
  if (intervals.length < 4) return { bpm: 0, confidence: 0 };
  // Fold each IOI into BPM, octave-correct into 80..160 range as primary.
  const bins = new Map<number, number>();
  for (const ioi of intervals) {
    let bpm = 60 / ioi;
    while (bpm < 80) bpm *= 2;
    while (bpm > 160) bpm /= 2;
    const key = Math.round(bpm);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let best = 0, bestCount = 0;
  for (const [k, v] of bins) {
    if (v > bestCount) { bestCount = v; best = k; }
  }
  const confidence = Math.min(1, bestCount / Math.max(4, intervals.length * 0.6));
  return { bpm: best, confidence };
}

function updateTempo(now: number) {
  const { bpm, confidence } = estimateBpmFromIois(iois);
  if (bpm <= 0) return;
  status.bpm = bpm;
  status.confidence = confidence;
  // Only push to MasterClock above a confidence floor — protects against
  // spurious onset patterns. PLL alignment uses every confident beat.
  if (confidence >= 0.5) {
    // Route external tempo through the store so the step scheduler (which
    // reads store.bpm) follows the detected tempo — single clock authority.
    useGroove.getState().setBpm(bpm);
    masterClock.alignDownbeat(now, masterClock.getStateAt(now).beat); // phase lock without resetting bar
    masterClock.setConfidence(confidence);
  }
}