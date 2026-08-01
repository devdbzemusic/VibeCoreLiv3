// VibeCoreLiv3 — Web Audio engine v1.2
// Full per-part channel strip + 6 FX buses + master bus.
//
// Per-part signal path:
//   voice → HP → LP → Drive (waveshaper) → EQ(low/mid/high) → outGain → volume → pan
//        ├─ dry → masterIn
//        └─ sendsA..F → fxBusIn[i]
//
// FX bus path: fxBusIn[i] → fxNode[i] → wetGain[i] → masterIn
//
// Master bus: masterIn → mEqLow → mEqMid → mEqHigh → widthIn (M/S) → softClip → masterGain → limiter → destination

import { useGroove, setTransientState } from "@/lib/store";
import type { Channel, DriveType, FxType, MasterChannel, Part } from "@/lib/model";
import { getQuality } from "./quality";
import { requestVoice, partVoiceClass, setVoiceCap } from "./voiceAllocator";
import { recordActiveVoices, recordDroppedVoice, recordVoiceCreated, recordVoiceDestroyed } from "./audioPerf";
import { publishMeter, isPartVisible, isPartActive, markPartActive, getMeterSnapshot } from "./meterBus";

let ctx: AudioContext | null = null;
type SampleId = number | string;

// Master chain
let masterIn: GainNode | null = null;
let mEqLow: BiquadFilterNode | null = null;
let mEqMid: BiquadFilterNode | null = null;
let mEqHigh: BiquadFilterNode | null = null;
let widthMid: GainNode | null = null;
let widthSide: GainNode | null = null;
let softClip: WaveShaperNode | null = null;
let masterGain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let analyserL: AnalyserNode | null = null;
let analyserR: AnalyserNode | null = null;
let meterBufL: Float32Array<ArrayBuffer> | null = null;
let meterBufR: Float32Array<ArrayBuffer> | null = null;

interface PartChain {
  input: GainNode;       // voices connect here
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  drive: WaveShaperNode;
  driveDry: GainNode;    // bypass node when drive=0
  driveWet: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  outGain: GainNode;
  volume: GainNode;
  pan: StereoPannerNode;
  postSplit: GainNode;   // tap point for sends + dry
  dry: GainNode;         // to master
  sends: GainNode[];     // 6 send gains
  analyser: AnalyserNode;
  meterBuf: Float32Array<ArrayBuffer>;
}

interface FxBus {
  input: GainNode;       // dry-in from part sends
  output: GainNode;      // wet signal tap (post-FX, pre boost/wet)
  boost: GainNode;       // perceptual boost (0..+12 dB), feeds wet
  wet: GainNode;         // wet level → busLevel
  /** Dedicated channel-level node (store volume + mute).
   *  Sits between wet and masterIn and is NEVER written by applyAllParams()
   *  or FX-param updates (those go to `boost` only). This guarantees that
   *  setBusChannelLevel() values survive any subsequent applyAllParams() call. */
  busLevel: GainNode;    // busLevel → masterIn
  analyser: AnalyserNode;
  meterBuf: Float32Array<ArrayBuffer>;
  nodes: AudioNode[];
  oscillators: OscillatorNode[];
  type: FxType | null;
  update: ((params: Record<string, number>, bpm: number) => void) | null;
}

const parts: Map<number, PartChain> = new Map();
const fxBuses: FxBus[] = [];
const buffers = new Map<number, AudioBuffer>();
const sampleBufferCache = new Map<SampleId, AudioBuffer>();
const activeVoices = new Set<AudioBufferSourceNode>();
/** Per-part registry of per-voice gain envelopes. Used by `assignBufferToPart`
 *  to crossfade currently-sounding voices to silence before a hot sample swap,
 *  so the user doesn't hear a DC step or buffer truncation click. */
const voiceGainsByPart: Map<number, Set<GainNode>> = new Map();
const reversedBufCache = new WeakMap<AudioBuffer, AudioBuffer>();

function registerVoiceGain(partId: number, g: GainNode): void {
  let set = voiceGainsByPart.get(partId);
  if (!set) { set = new Set(); voiceGainsByPart.set(partId, set); }
  set.add(g);
  // Tell the meter loop this part is producing sound; meters will read
  // its analyser for ACTIVE_HOLD_SEC even if it's off-screen.
  if (ctx) markPartActive(partId, ctx.currentTime);
}
function unregisterVoiceGain(partId: number, g: GainNode): void {
  voiceGainsByPart.get(partId)?.delete(g);
}

// ─── public ─────────────────────────────────────────────────────────────────

export function getCtx(): AudioContext | null { return ctx; }
export function masterInput(): AudioNode | null { return masterIn; }
export function getPartChain(id: number) { return parts.get(id); }

// ─── Granular AudioWorklet (sprint: off-main-thread grains) ─────────────────
// One AudioWorkletNode handles ALL grains across all parts. Connected directly
// to masterIn so the audio thread never has to allocate per-grain nodes.
let granularNode: AudioWorkletNode | null = null;
const grainEndedListeners = new Set<(ids: number[]) => void>();
export function getGranularNode(): AudioWorkletNode | null { return granularNode; }
export function onGrainsEnded(cb: (ids: number[]) => void): () => void {
  grainEndedListeners.add(cb);
  return () => grainEndedListeners.delete(cb);
}
async function initGranularWorklet(c: AudioContext) {
  try {
    await c.audioWorklet.addModule(
      new URL("../../workers/granular-processor.worklet.ts", import.meta.url)
    );
    granularNode = new AudioWorkletNode(c, "vibe-granular", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    // Precomputed Hann window (1024 entries) — fades happen in worklet without trig calls.
    const WIN = 1024;
    const win = new Float32Array(WIN);
    for (let i = 0; i < WIN; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1));
    granularNode.port.postMessage({ type: "init", window: win });
    granularNode.port.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (m && m.type === "ended" && Array.isArray(m.ids)) {
        grainEndedListeners.forEach((cb) => { try { cb(m.ids); } catch { /* noop */ } });
      }
    };
    if (masterIn) granularNode.connect(masterIn);
  } catch (err) {
    console.warn("[granular] AudioWorklet init failed, falling back to node-per-grain", err);
    granularNode = null;
  }
}
export function getFxBuses() { return fxBuses; }
export function isValidAudioBuffer(buf?: AudioBuffer | null): buf is AudioBuffer {
  return !!buf && buf.length > 0 && buf.duration > 0 && buf.numberOfChannels > 0;
}
export function getAudioDebugStats() {
  const state = useGroove.getState();
  const granularActive = state.parts.some((p) => p.wave.granEnabled);
  const freezeActive = state.parts.some((p) => p.wave.granFreeze || p.wave.freeze);
  const fxNodeCount = fxBuses.reduce((sum, bus) => sum + bus.nodes.length + bus.oscillators.length + 4, 0);
  return {
    sampleLoaded: state.parts.some((p) => !!p.sampleName || buffers.has(p.id)),
    bufferValid: state.parts.some((p) => isValidAudioBuffer(buffers.get(p.id))),
    playbackActive: activeVoices.size > 0,
    granularActive,
    freezeActive,
    audioNodes: parts.size * 17 + fxNodeCount + activeVoices.size,
    bufferCache: sampleBufferCache.size,
  };
}

// Live modulation offsets (applied by modulation runtime, consumed by triggerPart/granular)
export const modOffsets = {
  pitch: new Map<number, number>(),       // semitones
  sampleStart: new Map<number, number>(), // 0..1 of buffer
  sampleEnd: new Map<number, number>(),   // 0..1 of buffer
};

// Continuous grain/freeze/stretch modulation offsets (-1..1, summed across routes)
export const grainModOffsets = {
  size: new Map<number, number>(),
  density: new Map<number, number>(),
  pos: new Map<number, number>(),
  spray: new Map<number, number>(),
  width: new Map<number, number>(),
  freezePos: new Map<number, number>(),
  freezeMix: new Map<number, number>(),
  stretch: new Map<number, number>(),
};

// Per-part last trigger velocity (0..127). Granular runtime reads this to
// apply velocity-dependent grain length & timbre shaping
// (soft hit → longer attack/more fundamentals, hard hit → shorter/more harmonics).
export const partLastVelocity = new Map<number, number>();

export async function ensureAudio(): Promise<AudioContext> {
  if (!ctx) {
    const { getInitialLatencyHint } = await import("./quality");
    const profile = useGroove.getState().qualityProfile;
    const latencyHint = getInitialLatencyHint(profile);
    // Read user-configured sample rate from Setup Center (Sprint 6A).
    let preferredSr = 48000;
    try {
      const { useSetup } = await import("@/lib/setup/setupStore");
      preferredSr = useSetup.getState().sampleRate;
    } catch { /* setup store unavailable — fall back */ }
    const Ctx = (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    try {
      ctx = new Ctx({ latencyHint, sampleRate: preferredSr });
    } catch {
      ctx = new Ctx({ latencyHint });
    }
    // Install graph-debug instrumentation BEFORE building any nodes, so every
    // node we create is counted from the very first allocation.
    const { installAudioGraphDebug, exposeAudioGraphGlobals } = await import("./audioGraphDebug");
    installAudioGraphDebug(ctx);
    exposeAudioGraphGlobals();
    // Apply persisted psychoacoustic preset + auto-calibrate to actual SR.
    const psycho = await import("./psychoPresets");
    psycho.setPsychoPreset(useGroove.getState().psychoPreset);
    psycho.calibrateForSampleRate(ctx.sampleRate);
    buildMaster();
    buildFxBuses();
    buildAllPartChains();
    applyAllParams();
    // Restore persisted bus routing immediately after graph construction.
    // bindParamUpdates() subscriptions only fire on *future* store mutations;
    // they will not re-apply routing that was already saved in the store when
    // this AudioContext was created (e.g. after a page reload or AudioContext
    // recreation).  Call explicitly here so saved assignments and bus levels
    // are always reflected from the very first audio frame.
    {
      const initS = useGroove.getState();
      const assignments = initS.partBusAssignments as Record<string, number | null>;
      Object.entries(assignments).forEach(([pidStr, busIdx]) => {
        routePartMainToBus(Number(pidStr), busIdx);
      });
      (initS.busLevels as { volume: number; mute: boolean }[]).forEach((b, i) => {
        setBusChannelLevel(i, b.volume / 100, b.mute);
      });
    }
    startMeterLoop();
    await initGranularWorklet(ctx);
    const { startModulationLoop } = await import("./modulation");
    startModulationLoop();
    const { startGranularLoop } = await import("./granular");
    startGranularLoop();
    const { startQualityManager } = await import("./quality");
    startQualityManager();
    // Mobile browsers suspend the AudioContext when the tab/app goes to
    // background. Auto-resume on return so playback continues without
    // requiring another tap.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => { /* ignore */ });
        }
      });
    }
  }
  if (ctx.state === "suspended") await ctx.resume();
  useGroove.setState({ audioReady: ctx.state === "running" });
  return ctx;
}

