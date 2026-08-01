// VibeCore Sample Forge — Recorder Module.
//
// Live recording infrastructure using the Web Audio API's getUserMedia +
// MediaRecorder / ScriptProcessor / AudioWorklet. Recording runs on the
// control thread (capture) and does NOT touch the audio playback thread.
//
// All recording is non-blocking: the audio thread (engine.ts scheduler)
// continues to run while recording captures into a separate buffer.
//
// Reuses engine.ts for AudioContext access and decodeSampleFile for
// converting recorded blobs to AudioBuffers.

import { getCtx } from "@/lib/audio/engine";
import type { PCM } from "@/lib/audio/sampleForge";
import { bufferToPCM } from "@/lib/audio/sampleForge";
import { computePeak, computeDCOffset } from "./analysis";
import { normalizePCM, trimRegion } from "./editor";

export interface RecordingState {
  recording: boolean;
  startTime: number;
  elapsedMs: number;
  level: number;        // input monitor level 0..1
}

export interface RecordingResult {
  buffer: AudioBuffer;
  pcm: PCM;
  durationSec: number;
  peak: number;
  dcOffset: number;
}

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let analyser: AnalyserNode | null = null;
let monitorGain: GainNode | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let chunks: Blob[] = [];
let recordStartTime = 0;
let levelRAF: number | null = null;

const listeners = new Set<(state: RecordingState) => void>();

function notify(state: RecordingState): void {
  listeners.forEach((cb) => { try { cb(state); } catch { /* noop */ } });
}

/** Subscribe to recording state updates (for UI meters). */
export function subscribeRecordingState(cb: (state: RecordingState) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// ─── Microphone Access ────────────────────────────────────────────────────────

async function getMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia not available — recording requires HTTPS or localhost");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
}

// ─── Start / Stop Recording ───────────────────────────────────────────────────

/** Start recording from the microphone. Optionally enable input monitoring
 *  (playback the input through the output — careful with feedback!). */
export async function startRecording(opts?: {
  monitor?: boolean;
  monitorGain?: number;
}): Promise<void> {
  if (mediaRecorder) return; // already recording
  const ctx = getCtx();
  if (!ctx) throw new Error("AudioContext not initialised — call ensureAudio() first");

  mediaStream = await getMicrophoneStream();
  mediaStreamSource = ctx.createMediaStreamSource(mediaStream);

  // Analyser for level monitoring
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  mediaStreamSource.connect(analyser);

  // Optional input monitoring (DANGER: can cause feedback loops!)
  if (opts?.monitor) {
    monitorGain = ctx.createGain();
    monitorGain.gain.value = opts.monitorGain ?? 0;
    mediaStreamSource.connect(monitorGain).connect(ctx.destination);
  }

  // MediaRecorder for capture
  chunks = [];
  const mimeType = getSupportedMimeType();
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();
  recordStartTime = ctx.currentTime;

  // Level monitor loop
  const levelBuf = new Float32Array(analyser.fftSize);
  const updateLevel = () => {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(levelBuf);
    let peak = 0;
    for (let i = 0; i < levelBuf.length; i++) {
      const a = Math.abs(levelBuf[i]);
      if (a > peak) peak = a;
    }
    notify({
      recording: true,
      startTime: recordStartTime,
      elapsedMs: (ctx.currentTime - recordStartTime) * 1000,
      level: peak,
    });
    levelRAF = requestAnimationFrame(updateLevel);
  };
  updateLevel();

  notify({ recording: true, startTime: recordStartTime, elapsedMs: 0, level: 0 });
}

function getSupportedMimeType(): string | null {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/** Stop recording and return the captured audio as a PCM + AudioBuffer.
 *  Optionally auto-trim silence and auto-normalize. */
export async function stopRecording(opts?: {
  autoTrim?: boolean;
  autoTrimThresholdDb?: number;
  autoNormalize?: boolean;
}): Promise<RecordingResult> {
  if (!mediaRecorder || !mediaStream) throw new Error("Not recording");
  if (levelRAF) { cancelAnimationFrame(levelRAF); levelRAF = null; }

  const stopped = new Promise<Blob>((resolve) => {
    mediaRecorder!.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder!.mimeType || "audio/webm" });
      resolve(blob);
    };
    mediaRecorder!.stop();
  });
  const blob = await stopped;

  // Stop all tracks
  mediaStream.getTracks().forEach((t) => t.stop());
  mediaStream = null;
  mediaRecorder = null;
  analyser = null;
  if (mediaStreamSource) { try { mediaStreamSource.disconnect(); } catch { /* noop */ } mediaStreamSource = null; }
  if (monitorGain) { try { monitorGain.disconnect(); } catch { /* noop */ } monitorGain = null; }

  // Decode the recorded blob
  const ctx = getCtx();
  if (!ctx) throw new Error("AudioContext lost");
  const arr = await blob.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arr);
  let pcm = bufferToPCM(audioBuf);

  // Auto-trim: remove silence from start/end
  if (opts?.autoTrim) {
    pcm = autoTrimPCM(pcm, opts.autoTrimThresholdDb ?? -40);
  }
  // Auto-normalize: peak → 0.99
  if (opts?.autoNormalize) {
    pcm = normalizePCM(pcm, 0.99);
  }

  notify({ recording: false, startTime: 0, elapsedMs: 0, level: 0 });

  const resultBuf = ctx.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.sampleRate);
  for (let c = 0; c < pcm.channels.length; c++) resultBuf.getChannelData(c).set(pcm.channels[c]);

  return {
    buffer: resultBuf,
    pcm,
    durationSec: pcm.channels[0].length / pcm.sampleRate,
    peak: computePeak(pcm),
    dcOffset: computeDCOffset(pcm),
  };
}

/** Cancel recording without returning audio. */
export function cancelRecording(): void {
  if (levelRAF) { cancelAnimationFrame(levelRAF); levelRAF = null; }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try { mediaRecorder.stop(); } catch { /* noop */ }
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  mediaRecorder = null;
  analyser = null;
  if (mediaStreamSource) { try { mediaStreamSource.disconnect(); } catch { /* noop */ } mediaStreamSource = null; }
  if (monitorGain) { try { monitorGain.disconnect(); } catch { /* noop */ } monitorGain = null; }
  chunks = [];
  notify({ recording: false, startTime: 0, elapsedMs: 0, level: 0 });
}

// ─── Auto-Trim ────────────────────────────────────────────────────────────────

/** Trim silence from the start and end of a PCM. Silences = samples below
 *  the threshold (default -40 dB ≈ 0.01). */
export function autoTrimPCM(pcm: PCM, thresholdDb = -40): PCM {
  const threshold = Math.pow(10, thresholdDb / 20);
  const ch = pcm.channels[0];
  if (!ch || ch.length === 0) return pcm;
  // Find first sample above threshold
  let start = 0;
  for (let i = 0; i < ch.length; i++) {
    if (Math.abs(ch[i]) >= threshold) { start = i; break; }
  }
  // Find last sample above threshold
  let end = ch.length;
  for (let i = ch.length - 1; i >= 0; i--) {
    if (Math.abs(ch[i]) >= threshold) { end = i + 1; break; }
  }
  if (start >= end) return pcm;
  const startNorm = start / ch.length;
  const endNorm = end / ch.length;
  return trimRegion(pcm, startNorm, endNorm);
}