/**
 * Tear down the AudioContext and rebuild it. Required to apply hardware
 * settings (sample rate, output device) that can only be set at context
 * construction time. Stops transport, flushes voices, releases buffers,
 * then re-runs `ensureAudio()`.
 */
export async function restartAudio(): Promise<AudioContext> {
  const wasPlaying = useGroove.getState().transport.playing;
  if (wasPlaying) useGroove.getState().resetTransport();
  try { await softStop(true); } catch { /* ignore */ }
  if (ctx) {
    try { await ctx.close(); } catch { /* ignore */ }
  }
  // Reset module-scope graph state — nodes belong to the closed ctx.
  ctx = null;
  masterIn = null;
  granularNode = null;
  mEqLow = null; mEqMid = null; mEqHigh = null;
  widthMid = null; widthSide = null;
  softClip = null; masterGain = null; limiter = null;
  analyserL = null; analyserR = null;
  meterBufL = null; meterBufR = null;
  parts.clear();
  fxBuses.length = 0;
  buffers.clear();
  sampleBufferCache.clear();
  activeVoices.clear();
  voiceGainsByPart.clear();
  // Clear 3D Synth cached state — spatial chains and voice engines hold
  // references to the old AudioContext's nodes. Without this, the next trigger
  // would try to connect old (dead) nodes to the new context, causing errors.
  try {
    const { clearAllSpatialChains, clearAll3D } = await import("@/lib/synth3d");
    clearAllSpatialChains();
    clearAll3D();
  } catch { /* synth3d not available */ }
  // Clear 3D Bass voice engines — they hold references to the old ctx's nodes.
  // Spatial chains are already cleared above (shared with 3D Synth).
  try {
    const { clearAll3DBass } = await import("@/lib/bass3d");
    clearAll3DBass();
  } catch { /* bass3d not available */ }
  useGroove.setState({ activeVoices: 0, audioReady: false });
  const newCtx = await ensureAudio();
  return newCtx;
}


export function setMasterVolume(v: number) {
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.01);
}

export async function decodeSampleFile(file: File): Promise<AudioBuffer> {
  const c = await ensureAudio();
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  const cached = sampleBufferCache.get(key);
  if (cached && isValidAudioBuffer(cached)) return cached;
  const arr = await file.arrayBuffer();
  const buf = await c.decodeAudioData(arr.slice(0));
  if (!isValidAudioBuffer(buf)) throw new Error("Invalid AudioBuffer");
  sampleBufferCache.set(key, buf);
  return buf;
}

export async function loadSampleForPart(partId: number, file: File): Promise<AudioBuffer> {
  const buf = await decodeSampleFile(file);
  buffers.set(partId, buf);
  sampleBufferCache.set(partId, buf);
  return buf;
}

export function getBuffer(partId: number): AudioBuffer | undefined { return buffers.get(partId); }

/** Hot-swap a sample buffer on a Part without audible click. Existing voices
 *  are crossfaded to silence over ~6 ms (registered via `registerVoiceGain`),
 *  the part input is briefly ducked, then the new buffer becomes available for
 *  the next trigger. Old voices keep their own reference and finish silently. */
export function assignBufferToPart(partId: number, buf: AudioBuffer) {
  if (!isValidAudioBuffer(buf)) return;
  const c = ctx;
  const chain = parts.get(partId);
  if (c && chain) {
    const now = c.currentTime;
    const FADE = 0.008; // slightly longer for safer voice teardown
    // Fade out every currently-active voice envelope for this part.
    const gains = voiceGainsByPart.get(partId);
    if (gains && gains.size) {
      gains.forEach((g) => {
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0.0001, now + FADE);
        } catch { /* node already ended */ }
      });
      // Defer clear until fade completes so onended handlers run cleanly.
      const gref = gains;
      window.setTimeout(() => gref.clear(), Math.ceil(FADE * 1000) + 10);
    }
    // Duck the part input across the swap so residual oscillator/granular
    // tails don't slam the chain when the new buffer triggers.
    try {
      const cg = chain.input.gain;
      const cur = cg.value;
      cg.cancelScheduledValues(now);
      cg.setValueAtTime(cur, now);
      cg.linearRampToValueAtTime(0.0001, now + FADE);
      window.setTimeout(() => {
        try {
          const t = c.currentTime;
          cg.setValueAtTime(0.0001, t);
          cg.linearRampToValueAtTime(cur, t + 0.005);
        } catch { /* ignore */ }
      }, Math.ceil((FADE + 0.01) * 1000));
    } catch { /* ignore */ }
  }
  buffers.set(partId, buf);
  sampleBufferCache.set(partId, buf);
}

export function previewBuffer(buf: AudioBuffer, startNorm = 0, endNorm = 1) {
  if (!ctx || !isValidAudioBuffer(buf)) return;
  // Forge / sample preview bypasses the master chain (EQ, width, soft-clip,
  // limiter) and connects straight to destination. This prevents
  // double-processing of presets that already contain their own dynamics,
  // and isolates audition from real-time mix changes.
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.005);
  src.connect(g).connect(ctx.destination);
  const s = Math.max(0, Math.min(0.999, startNorm));
  const e = Math.max(s + 0.001, Math.min(1, endNorm));
  const dur = Math.max(0.01, (e - s) * buf.duration);
  g.gain.setValueAtTime(0.8, ctx.currentTime + Math.max(0.005, dur - 0.005));
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
  src.start(ctx.currentTime, s * buf.duration, dur + 0.005);
}

// Play an arbitrary buffer region through the part channel strip (used by slice editor).
export function triggerSampleRegion(partId: number, startNorm: number, endNorm: number, velocity = 110) {
  if (!ctx) return;
  const chain = parts.get(partId);
  const buf = buffers.get(partId);
  if (!chain || !isValidAudioBuffer(buf)) return;
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = buf;
  const s = Math.max(0, Math.min(0.999, startNorm));
  const e = Math.max(s + 0.001, Math.min(1, endNorm));
  const g = c.createGain();
  const now = c.currentTime + 0.005;
  const dur = Math.max(0.01, (e - s) * buf.duration);
  const v = velocity / 127;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(v, now + 0.005);
  g.gain.setValueAtTime(v, now + Math.max(0.005, dur - 0.005));
  g.gain.linearRampToValueAtTime(0, now + dur);
  src.connect(g).connect(chain.input);
  src.start(now, s * buf.duration, dur + 0.005);
}

// Return a normalized copy of an AudioBuffer (peak → 0.99).
export function normalizeBuffer(buf: AudioBuffer): AudioBuffer {
  if (!ctx) return buf;
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  if (peak < 1e-5) return buf;
  const gain = 0.99 / peak;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * gain;
  }
  return out;
}

// Return a reversed copy of an AudioBuffer.
export function reverseBuffer(buf: AudioBuffer): AudioBuffer {
  if (!ctx) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
  }
  return out;
}

// Resample current granular/freeze settings into a new buffer and assign it to the part.
export async function resamplePart(partId: number, seconds = 4): Promise<AudioBuffer | null> {
  const { renderGranularToBuffer } = await import("./granular");
  const buf = await renderGranularToBuffer(partId, seconds);
  if (!buf) return null;
  buffers.set(partId, buf);
  return buf;
}

interface TriggerOpts { velocity?: number; semitone?: number; gateSec?: number; }

export function triggerPart(partId: number, when: number, opts: TriggerOpts = {}) {
  if (!ctx) return;
  const chain = parts.get(partId);
  if (!chain) return;
  const state = useGroove.getState();
  const part = state.parts[partId];
  if (!part) return;
  const anySolo = state.parts.some((p) => p.solo);
  if (part.mute) return;
  if (anySolo && !part.solo) return;
  // Central voice-allocation & stealing policy (voiceAllocator.ts).
  // One handle per note; the allocator grants or steals a lower/equal-priority
  // voice across ALL modules so the engine never over-allocates and critical
  // voices (bass/drums) are protected from pads/granular pile-on.
  setVoiceCap(getQuality().voiceCap);
  const { module, priority } = partVoiceClass(part);
  const handle = requestVoice(partId, module, priority);
  if (!handle) { recordDroppedVoice(); return; }
  // Per-note voice gains — collected from every module's voice so the
  // allocator can fast-fade this note on steal.
  const noteVoices: GainNode[] = [];

  const pitchMod = modOffsets.pitch.get(partId) ?? 0;
  const totalSemi = (part.pitch ?? 0) + (opts.semitone ?? 0) + pitchMod;
  const vel = opts.velocity ?? 100;
  partLastVelocity.set(partId, vel);

  const source = part.source ?? "sample";
  const hybrid = part.hybrid;
  const buf = buffers.get(partId);
  const c = ctx;
  const sampleBuffer = isValidAudioBuffer(buf) ? buf : null;

  // Helpers for one-shot sample voices
  const getReversed = (b: AudioBuffer): AudioBuffer => {
    const hit = reversedBufCache.get(b);
    if (hit) return hit;
    const out = c.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const s = b.getChannelData(ch); const d = out.getChannelData(ch);
      for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
    }
    reversedBufCache.set(b, out);
    return out;
  };

  // Plain one-shot through chain.input. `direction` = 1 forward, -1 reverse.
  const playSampleOneShot = (gainMul: number, phaseInvert: boolean, direction: 1 | -1, offset: number) => {
    if (!sampleBuffer) return;
    const w = part.wave;
    const useBuf = direction === -1 ? getReversed(sampleBuffer) : sampleBuffer;
    const ts = Math.max(0.1, (w?.timeStretch ?? 100) / 100);
    const pitchRate = Math.pow(2, (totalSemi + (w?.pitchShift ?? 0)) / 12);
    // Tape stretch: rate divides by ts (pitch follows tempo). Other modes: rate=pitchRate, stretch via grains.
    const mode = w?.stretchMode ?? "tape";
    const rate = mode === "tape" ? pitchRate / ts : pitchRate;
    const src = c.createBufferSource();
    src.buffer = useBuf;
    src.playbackRate.value = Math.max(0.05, Math.min(8, rate));
    if (w?.loop) src.loop = true;

    const baseStart = Math.max(0, Math.min(0.999, (w?.start ?? 0) + (modOffsets.sampleStart.get(partId) ?? 0)));
    const baseEnd   = Math.max(baseStart + 0.001, Math.min(1, (w?.end ?? 1) + (modOffsets.sampleEnd.get(partId) ?? 0)));
    // direction=-1 buffer is already mirrored, so start/end translate to the reversed timeline
    const sNorm = direction === -1 ? 1 - baseEnd : baseStart;
    const eNorm = direction === -1 ? 1 - baseStart : baseEnd;
    const startSec = sNorm * sampleBuffer.duration;
    const regionSec = (eNorm - sNorm) * sampleBuffer.duration;
    const playDur = Math.max(0.01, regionSec / Math.abs(rate));

    const vGain = c.createGain();
    noteVoices.push(vGain);
    const v = (vel / 127) * gainMul * (phaseInvert ? -1 : 1);
    // 5ms attack + 5ms release always applied to avoid clicks.
    const attack = Math.max(0.005, (w?.fadeIn ?? 0) / 100 * playDur);
    const release = Math.max(0.005, (w?.fadeOut ?? 0) / 100 * playDur);
    const voiceStart = when + offset;
    const voiceEnd = voiceStart + playDur;
    vGain.gain.setValueAtTime(0, when + offset);
    vGain.gain.linearRampToValueAtTime(v, when + offset + attack);
    vGain.gain.setValueAtTime(v, voiceStart + Math.max(attack, playDur - release));
    vGain.gain.linearRampToValueAtTime(0, voiceEnd);

    src.connect(vGain).connect(chain.input);
    try { src.start(voiceStart, startSec, w?.loop ? undefined : playDur + release); } catch { return; }

    if (w?.loop) {
      // Sustained / looped sample: the step gate defines the note duration;
      // fall back to a 4 s sustain if no gate. 20 ms fade-out avoids a click.
      const sustain = opts.gateSec && opts.gateSec > 0 ? opts.gateSec : 4;
      const stopAt = voiceStart + sustain;
      const fadeStart = Math.max(voiceStart, stopAt - 0.02);
      vGain.gain.cancelScheduledValues(fadeStart);
      vGain.gain.setValueAtTime(v, fadeStart);
      vGain.gain.linearRampToValueAtTime(0.0001, stopAt);
      src.stop(stopAt + 0.02);
    }
    // Non-loop one-shot: play the sample's FULL natural decay. The envelope
    // above already ramps to 0 at voiceEnd. Truncating via the step gate
    // (default ~60 ms) cut drum one-shots to a click — the audible fault.

    activeVoices.add(src);
    recordVoiceCreated();
    registerVoiceGain(partId, vGain);
    src.onended = () => {
      activeVoices.delete(src);
      unregisterVoiceGain(partId, vGain);
      recordVoiceDestroyed();
      { const n = activeVoices.size; recordActiveVoices(n); setTransientState({ activeVoices: n }); }
    };
    return playDur;
  };

  // Granular time-stretch one-shot (used for "dj"/"granular"/"hybrid" modes).
  // Plays through the same channel input, advancing the read head independently of pitch.
  const playSampleStretched = (gainMul: number, phaseInvert: boolean) => {
    if (!sampleBuffer) return;
    const w = part.wave;
    const useBuf = part.wave.playMode === "reverse" ? getReversed(sampleBuffer) : sampleBuffer;
    const pitchRate = Math.pow(2, (totalSemi + (w?.pitchShift ?? 0)) / 12);
    const stretchPct = Math.max(25, Math.min(800, (w?.timeStretch ?? 100) + ((grainModOffsets.stretch.get(partId) ?? 0) * 200)));
    const stretchRatio = stretchPct / 100;   // 2.0 = twice as long
    const grainMs = w.stretchMode === "hybrid" ? 60 : (w.stretchQuality === "high" ? 100 : w.stretchQuality === "low" ? 30 : 60);
    const grain = grainMs / 1000;
    const hopOut = grain / 2;                 // 50% overlap
    const hopIn = hopOut / stretchRatio;      // how fast we advance in the source
    const baseStart = Math.max(0, Math.min(0.999, (w?.start ?? 0)));
    const baseEnd   = Math.max(baseStart + 0.001, Math.min(1, (w?.end ?? 1)));
    const startSec = baseStart * sampleBuffer.duration;
    const regionSec = (baseEnd - baseStart) * sampleBuffer.duration;
    const totalOut = regionSec * stretchRatio;
    // One-shot time-stretch plays its full stretched length. The step gate
    // (default ~60 ms) must not truncate a one-shot — that cut it to a click.
    // (This path is only used for non-loop stretches; looped textures keep
    // their own sustain handling on the main one-shot path.)
    const dur = totalOut;

    const v = (vel / 127) * gainMul * (phaseInvert ? -1 : 1);
    const env = c.createGain();
    noteVoices.push(env);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(v, when + 0.005);
    env.connect(chain.input);
    registerVoiceGain(partId, env);
    // Unregister the per-voice env once its tail completes.
    window.setTimeout(() => unregisterVoiceGain(partId, env), Math.ceil((dur + 0.05) * 1000));

    const curve = new Float32Array(24);
    for (let i = 0; i < 24; i++) curve[i] = Math.sin((i / 23) * Math.PI);

    let outT = 0, inT = 0;
    while (outT < dur) {
      const src = c.createBufferSource();
      src.buffer = useBuf;
      src.playbackRate.value = Math.max(0.05, Math.min(8, pitchRate));
      const g = c.createGain(); g.gain.value = 0;
      // Manual Hann-style ramp avoids setValueCurveAtTime overlap exceptions
      // (which would leave gain stuck at 0 → silent grains / dropout).
      const envStart = when + outT;
      const envEnd = envStart + grain;
      try {
        g.gain.cancelScheduledValues(envStart);
        g.gain.setValueAtTime(0.0001, envStart);
        g.gain.linearRampToValueAtTime(1, envStart + 0.001);
        g.gain.setValueAtTime(1, envEnd - 0.001);
        g.gain.linearRampToValueAtTime(0.0001, envEnd);
      } catch { /* schedule conflict — skip */ }
      src.connect(g).connect(env);
      const srcOff = startSec + (inT % Math.max(0.05, regionSec));
      try { src.start(when + outT, srcOff); } catch { break; }
      src.stop(when + outT + grain + 0.05);
      activeVoices.add(src);
      recordVoiceCreated();
      src.onended = () => {
        activeVoices.delete(src);
        recordVoiceDestroyed();
        { const n = activeVoices.size; recordActiveVoices(n); setTransientState({ activeVoices: n }); }
      };
      outT += hopOut;
      inT += hopIn;
    }
    // release the env shortly after
    env.gain.setValueAtTime(v, when + dur);
    env.gain.linearRampToValueAtTime(0, when + dur + 0.005);
  };

  const playSample = (gainMul: number, phaseInvert: boolean) => {
    if (!sampleBuffer) return;
    const w = part.wave;
    const mode: typeof w.playMode = w?.playMode ?? (w?.reverse ? "reverse" : "forward");
    const stretchMode = w?.stretchMode ?? "tape";

    // Non-tape stretch — use granular stretching engine; pingpong follows same path twice.
    if (stretchMode !== "tape" && !w?.loop) {
      playSampleStretched(gainMul, phaseInvert);
      return;
    }

    if (mode === "forward")      playSampleOneShot(gainMul, phaseInvert, 1, 0);
    else if (mode === "reverse") playSampleOneShot(gainMul, phaseInvert, -1, 0);
    else { // pingpong
      const fwdDur = playSampleOneShot(gainMul, phaseInvert, 1, 0) ?? 0;
      playSampleOneShot(gainMul, phaseInvert, -1, fwdDur);
    }
  };

  // Synth layer
  const playSynth = async (gainMul: number, phaseInvert: boolean) => {
    // VibeCore 3D Synth — dedicated 3D voice engine with DSP Core primitives,
    // modulation matrix, unison, and spatial processing. Routes through the
    // part's channel strip (chain.input) unchanged — Audio Engine stable.
    if (part.synth.engine === "3D") {
      const { trigger3DSynth } = await import("@/lib/synth3d/trigger");
      await trigger3DSynth(c, chain.input, part, when, {
        velocity: vel, semitone: totalSemi, gateSec: opts.gateSec,
      });
      // Release the engine.ts voice handle — the 3D voice engine handles its
      // own allocation via the central voice allocator (triggerNote3D calls
      // requestVoice internally). Without this release, each 3D note would
      // consume two voice slots (one from triggerPart, one from triggerNote3D),
      // halving effective polyphony. The steal callback registered below on
      // this handle has empty noteVoices (the 3D path returns before pushing),
      // so releasing early is safe.
      handle.release();
      return;
    }
    if (part.synth.engine === "3D Bass") {
      const { trigger3DBass } = await import("@/lib/bass3d/trigger");
      await trigger3DBass(c, chain.input, part, when, {
        velocity: vel, semitone: totalSemi, gateSec: opts.gateSec,
      });
      // Release the engine.ts voice handle — the 3D Bass voice engine
      // manages its own allocation via the central voice allocator. Same
      // pattern as the 3D Synth: one allocation per note, no double counting.
      handle.release();
      return;
    }
    const { triggerSynth } = await import("./synthVoice");
    const g = c.createGain();
    noteVoices.push(g);
    g.gain.value = gainMul * (phaseInvert ? -1 : 1);
    g.connect(chain.input);
    triggerSynth(c, g, part.synth, when, { velocity: vel, semitone: totalSemi, gateSec: opts.gateSec });
  };

  // Sub layer (hybrid only)
  const playSub = (gainMul: number) => {
    const sub = c.createOscillator(); sub.type = "sine";
    sub.frequency.value = 20 + ((hybrid?.subFreq ?? 55) / 100) * 180;
    const g = c.createGain();
    noteVoices.push(g);
    const decay = 0.3 + (opts.gateSec ?? 0.4);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime((vel / 127) * gainMul, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    sub.connect(g).connect(chain.input);
    sub.start(when); sub.stop(when + decay + 0.05);
  };

  if (source === "sample") {
    playSample(1, false);
  } else if (source === "synth") {
    playSynth(1, false);
  } else {
    // hybrid
    if (hybrid.sampleMix > 0 && sampleBuffer) playSample(hybrid.sampleMix / 100, hybrid.samplePhase);
    if (hybrid.synthMix > 0) playSynth(hybrid.synthMix / 100, hybrid.synthPhase);
    if (hybrid.subMix > 0) playSub(hybrid.subMix / 100);
  }

  // Register this note's voices with the central allocator so a higher- or
  // equal-priority module can steal it (fast fade) instead of dropping the
  // new trigger. Steal reads noteVoices at call time, so async synth pushes
  // (await import) are already present by the time a steal occurs.
  handle.steal((fade) => {
    const now = c.currentTime;
    for (const g of noteVoices) {
      try {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0.0001, now + fade);
      } catch { /* voice already ended */ }
    }
  });
  const noteDurMs = (Math.max(opts.gateSec ?? 0.3, 0.3) + 0.5) * 1000;
  window.setTimeout(() => handle.release(), noteDurMs);

  { const n = activeVoices.size; recordActiveVoices(n); setTransientState({ activeVoices: n }); }
}

// ─── master bus ─────────────────────────────────────────────────────────────

function buildMaster() {
  if (!ctx) return;
  masterIn = ctx.createGain();
  mEqLow = ctx.createBiquadFilter(); mEqLow.type = "lowshelf"; mEqLow.frequency.value = 200;
  mEqMid = ctx.createBiquadFilter(); mEqMid.type = "peaking"; mEqMid.frequency.value = 1000; mEqMid.Q.value = 0.9;
  mEqHigh = ctx.createBiquadFilter(); mEqHigh.type = "highshelf"; mEqHigh.frequency.value = 5000;

  // M/S width: split → mid/side gains → merge
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  // mid = (L+R)/2, side = (L-R)/2
  // outL = mid + side*W, outR = mid - side*W
  // We approximate by gain matrix using inverted side.
  widthMid = ctx.createGain(); widthMid.gain.value = 1;
  widthSide = ctx.createGain(); widthSide.gain.value = 1;
  const invR = ctx.createGain(); invR.gain.value = -1;
  const sideInvForR = ctx.createGain(); sideInvForR.gain.value = -1;

  // L into splitter ch0, R into ch1
  // Mid path: L + R → widthMid → both outputs
  // Side path: (L - R) → widthSide → +L, then inverted into R
  splitter.connect(widthMid, 0); splitter.connect(widthMid, 1);
  splitter.connect(widthSide, 0);
  splitter.connect(invR, 1); invR.connect(widthSide);
  widthMid.connect(merger, 0, 0); widthMid.connect(merger, 0, 1);
  widthSide.connect(merger, 0, 0);
  widthSide.connect(sideInvForR); sideInvForR.connect(merger, 0, 1);

  softClip = ctx.createWaveShaper();
  softClip.curve = makeSoftClipCurve(25);
  softClip.oversample = "2x";

  masterGain = ctx.createGain();
  masterGain.gain.value = useGroove.getState().masterVolume / 100;

  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.001; limiter.release.value = 0.05;

  const split2 = ctx.createChannelSplitter(2);
  analyserL = ctx.createAnalyser(); analyserL.fftSize = 256;
  analyserR = ctx.createAnalyser(); analyserR.fftSize = 256;
  meterBufL = new Float32Array(new ArrayBuffer(analyserL.fftSize * 4));
  meterBufR = new Float32Array(new ArrayBuffer(analyserR.fftSize * 4));

  masterIn.connect(mEqLow).connect(mEqMid).connect(mEqHigh).connect(splitter);
  merger.connect(softClip).connect(masterGain).connect(limiter);
  limiter.connect(split2);
  split2.connect(analyserL, 0); split2.connect(analyserR, 1);
  limiter.connect(ctx.destination);
}

// ─── per-part chain ─────────────────────────────────────────────────────────

function buildAllPartChains() {
  const list = useGroove.getState().parts;
  list.forEach((p) => buildPartChain(p));
}

function buildPartChain(p: Part) {
  if (!ctx || !masterIn) return;
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = "highpass";
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";

  // parallel dry/wet for drive to make WaveShaper sound clean when drive=0
  const drive = ctx.createWaveShaper(); drive.oversample = "2x";
  const driveWet = ctx.createGain(); driveWet.gain.value = 0;
  const driveDry = ctx.createGain(); driveDry.gain.value = 1;
  const driveOut = ctx.createGain();

  const eqLow = ctx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 200;
  const eqMid = ctx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 0.9;
  const eqHigh = ctx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 5000;

  const outGain = ctx.createGain();
  const volume = ctx.createGain();
  const pan = ctx.createStereoPanner();
  // sendTap = post-fader (post volume/pan), pre-EQ. Sends are taken from here
  // so FX-bus signals never pass through the per-channel EQ again, preventing
  // double-EQ when the routed FX slot is itself an "EQ" or "Compressor" type.
  const sendTap = ctx.createGain();
  const postSplit = ctx.createGain();

  const dry = ctx.createGain(); dry.gain.value = 1;
  const sends: GainNode[] = Array.from({ length: 6 }, () => {
    const g = ctx!.createGain(); g.gain.value = 0; return g;
  });

  const analyser = ctx.createAnalyser(); analyser.fftSize = 128;
  const meterBuf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

  // wiring (dry path): input → hp → lp → [dry + (drive→driveWet)] → driveOut
  //                  → outGain → volume → pan → sendTap → eqLow → eqMid → eqHigh → postSplit → dry → master
  // wiring (send path): sendTap → sends[i] → fxBus.input  (pre-EQ, post-fader)
  input.connect(hp).connect(lp);
  lp.connect(driveDry).connect(driveOut);
  lp.connect(drive).connect(driveWet).connect(driveOut);
  driveOut.connect(outGain).connect(volume).connect(pan).connect(sendTap);
  sendTap.connect(eqLow).connect(eqMid).connect(eqHigh).connect(postSplit);

  postSplit.connect(dry).connect(masterIn);
  postSplit.connect(analyser);
  sends.forEach((g, i) => {
    sendTap.connect(g);
    const bus = fxBuses[i];
    if (bus) g.connect(bus.input);
  });

  parts.set(p.id, {
    input, hp, lp, drive, driveDry, driveWet,
    eqLow, eqMid, eqHigh, outGain, volume, pan,
    postSplit, dry, sends, analyser, meterBuf,
  });
}

// ─── FX buses ───────────────────────────────────────────────────────────────

function buildFxBuses() {
  if (!ctx || !masterIn) return;
  const state = useGroove.getState();
  for (let i = 0; i < 6; i++) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const boost = ctx.createGain(); boost.gain.value = 1;
    const wet = ctx.createGain(); wet.gain.value = 0;
    // busLevel is the dedicated channel-level node (store volume + mute).
    // It sits after wet so FX-param writes (boost) never reach it.
    const busLevel = ctx.createGain(); busLevel.gain.value = 1;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 128;
    const meterBuf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    output.connect(boost).connect(wet).connect(busLevel).connect(masterIn);
    // Meter taps the post-wet signal so bypass / mix / boost are reflected
    // truthfully in the per-slot output meter.
    wet.connect(analyser);
    fxBuses[i] = { input, output, boost, wet, busLevel, analyser, meterBuf, nodes: [], oscillators: [], type: null, update: null };
    attachFx(i, state.fx[i]?.type ?? null, state.fx[i]?.params ?? {});
  }
}

function clearFx(bus: FxBus) {
  try { bus.input.disconnect(); } catch {/**/}
  bus.oscillators.forEach((o) => { try { o.stop(); } catch {/**/} try { o.disconnect(); } catch {/**/} });
  bus.nodes.forEach((n) => { try { (n as AudioNode & { disconnect?: () => void }).disconnect?.(); } catch {/**/} });
  bus.nodes = [];
  bus.oscillators = [];
  bus.update = null;
  bus.type = null;
}

// Lerp helpers
function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function expScale(min: number, max: number, t: number) {
  return min * Math.pow(max / min, Math.max(0, Math.min(1, t)));
}
function divisionSec(bpm: number, t: number): number {
  // 4 zones: 1/16, 1/8, 1/4, 1/2
  const beat = 60 / bpm;
  if (t < 25) return beat / 4;
  if (t < 50) return beat / 2;
  if (t < 75) return beat;
  return beat * 2;
}

function attachFx(idx: number, type: FxType | null, params: Record<string, number>) {
  if (!ctx) return;
  const bus = fxBuses[idx];
  if (!bus) return;
  clearFx(bus);
  bus.type = type;

  if (!type) {
    bus.input.connect(bus.output);
    return;
  }

  const c = ctx;
  const nodes: AudioNode[] = [];
  const oscs: OscillatorNode[] = [];

  switch (type) {
    case "Chorus": {
      const delay = c.createDelay(0.05); delay.delayTime.value = 0.020;
      const lfo = c.createOscillator(); lfo.frequency.value = 1.2;
      const lfoGain = c.createGain(); lfoGain.gain.value = 0.005;
      const fb = c.createGain(); fb.gain.value = 0.2;
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 6000;
      lfo.connect(lfoGain).connect(delay.delayTime); lfo.start();
      bus.input.connect(delay).connect(tone).connect(bus.output);
      tone.connect(fb).connect(delay);
      nodes.push(delay, lfoGain, fb, tone); oscs.push(lfo);
      bus.update = (p) => {
        lfo.frequency.setTargetAtTime(expScale(0.1, 6, p.A / 100), c.currentTime, 0.05);
        lfoGain.gain.setTargetAtTime((p.B / 100) * 0.012, c.currentTime, 0.05);
        fb.gain.setTargetAtTime((p.C / 100) * 0.7, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(500, 15000, p.D / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Flanger": {
      const delay = c.createDelay(0.02);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.5;
      const lfoGain = c.createGain(); lfoGain.gain.value = 0.002;
      const fb = c.createGain(); fb.gain.value = 0.6;
      lfo.connect(lfoGain).connect(delay.delayTime); lfo.start();
      bus.input.connect(delay).connect(bus.output);
      delay.connect(fb).connect(delay);
      nodes.push(delay, lfoGain, fb); oscs.push(lfo);
      bus.update = (p) => {
        lfo.frequency.setTargetAtTime(expScale(0.05, 8, p.A / 100), c.currentTime, 0.05);
        lfoGain.gain.setTargetAtTime((p.B / 100) * 0.005, c.currentTime, 0.05);
        fb.gain.setTargetAtTime((p.C / 100) * 0.92, c.currentTime, 0.05);
        delay.delayTime.setTargetAtTime(lerp(0.0005, 0.012, p.D / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Ring Mod": {
      // multiply: dry * carrier via gain modulation. Use ConstantSource baseline 0 + osc into gain.gain
      const ring = c.createGain(); ring.gain.value = 0;
      const carrier = c.createOscillator(); carrier.type = "sine"; carrier.frequency.value = 200;
      const carGain = c.createGain(); carGain.gain.value = 1;
      carrier.connect(carGain).connect(ring.gain);
      carrier.start();
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 8000;
      bus.input.connect(ring).connect(tone).connect(bus.output);
      nodes.push(ring, carGain, tone); oscs.push(carrier);
      bus.update = (p) => {
        carrier.frequency.setTargetAtTime(expScale(30, 3000, p.A / 100), c.currentTime, 0.02);
        carrier.type = p.B < 33 ? "sine" : p.B < 66 ? "triangle" : "square";
        tone.frequency.setTargetAtTime(expScale(800, 16000, p.C / 100), c.currentTime, 0.05);
        carGain.gain.setTargetAtTime(0.5 + (p.D / 100) * 0.5, c.currentTime, 0.05);
      };
      break;
    }
    case "BPM Delay": {
      const delay = c.createDelay(3);
      const fb = c.createGain(); fb.gain.value = 0.5;
      const fbLim = c.createDynamicsCompressor();
      fbLim.threshold.value = -3; fbLim.knee.value = 6; fbLim.ratio.value = 12;
      fbLim.attack.value = 0.003; fbLim.release.value = 0.12;
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 4500;
      const pan = c.createStereoPanner();
      bus.input.connect(delay).connect(tone).connect(pan).connect(bus.output);
      tone.connect(fb).connect(fbLim).connect(delay);
      nodes.push(delay, fb, fbLim, tone, pan);
      bus.update = (p, bpm) => {
        delay.delayTime.setTargetAtTime(divisionSec(bpm, p.A), c.currentTime, 0.05);
        fb.gain.setTargetAtTime((p.B / 100) * 0.88, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(500, 15000, p.C / 100), c.currentTime, 0.05);
        pan.pan.setTargetAtTime(((p.D - 50) / 50) * 0.7, c.currentTime, 0.05);
      };
      break;
    }
    case "Short Delay": {
      const delay = c.createDelay(0.5);
      const fb = c.createGain(); fb.gain.value = 0.35;
      const fbLim = c.createDynamicsCompressor();
      fbLim.threshold.value = -3; fbLim.knee.value = 6; fbLim.ratio.value = 12;
      fbLim.attack.value = 0.003; fbLim.release.value = 0.12;
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 6000;
      bus.input.connect(delay).connect(tone).connect(bus.output);
      tone.connect(fb).connect(fbLim).connect(delay);
      nodes.push(delay, fb, fbLim, tone);
      bus.update = (p) => {
        delay.delayTime.setTargetAtTime(lerp(0.01, 0.35, p.A / 100), c.currentTime, 0.05);
        fb.gain.setTargetAtTime((p.B / 100) * 0.85, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(800, 16000, p.C / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Ping Pong": {
      const splitter = c.createChannelSplitter(2);
      const merger = c.createChannelMerger(2);
      const dL = c.createDelay(2); const dR = c.createDelay(2);
      const fbL = c.createGain(); const fbR = c.createGain();
      const limL = c.createDynamicsCompressor();
      const limR = c.createDynamicsCompressor();
      [limL, limR].forEach((l) => {
        l.threshold.value = -3; l.knee.value = 6; l.ratio.value = 12;
        l.attack.value = 0.003; l.release.value = 0.12;
      });
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 5000;
      fbL.gain.value = 0.55; fbR.gain.value = 0.55;
      bus.input.connect(splitter);
      splitter.connect(dL, 0); splitter.connect(dR, 1);
      dL.connect(fbR).connect(limR).connect(dR);
      dR.connect(fbL).connect(limL).connect(dL);
      dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
      merger.connect(tone).connect(bus.output);
      nodes.push(splitter, merger, dL, dR, fbL, fbR, limL, limR, tone);
      bus.update = (p, bpm) => {
        const t = divisionSec(bpm, p.A);
        dL.delayTime.setTargetAtTime(t, c.currentTime, 0.05);
        dR.delayTime.setTargetAtTime(t * (0.5 + p.D / 200), c.currentTime, 0.05);
        const g = (p.B / 100) * 0.88;
        fbL.gain.setTargetAtTime(g, c.currentTime, 0.05);
        fbR.gain.setTargetAtTime(g, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(800, 15000, p.C / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Hall Reverb":
    case "Room Reverb":
    case "Freeze": {
      const pre = c.createDelay(0.2);
      const damp = c.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 6000;
      const conv = c.createConvolver();
      const size = type === "Hall Reverb" ? 3.5 : type === "Room Reverb" ? 0.8 : 8.0;
      conv.buffer = makeImpulse(c, size, 2.5);
      let lastKey = "";
      bus.input.connect(pre).connect(damp).connect(conv).connect(bus.output);
      nodes.push(pre, damp, conv);
      bus.update = (p) => {
        const dur = type === "Hall Reverb" ? lerp(1.5, 6, p.A / 100)
                  : type === "Room Reverb" ? lerp(0.2, 1.8, p.A / 100)
                  : lerp(6, 20, p.A / 100);
        const decay = type === "Freeze" ? 0.5 : lerp(0.8, 4, p.B / 100);
        const key = `${dur.toFixed(2)}:${decay.toFixed(2)}`;
        if (key !== lastKey) {
          conv.buffer = makeImpulse(c, dur, decay);
          lastKey = key;
        }
        damp.frequency.setTargetAtTime(expScale(800, 16000, p.C / 100), c.currentTime, 0.05);
        const pre_t = type === "Freeze"
          ? lerp(0, 0.2, p.D / 100)
          : lerp(0, 0.15, p.D / 100);
        pre.delayTime.setTargetAtTime(pre_t, c.currentTime, 0.05);
      };
      break;
    }
    case "Pitch Shift": {
      // Two-delay crossfade pseudo-pitch shifter
      const splitter = c.createGain();
      const d1 = c.createDelay(0.1); const d2 = c.createDelay(0.1);
      const g1 = c.createGain(); const g2 = c.createGain();
      const lfo1 = c.createOscillator(); lfo1.type = "sawtooth"; lfo1.frequency.value = 8;
      const lfo2 = c.createOscillator(); lfo2.type = "sawtooth"; lfo2.frequency.value = 8;
      const lfo1Gain = c.createGain(); lfo1Gain.gain.value = 0.025;
      const lfo2Gain = c.createGain(); lfo2Gain.gain.value = 0.025;
      const xfade1 = c.createOscillator(); xfade1.type = "triangle"; xfade1.frequency.value = 8;
      const xfade2 = c.createOscillator(); xfade2.type = "triangle"; xfade2.frequency.value = 8;
      const xg1 = c.createGain(); xg1.gain.value = 0.5;
      const xg2 = c.createGain(); xg2.gain.value = 0.5;
      const fb = c.createGain(); fb.gain.value = 0;
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 8000;
      lfo1.connect(lfo1Gain).connect(d1.delayTime);
      lfo2.connect(lfo2Gain).connect(d2.delayTime);
      xfade1.connect(xg1).connect(g1.gain);
      xfade2.connect(xg2).connect(g2.gain);
      bus.input.connect(splitter);
      splitter.connect(d1).connect(g1);
      splitter.connect(d2).connect(g2);
      g1.connect(tone); g2.connect(tone);
      tone.connect(bus.output);
      tone.connect(fb).connect(splitter);
      lfo1.start(); lfo2.start(); xfade1.start(); xfade2.start();
      // offset phase: schedule lfo2 250ms ahead
      lfo2.frequency.setValueAtTime(8, c.currentTime);
      nodes.push(splitter, d1, d2, g1, g2, lfo1Gain, lfo2Gain, xg1, xg2, fb, tone);
      oscs.push(lfo1, lfo2, xfade1, xfade2);
      bus.update = (p) => {
        const semis = ((p.A - 50) / 50) * 12 + ((p.B - 50) / 50);
        const rate = Math.abs(semis) < 0.05 ? 0.01 : 6 * (Math.pow(2, Math.abs(semis) / 12) - 1);
        const sign = semis >= 0 ? 1 : -1;
        const r = Math.max(0.5, Math.min(40, rate));
        lfo1.frequency.setTargetAtTime(r, c.currentTime, 0.05);
        lfo2.frequency.setTargetAtTime(r, c.currentTime, 0.05);
        xfade1.frequency.setTargetAtTime(r, c.currentTime, 0.05);
        xfade2.frequency.setTargetAtTime(r, c.currentTime, 0.05);
        const depth = sign * 0.04;
        lfo1Gain.gain.setTargetAtTime(depth, c.currentTime, 0.05);
        lfo2Gain.gain.setTargetAtTime(depth, c.currentTime, 0.05);
        fb.gain.setTargetAtTime((p.C / 100) * 0.6, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(800, 16000, p.D / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Voice Mod": {
      // 3 parallel band-pass formant filters, blendable by LFO sweep between vowels.
      const bp1 = c.createBiquadFilter(); bp1.type = "bandpass";
      const bp2 = c.createBiquadFilter(); bp2.type = "bandpass";
      const bp3 = c.createBiquadFilter(); bp3.type = "bandpass";
      const mix = c.createGain(); mix.gain.value = 0.33;
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 8000;
      const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.3;
      const lfoGain = c.createGain(); lfoGain.gain.value = 0;
      const offset = c.createConstantSource(); offset.offset.value = 700;
      offset.start(); lfo.start();
      offset.connect(bp2.frequency);
      lfo.connect(lfoGain).connect(bp2.frequency);
      bus.input.connect(bp1); bus.input.connect(bp2); bus.input.connect(bp3);
      bp1.connect(mix); bp2.connect(mix); bp3.connect(mix);
      mix.connect(tone).connect(bus.output);
      nodes.push(bp1, bp2, bp3, mix, tone, lfoGain, offset); oscs.push(lfo);
      const vowels = [
        [270, 2300, 3000],  // i
        [390, 2000, 2550],  // e
        [600, 1800, 2400],  // a
        [450, 800, 2400],   // o
        [325, 700, 2200],   // u
      ];
      bus.update = (p) => {
        const v = (p.A / 100) * (vowels.length - 1);
        const i0 = Math.floor(v); const f = v - i0;
        const a = vowels[i0]; const b = vowels[Math.min(vowels.length - 1, i0 + 1)];
        bp1.frequency.setTargetAtTime(lerp(a[0], b[0], f), c.currentTime, 0.05);
        offset.offset.setTargetAtTime(lerp(a[1], b[1], f), c.currentTime, 0.05);
        bp3.frequency.setTargetAtTime(lerp(a[2], b[2], f), c.currentTime, 0.05);
        const q = 2 + (p.B / 100) * 18;
        bp1.Q.setTargetAtTime(q, c.currentTime, 0.05);
        bp2.Q.setTargetAtTime(q, c.currentTime, 0.05);
        bp3.Q.setTargetAtTime(q, c.currentTime, 0.05);
        lfo.frequency.setTargetAtTime(expScale(0.05, 6, p.C / 100), c.currentTime, 0.05);
        lfoGain.gain.setTargetAtTime((p.C / 100) * 400, c.currentTime, 0.05);
        tone.frequency.setTargetAtTime(expScale(1000, 16000, p.D / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "EQ": {
      const low = c.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 120;
      const loMid = c.createBiquadFilter(); loMid.type = "peaking"; loMid.frequency.value = 500; loMid.Q.value = 0.9;
      const hiMid = c.createBiquadFilter(); hiMid.type = "peaking"; hiMid.frequency.value = 2500; hiMid.Q.value = 0.9;
      const high = c.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 8000;
      bus.input.connect(low).connect(loMid).connect(hiMid).connect(high).connect(bus.output);
      nodes.push(low, loMid, hiMid, high);
      bus.update = (p) => {
        low.gain.setTargetAtTime(((p.A - 50) / 50) * 18, c.currentTime, 0.05);
        loMid.gain.setTargetAtTime(((p.B - 50) / 50) * 18, c.currentTime, 0.05);
        hiMid.gain.setTargetAtTime(((p.C - 50) / 50) * 18, c.currentTime, 0.05);
        high.gain.setTargetAtTime(((p.D - 50) / 50) * 18, c.currentTime, 0.05);
      };
      break;
    }
    case "Compressor": {
      const comp = c.createDynamicsCompressor();
      const mu = c.createGain(); mu.gain.value = 1.4;
      bus.input.connect(comp).connect(mu).connect(bus.output);
      nodes.push(comp, mu);
      bus.update = (p) => {
        comp.threshold.setTargetAtTime(lerp(-50, 0, 1 - p.A / 100), c.currentTime, 0.05);
        comp.ratio.setTargetAtTime(lerp(1.5, 20, p.B / 100), c.currentTime, 0.05);
        comp.attack.setTargetAtTime(lerp(0.001, 0.1, p.C / 100), c.currentTime, 0.05);
        comp.release.setTargetAtTime(lerp(0.02, 0.6, p.D / 100), c.currentTime, 0.05);
      };
      break;
    }
    case "Saturator": {
      const ws = c.createWaveShaper(); ws.oversample = "2x";
      const tone = c.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 8000;
      const bias = c.createConstantSource(); bias.offset.value = 0; bias.start();
      const sum = c.createGain();
      bus.input.connect(sum); bias.connect(sum);
      sum.connect(ws).connect(tone).connect(bus.output);
      let key = "";
      nodes.push(ws, tone, bias, sum);
      bus.update = (p) => {
        const tIdx = p.B < 33 ? "soft" : p.B < 66 ? "tape" : "tube";
        const k = `${tIdx}:${Math.round(p.A)}`;
        if (k !== key) { ws.curve = makeDriveCurve(tIdx as DriveType, p.A); key = k; }
        tone.frequency.setTargetAtTime(expScale(600, 16000, p.C / 100), c.currentTime, 0.05);
        bias.offset.setTargetAtTime(((p.D - 50) / 50) * 0.15, c.currentTime, 0.05);
      };
      break;
    }
    case "Limiter": {
      const pre = c.createGain(); pre.gain.value = 1;
      const look = c.createDelay(0.02);
      const lim = c.createDynamicsCompressor();
      lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001;
      const ceiling = c.createGain(); ceiling.gain.value = 1;
      bus.input.connect(pre).connect(look).connect(lim).connect(ceiling).connect(bus.output);
      nodes.push(pre, look, lim, ceiling);
      bus.update = (p) => {
        const thresh = lerp(-30, 0, 1 - p.A / 100);
        lim.threshold.setTargetAtTime(thresh, c.currentTime, 0.02);
        lim.release.setTargetAtTime(lerp(0.01, 0.3, p.B / 100), c.currentTime, 0.05);
        const ceilDb = lerp(-6, 0, p.C / 100);
        ceiling.gain.setTargetAtTime(Math.pow(10, ceilDb / 20), c.currentTime, 0.05);
        look.delayTime.setTargetAtTime(lerp(0, 0.015, p.D / 100), c.currentTime, 0.05);
        pre.gain.setTargetAtTime(Math.pow(10, -thresh / 40), c.currentTime, 0.05);
      };
      break;
    }
    case "Stereo Width": {
      const splitter = c.createChannelSplitter(2);
      const merger = c.createChannelMerger(2);
      const mid = c.createGain(); mid.gain.value = 0.5;
      const side = c.createGain(); side.gain.value = 0.5;
      const invR = c.createGain(); invR.gain.value = -1;
      const sideInvR = c.createGain(); sideInvR.gain.value = -1;
      const tiltL = c.createGain(); tiltL.gain.value = 1;
      const tiltR = c.createGain(); tiltR.gain.value = 1;
      const bassMono = c.createBiquadFilter(); bassMono.type = "lowpass"; bassMono.frequency.value = 120;
      bus.input.connect(splitter);
      splitter.connect(mid, 0); splitter.connect(mid, 1);
      splitter.connect(side, 0); splitter.connect(invR, 1); invR.connect(side);
      const preMergeL = c.createGain(); const preMergeR = c.createGain();
      mid.connect(preMergeL); mid.connect(preMergeR);
      side.connect(preMergeL); side.connect(sideInvR); sideInvR.connect(preMergeR);
      preMergeL.connect(tiltL).connect(merger, 0, 0);
      preMergeR.connect(tiltR).connect(merger, 0, 1);
      // bass mono blend: take mid only at low freq, sum into both
      bus.input.connect(bassMono);
      bassMono.connect(merger, 0, 0); bassMono.connect(merger, 0, 1);
      merger.connect(bus.output);
      nodes.push(splitter, merger, mid, side, invR, sideInvR, tiltL, tiltR, bassMono, preMergeL, preMergeR);
      bus.update = (p) => {
        side.gain.setTargetAtTime((p.A / 100) * 1.0, c.currentTime, 0.05);
        bassMono.frequency.setTargetAtTime(lerp(40, 400, p.B / 100), c.currentTime, 0.05);
        // bassMono is a low-shelf used as crossover; keep its shelf gain neutral.
        const tilt = (p.C - 50) / 50;
        tiltL.gain.setTargetAtTime(1 - Math.max(0, tilt) * 0.6, c.currentTime, 0.05);
        tiltR.gain.setTargetAtTime(1 - Math.max(0, -tilt) * 0.6, c.currentTime, 0.05);
        // phase inversion sweep on side
        sideInvR.gain.setTargetAtTime(-1 + (p.D / 100) * 2, c.currentTime, 0.05);
      };
      break;
    }
    case "3D Matrix": {
      const splitter = c.createChannelSplitter(2);
      const merger = c.createChannelMerger(2);
      const haasL = c.createDelay(0.05); const haasR = c.createDelay(0.05);
      const mid = c.createGain(); mid.gain.value = 0.5;
      const side = c.createGain(); side.gain.value = 0.8;
      const invR = c.createGain(); invR.gain.value = -1;
      const sideInvR = c.createGain(); sideInvR.gain.value = -1;
      const rotL = c.createGain(); rotL.gain.value = 1;
      const rotR = c.createGain(); rotR.gain.value = 1;
      const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.3;
      const lfoG = c.createGain(); lfoG.gain.value = 0;
      const lfoGNeg = c.createGain(); lfoGNeg.gain.value = 0;
      const inv = c.createGain(); inv.gain.value = -1;
      lfo.connect(lfoG).connect(rotL.gain);
      lfo.connect(inv).connect(lfoGNeg).connect(rotR.gain);
      lfo.start();
      bus.input.connect(splitter);
      splitter.connect(mid, 0); splitter.connect(mid, 1);
      splitter.connect(side, 0); splitter.connect(invR, 1); invR.connect(side);
      const sumL = c.createGain(); const sumR = c.createGain();
      mid.connect(sumL); mid.connect(sumR);
      side.connect(sumL); side.connect(sideInvR); sideInvR.connect(sumR);
      sumL.connect(haasL).connect(rotL).connect(merger, 0, 0);
      sumR.connect(haasR).connect(rotR).connect(merger, 0, 1);
      merger.connect(bus.output);
      nodes.push(splitter, merger, haasL, haasR, mid, side, invR, sideInvR, rotL, rotR, lfoG, lfoGNeg, inv, sumL, sumR);
      oscs.push(lfo);
      bus.update = (p) => {
        side.gain.setTargetAtTime((p.A / 100) * 1.4, c.currentTime, 0.05);
        haasR.delayTime.setTargetAtTime(lerp(0, 0.025, p.B / 100), c.currentTime, 0.05);
        lfo.frequency.setTargetAtTime(expScale(0.05, 3, p.C / 100), c.currentTime, 0.05);
        const d = (p.C / 100) * 0.5;
        lfoG.gain.setTargetAtTime(d, c.currentTime, 0.05);
        lfoGNeg.gain.setTargetAtTime(d, c.currentTime, 0.05);
        mid.gain.setTargetAtTime(0.5 + (p.D / 100) * 0.5, c.currentTime, 0.05);
      };
      break;
    }
  }

  bus.nodes = nodes;
  bus.oscillators = oscs;
  if (bus.update) bus.update(params, useGroove.getState().bpm);
}

// ─── curves ─────────────────────────────────────────────────────────────────

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();
function makeDriveCurve(type: DriveType, amount: number): Float32Array<ArrayBuffer> {
  const key = `${type}:${amount}`;
  const cached = curveCache.get(key);
  if (cached) return cached;
  const N = 2048;
  const c = new Float32Array(new ArrayBuffer(N * 4));
  const k = 1 + (amount / 100) * 9; // 1..10
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    let y = 0;
    if (type === "soft") {
      y = Math.tanh(x * k);
    } else if (type === "tape") {
      // smooth tape-style saturation with mild asymmetry
      const a = Math.tanh(x * k * 0.9);
      y = a - 0.08 * a * a;
    } else {
      // tube: asymmetric soft clip
      const bx = x * k + 0.1;
      y = bx - (bx * bx * bx) / 3;
      y = Math.max(-1, Math.min(1, y * 0.6));
    }
    c[i] = y;
  }
  curveCache.set(key, c);
  return c;
}

function makeSoftClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const N = 1024;
  const c = new Float32Array(new ArrayBuffer(N * 4));
  const k = 1 + (amount / 100) * 4;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    c[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return c;
}

function makeImpulse(c: AudioContext, dur: number, decay: number): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.floor(rate * dur);
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// ─── param application ─────────────────────────────────────────────────────

function hpFreq(v: number) { return 20 * Math.pow(100, Math.max(0, Math.min(100, v)) / 100); }
function lpFreq(v: number) { return 200 * Math.pow(100, Math.max(0, Math.min(100, v)) / 100); }
function qFromRes(v: number) { return 0.5 + (Math.max(0, Math.min(100, v)) / 100) * 9.5; }

const lastDriveKey = new Map<number, string>();
const lastFxType = new Map<number, FxType | null>();

// Dirty-check cache for AudioParam writes. `applyAllParams` runs on EVERY
// store change (subscribe firehose) — without this, dozens of setTargetAtTime
// calls per change saturate the audio thread on mid-range Android, causing
// crackles. We skip writes whose value hasn't meaningfully changed.
const lastParamValue = new WeakMap<AudioParam, number>();
function setP(param: AudioParam, value: number, tau: number) {
  if (!ctx) return;
  const prev = lastParamValue.get(param);
  // Relative epsilon: ~0.01% change tolerance, with a small absolute floor for
  // values near zero (gains, pan).
  if (prev !== undefined) {
    const diff = Math.abs(value - prev);
    const tol = Math.max(1e-5, Math.abs(prev) * 1e-4);
    if (diff < tol) return;
  }
  lastParamValue.set(param, value);
  param.setTargetAtTime(value, ctx.currentTime, tau);
}

export function applyAllParams() {
  if (!ctx) return;
  const t = ctx.currentTime;
  void t;
  const state = useGroove.getState();

  // parts
  state.parts.forEach((p) => {
    const chain = parts.get(p.id);
    if (!chain) return;
    const c: Channel = p.channel;
    setP(chain.hp.frequency, hpFreq(c.hpCut), 0.02);
    setP(chain.hp.Q, qFromRes(c.hpRes), 0.02);
    setP(chain.lp.frequency, lpFreq(c.lpCut), 0.02);
    setP(chain.lp.Q, qFromRes(c.lpRes), 0.02);

    // drive curve (rebuild only on change)
    const key = `${c.driveType}:${Math.round(c.drive)}`;
    if (lastDriveKey.get(p.id) !== key) {
      chain.drive.curve = makeDriveCurve(c.driveType, c.drive);
      lastDriveKey.set(p.id, key);
    }
    const wet = c.drive / 100;
    setP(chain.driveWet.gain, wet, 0.02);
    setP(chain.driveDry.gain, 1 - wet * 0.7, 0.02);

    setP(chain.eqLow.gain, c.eqLow, 0.02);
    setP(chain.eqMid.gain, c.eqMid, 0.02);
    setP(chain.eqHigh.gain, c.eqHigh, 0.02);
    setP(chain.outGain.gain, c.outGain / 100, 0.02);

    setP(chain.volume.gain, p.volume / 100, 0.02);
    setP(chain.pan.pan, Math.max(-1, Math.min(1, p.pan / 50)), 0.02);

    p.sends.forEach((s, i) => {
      const g = chain.sends[i];
      if (g) setP(g.gain, s / 100, 0.02);
    });
  });

  // FX
  state.fx.forEach((f, i) => {
    const bus = fxBuses[i];
    if (!bus) return;
    if (lastFxType.get(i) !== f.type) {
      attachFx(i, f.type, f.params);
      lastFxType.set(i, f.type);
    }
    bus.update?.(f.params, state.bpm);
    const wet = (f.mix / 100) * (f.bypass ? 0 : 1);
    setP(bus.wet.gain, wet, 0.02);
    const boostDb = (f.boost ?? 0) / 100 * 12;
    const boostLin = Math.pow(10, boostDb / 20);
    setP(bus.boost.gain, boostLin, 0.03);
  });

  // Master
  const m: MasterChannel = state.master;
  if (mEqLow && mEqMid && mEqHigh) {
    setP(mEqLow.gain, m.eqLow, 0.02);
    setP(mEqMid.gain, m.eqMid, 0.02);
    setP(mEqHigh.gain, m.eqHigh, 0.02);
  }
  if (widthMid && widthSide) {
    const w = m.width / 100;
    setP(widthMid.gain, 0.5, 0.02);
    setP(widthSide.gain, 0.5 * w, 0.02);
  }
  if (softClip) {
    softClip.curve = makeSoftClipCurve(m.softClip);
  }
  if (limiter) {
    limiter.threshold.value = m.limiter ? -1 : 0;
    limiter.ratio.value = m.limiter ? 20 : 1;
  }
  if (masterGain) {
    setP(masterGain.gain, state.masterVolume / 100, 0.01);
  }
}

// Subscribe to store changes → reapply params (cheap; AudioParam writes are idempotent)
let unsub: (() => void) | null = null;
export function bindParamUpdates() {
  if (unsub) return;
  // `applyAllParams` iterates ~220 AudioParams and dirty-checks each one.
  // The store subscribe fires on EVERY setState — including the ~20 Hz
  // playhead writes, meter/CPU updates and UI selection changes — none of
  // which touch audio parameters. Running the full iteration on those was
  // ~4400 wasted passes/sec on the main thread, competing with the
  // look-ahead scheduler and causing jitter that forces a larger lookAhead
  // (higher latency). Gate it: only run when an audio-relevant slice
  // actually changed reference. All audio setters replace these references
  // immutably, so reference equality is a correct change detector.
  unsub = useGroove.subscribe((s, prev) => {
    const audioChanged =
      s.parts !== prev.parts ||
      s.fx !== prev.fx ||
      s.master !== prev.master ||
      s.masterVolume !== prev.masterVolume ||
      s.bpm !== prev.bpm;
    if (ctx && audioChanged) applyAllParams();

    // ── FxMixLab bus routing ─────────────────────────────────────────────
    // Re-patch part dry→bus connections when assignments change.  Uses
    // numeric bus indices from the store — named FxMixLab bus IDs require
    // callers to pass an explicit busIdMap to applyFxMixLabRouting() directly.
    if (ctx && s.partBusAssignments !== prev.partBusAssignments) {
      Object.entries(s.partBusAssignments as Record<string, number | null>).forEach(
        ([pidStr, busIdx]) => { routePartMainToBus(Number(pidStr), busIdx); },
      );
    }
    if (ctx && s.busLevels !== prev.busLevels) {
      (s.busLevels as { volume: number; mute: boolean }[]).forEach((b, i) => {
        setBusChannelLevel(i, b.volume / 100, b.mute);
      });
    }

    if (s.transport.currentPattern !== prevPatternForCrossfade) {
      prevPatternForCrossfade = s.transport.currentPattern;
      crossfadePatternChange();
    }
  });
}

// ─── meter loop ─────────────────────────────────────────────────────────────
//
// Re-architected (perf audit, Phase: meter decoupling):
//
//   * Gated by AudioContext.currentTime — NOT performance.now / Date.now.
//     Audio metrics must reference the audio clock only.
//   * Update rate hard-capped to 10 Hz. The previous rAF-driven loop ran at
//     up to 60 Hz and was the dominant source of Zustand re-renders on
//     Android (observed avgFps = 11, frameTimeMs = 95 in idle).
//   * Per-part analyser is read only for parts that are (a) visible
//     (registered via setPartVisible from a mounted component) or
//     (b) active within the last ACTIVE_HOLD_SEC seconds.
//   * Per-FX analyser is skipped when the slot has no type, is bypassed,
//     or mix == 0. Bypassed slots publish silence so the UI shows -∞.
//   * Output goes to the non-React `meterBus`. Zustand is NOT written from
//     this loop anymore — that broke decoupling and forced rerenders on
//     every component subscribing to the store.

const METER_INTERVAL_SEC = 0.1; // 10 Hz, audio-clock gated
let lastMeterCtxTime = -1;

function startMeterLoop() {
  // Per-FX rolling floor – kept in module scope so we don't re-allocate.
  const fxFloorState: number[] = Array.from({ length: 6 }, () => -60);
  // Last-published per-part/per-fx peaks for ballistic decay between reads.
  let lastPartPeaks: number[] = Array.from({ length: 16 }, () => 0);
  let lastFxPeaks:   number[] = Array.from({ length: 6 },  () => 0);
  let lastFxRms:     number[] = Array.from({ length: 6 },  () => 0);
  let lastFxClip:    number[] = Array.from({ length: 6 },  () => 0);
  let lastPeakL = 0, lastPeakR = 0;

  const update = () => {
    if (!ctx || !analyserL || !analyserR || !meterBufL || !meterBufR) {
      requestAnimationFrame(update);
      return;
    }
    const ct = ctx.currentTime;
    if (ct - lastMeterCtxTime < METER_INTERVAL_SEC) {
      requestAnimationFrame(update);
      return;
    }
    lastMeterCtxTime = ct;

    // ── master L/R ────────────────────────────────────────────────
    analyserL.getFloatTimeDomainData(meterBufL);
    analyserR.getFloatTimeDomainData(meterBufR);
    let pL = 0, pR = 0;
    for (let i = 0; i < meterBufL.length; i++) {
      const a = Math.abs(meterBufL[i]); if (a > pL) pL = a;
      const b = Math.abs(meterBufR[i]); if (b > pR) pR = b;
    }
    // Ballistic decay at 10 Hz: faster coefficient than the 60 Hz loop.
    const nl = Math.max(pL, lastPeakL * 0.55);
    const nr = Math.max(pR, lastPeakR * 0.55);
    lastPeakL = nl; lastPeakR = nr;

    // ── per-part peaks: visible OR recently-active only ───────────
    const partPeaks = lastPartPeaks.slice();
    parts.forEach((chain, id) => {
      if (!isPartVisible(id) && !isPartActive(id, ct)) {
        // Decay frozen value toward zero so a part that just went idle
        // doesn't appear pinned when the user scrolls it back into view.
        partPeaks[id] = lastPartPeaks[id] * 0.5;
        return;
      }
      chain.analyser.getFloatTimeDomainData(chain.meterBuf);
      let pk = 0;
      for (let i = 0; i < chain.meterBuf.length; i++) {
        const a = Math.abs(chain.meterBuf[i]); if (a > pk) pk = a;
      }
      partPeaks[id] = Math.max(pk, lastPartPeaks[id] * 0.55);
    });
    lastPartPeaks = partPeaks;

    // ── per-FX peaks: active slots only ───────────────────────────
    const prevState = useGroove.getState();
    const SILENCE = 1e-5;
    const fxPeaks = lastFxPeaks.slice();
    const fxRms   = lastFxRms.slice();
    const fxClip  = lastFxClip.slice();
    const fxFloorDb = fxFloorState.slice();
    const nowMs = (typeof performance !== "undefined" ? performance.now() : Date.now());

    fxBuses.forEach((bus, i) => {
      const slot = prevState.fx[i];
      const slotActive = !!slot && slot.type !== null && !slot.bypass && slot.mix > 0;
      if (!slotActive) {
        // Snap to silence; auto-floor drifts back to default.
        fxPeaks[i] = 0;
        fxRms[i]   = 0;
        fxFloorDb[i] = fxFloorState[i] + (-60 - fxFloorState[i]) * 0.02;
        fxFloorState[i] = fxFloorDb[i];
        return;
      }
      bus.analyser.getFloatTimeDomainData(bus.meterBuf);
      let pk = 0, sum = 0;
      for (let j = 0; j < bus.meterBuf.length; j++) {
        const v = bus.meterBuf[j];
        const a = Math.abs(v);
        if (a > pk) pk = a;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / bus.meterBuf.length);
      if (pk < SILENCE) {
        fxPeaks[i] = 0;
        fxRms[i]   = 0;
      } else {
        fxPeaks[i] = Math.max(pk,  lastFxPeaks[i] * 0.55);
        fxRms[i]   = Math.max(rms, lastFxRms[i]   * 0.45);
      }
      if (pk >= 0.989) fxClip[i] = nowMs;

      // Auto floor calibration (unchanged logic, 10 Hz cadence)
      const prevFloor = fxFloorState[i];
      if (pk < SILENCE) {
        fxFloorDb[i] = prevFloor + (-60 - prevFloor) * 0.02;
      } else {
        const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
        const observed = Math.max(-90, Math.min(-40, rmsDb - 3));
        if (observed < prevFloor) {
          fxFloorDb[i] = observed;
        } else {
          // Slow upward drift (~1 dB/s at 10 Hz)
          fxFloorDb[i] = Math.min(-40, prevFloor + 0.1);
        }
      }
      fxFloorState[i] = fxFloorDb[i];
    });

    // Optional shared floor
    if (prevState.fxSharedFloor) {
      const shared = Math.min(...fxFloorDb);
      for (let i = 0; i < 6; i++) { fxFloorDb[i] = shared; fxFloorState[i] = shared; }
    }

    lastFxPeaks = fxPeaks;
    lastFxRms   = fxRms;
    lastFxClip  = fxClip;

    // ── limiter GR ────────────────────────────────────────────────
    const limiterReduction = limiter ? Math.abs(limiter.reduction) : 0;

    // ── single atomic publish to meterBus (no React re-renders for
    //    components that don't subscribe to the meter selectors). ──
    publishMeter({
      peakL: nl,
      peakR: nr,
      partPeaks,
      fxPeaks,
      fxRms,
      fxClip,
      fxFloorDb,
      limiterReduction,
      publishedAt: ct,
    });

    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
// Silence unused-import lint when consumers reference these elsewhere.
void getMeterSnapshot;


let prevPatternForCrossfade = useGroove.getState().transport.currentPattern;

/** Seamless pattern-boundary transition.
 *  Only the outgoing pattern's in-flight voice envelopes are faded (8 ms) so
 *  sustained voices and one-shot tails don't overlap the incoming pattern's
 *  first hits. The master bus is NOT ducked — the previous 35 ms master
 *  duck created an audible gap on every pattern switch and attenuated the
 *  new pattern's first transient. Incoming voices trigger at full level,
 *  giving a delay-free, click-free transition. Reverb/delay tails bleed
 *  naturally across the boundary (desirable, no hard cut). */
function crossfadePatternChange() {
  if (!ctx) return;
  const now = ctx.currentTime;
  voiceGainsByPart.forEach((gains) => {
    gains.forEach((vg) => {
      try {
        vg.gain.cancelScheduledValues(now);
        vg.gain.setValueAtTime(vg.gain.value, now);
        vg.gain.linearRampToValueAtTime(0.0001, now + 0.008);
      } catch { /* node already ended */ }
    });
  });
}

// ─── Anti-click transport helpers ──────────────────────────────────────────
// Master soft-fade on Play/Stop. Without these, stopping the scheduler while
// voices / reverb tails are sounding leaves a hard DC step at the limiter
// input — audible click especially on mobile speakers.

const FADE_IN_SEC = 0.020;
const FADE_OUT_SEC = 0.030;

/** Ramp master to user volume over FADE_IN_SEC. Resumes ctx if suspended. */
export async function softStart(): Promise<void> {
  const c = await ensureAudio();
  if (!masterGain) return;
  const target = useGroove.getState().masterVolume / 100;
  const now = c.currentTime;
  const g = masterGain.gain;

  // Snap any lingering per-voice gains to silence so the master ramp-up
  // doesn't reveal an in-flight tail with a click.
  voiceGainsByPart.forEach((gains) => {
    gains.forEach((vg) => {
      try {
        vg.gain.cancelScheduledValues(now);
        vg.gain.setValueAtTime(vg.gain.value, now);
        vg.gain.linearRampToValueAtTime(0.0001, now + 0.01);
      } catch { /* node already ended */ }
    });
  });

  g.cancelScheduledValues(now);
  g.setValueAtTime(0.0001, now);
  g.linearRampToValueAtTime(target, now + FADE_IN_SEC + 0.01);
}

/** Ramp master down, then optionally flush still-playing one-shot voices.
 *  Resolves after the fade so callers can sequence the actual scheduler stop. */
// ─── FxMixLab bus-routing integration ──────────────────────────────────────
//
// The engine owns six numbered FX buses (fxBuses[0..5]).  These map 1-to-1
// to the six FxSlot entries in the store, and each part has six matching
// send GainNodes (chain.sends[0..5]).
//
// The FxMixLab module provides a richer *named-bus* routing model
// (MixerChannel.busTarget, BusChannel.volume/pan/mute/solo).  The two
// functions below bridge that model to the engine's concrete graph:
//
//   applyFxMixLabRouting  — updates bus-level volume/mute from BusChannel
//                            data and re-patches part dry → bus or master.
//   routePartMainToBus    — imperatively re-patches a single part's dry
//                            signal to a numbered bus or back to master.
//   setBusChannelLevel    — adjust one bus's post-FX volume/mute in place.

/**
 * Map a bus-target string to a numbered engine bus index (0–5), or null for master.
 *
 * Resolution order:
 *   1. "master" or empty  → null
 *   2. busIdMap lookup    → explicit name→index binding (e.g. "bus_drums" → 2)
 *   3. Numeric string     → parseInt  ("3", "bus:3" → 3)
 *   4. No match           → null  (routes dry signal to master as safe fallback)
 *
 * @param busIdMap  Optional caller-provided name→index map for named bus IDs
 *                  produced by FxMixLab presets.  Without a map, named targets
 *                  that are not numeric fall back to master rather than resolving
 *                  to a wrong index.
 */
function busTargetToIndex(target: string, busIdMap: Record<string, number> = {}): number | null {
  if (!target || target === "master") return null;
  if (Object.prototype.hasOwnProperty.call(busIdMap, target)) {
    const mapped = busIdMap[target];
    return Number.isFinite(mapped) && mapped >= 0 && mapped < 6 ? Math.floor(mapped) : null;
  }
  const t = target.startsWith("bus:") ? target.slice(4) : target;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 6 ? Math.floor(n) : null;
}

/**
 * Apply FxMixLab routing data to the live audio graph.
 *
 * @param channels   Per-part routing entries (partId + busTarget string).
 *                   Absent entries keep their current routing.
 * @param buses      Per-bus level entries ({ idx, volume 0–100, mute }).
 * @param busIdMap   Optional explicit name→engine-index mapping for named bus
 *                   IDs produced by FxMixLab presets (e.g. {"bus_drums": 2}).
 *                   Numeric targets ("0".."5", "bus:0".."bus:5") are resolved
 *                   automatically without a map. Named targets with no map entry
 *                   fall back to master (safe default — never silently mismatch).
 *
 * Call this whenever the FxMixLab routing model changes (e.g. when the user
 * changes a part's bus assignment in MixTab or FxTab).
 */
export function applyFxMixLabRouting(
  channels: { partId: number; busTarget?: string }[],
  buses: { idx: number; volume: number; mute: boolean; solo?: boolean }[],
  busIdMap: Record<string, number> = {},
): void {
  if (!ctx || !masterIn) return;

  // 1. Per-part: re-patch dry output to the requested bus (or master).
  for (const ch of channels) {
    routePartMainToBus(
      ch.partId,
      ch.busTarget ? busTargetToIndex(ch.busTarget, busIdMap) : null,
    );
  }

  // 2. Per-bus: apply volume / mute to the bus wet gain.
  for (const b of buses) {
    setBusChannelLevel(b.idx, b.volume / 100, b.mute);
  }
}

/**
 * Route the *dry* (main) output of a part to a numbered FX bus, or back to
 * master when busIdx is null.
 *
 * The part's send-FX path (chain.sends[0..5]) is unchanged — only the dry
 * signal tap (chain.dry) is re-patched.  The change takes effect immediately
 * with no audio discontinuity (both the old and new targets are GainNodes
 * so the disconnect/connect happens at AudioNode granularity, not sample
 * granularity; any in-flight sample will tail naturally).
 */
export function routePartMainToBus(partId: number, busIdx: number | null): void {
  if (!ctx || !masterIn) return;
  const chain = parts.get(partId);
  if (!chain) return;

  // Disconnect from current target (harmless if already disconnected).
  try { chain.dry.disconnect(); } catch { /* noop */ }

  if (busIdx !== null && fxBuses[busIdx]) {
    chain.dry.connect(fxBuses[busIdx].input);
  } else {
    // Default: dry → masterIn (bypass bus entirely).
    chain.dry.connect(masterIn);
  }
}

/**
 * Set the post-FX output volume of one bus channel.
 *
 * @param busIdx       0-based index into fxBuses (0..5).
 * @param volumeLinear 0..1 gain (e.g. 0.85 for 85 % / −1.4 dBFS).
 * @param mute         When true, gain is forced to 0 regardless of volume.
 */
export function setBusChannelLevel(
  busIdx: number,
  volumeLinear: number,
  mute: boolean,
): void {
  const bus = fxBuses[busIdx];
  if (!bus || !ctx) return;
  const target = mute ? 0 : Math.max(0, Math.min(4, volumeLinear));
  // Write to the dedicated busLevel node — never to boost.
  // applyAllParams() only ever touches boost (FX perceptual-boost path),
  // so channel-level/mute values set here are stable across audio-param updates.
  bus.busLevel.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
}

export function softStop(flushVoices = true): Promise<void> {
  if (!ctx || !masterGain) return Promise.resolve();
  const now = ctx.currentTime;
  const g = masterGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      // Guard against a rapid Stop→Start: if the user resumed playback
      // while this fade-out was in flight, do NOT flush the new session's
      // voices. Only flush when transport is still stopped. Without this
      // guard, a sub-35 ms Stop→Start cycle would kill the new session's
      // voices via the stale softStop timeout (race condition fix).
      if (flushVoices && !useGroove.getState().transport.playing) {
        activeVoices.forEach((src) => { try { src.stop(); } catch { /* already stopped */ } });
        activeVoices.clear();
        voiceGainsByPart.forEach((set) => set.clear());
        useGroove.setState({ activeVoices: 0 });
      }
      resolve();
    }, FADE_OUT_SEC * 1000 + 5);
  });
}