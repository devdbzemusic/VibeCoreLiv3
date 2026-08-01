// VibeCore 3D Synth — Single Voice.
//
// One polyphonic voice with: 3 oscillators (OSC1/OSC2/SUB) + noise → mixer →
// 2 filters (serial/parallel) → amp envelope → spatial chain → chain.input.
//
// Modulation: 4 LFOs + 3 envelopes + velocity/aftertouch/keytrack/CC/macros/
// random/step-mod → modulation matrix → any destination AudioParam.
//
// Unison: multiple copies with detune/spread/phase offsets, summed into the
// spatial chain. Drift: a slow LFO modulates detune per unison copy.
//
// All DSP comes from the DSP Core (`@/lib/dsp`). No new DSP primitives.
//
// Realtime-safe: all nodes are created on the control thread at note-on.
// Envelope scheduling uses AudioParam methods (audio thread). Voice cleanup
// happens after the release tail completes (setTimeout, control thread).

import {
  createOsc, createWavetableOsc, createNoiseSource,
  createLP, createHP, createBP, createNotch,
  applyADSR, applyAHDSR,
  clamp, midiToFreq, lfoRateHz,
} from "@/lib/dsp";
import type { Rng } from "@/lib/utils/random";
import type {
  Synth3DParams, OscParams3D, FilterParams3D, ModRoute3D, ModDest3D,
} from "./params";

// Modulation destination ranges — max absolute offset for each destination.
const MOD_DEST_RANGE: Record<ModDest3D, number> = {
  osc1Pitch: 1200, osc2Pitch: 1200, subPitch: 1200,
  osc1Level: 1, osc2Level: 1, subLevel: 1, noiseLevel: 1,
  filter1Freq: 5000, filter1Q: 10, filter2Freq: 5000, filter2Q: 10,
  ampGain: 1, pan: 1, width: 2, azimuth: 1, elevation: 1, distance: 1,
  lfo1Rate: 20, lfo2Rate: 20, lfo3Rate: 20, lfo4Rate: 20,
};

export interface UnisonOffsets { detuneCents: number; pan: number; phase: number; }

export interface VoiceOpts3D {
  velocity: number;   // 0..127
  semitone: number;   // MIDI note offset (added to base pitch)
  gateSec: number;     // note duration before release
  aftertouch?: number;  // 0..1
  unisonIndex?: number;  // 0..count-1
  unisonCount?: number;
  /** Detune/pan/phase offsets for this unison copy (applied to all oscillators). */
  unisonOffsets?: UnisonOffsets;
  /** Current BPM — needed for BPM-synced LFO rates. */
  bpm?: number;
  /** Modulatable AudioParams from the per-part spatial chain (for mod matrix). */
  spatialModParams?: {
    width?: AudioParam;
    azimuth?: AudioParam;
    distance?: AudioParam;
    elevation?: AudioParam;
  };
}

export interface Synth3DSynthVoice {
  noteOff(when: number): void;
  kill(): void;
  steal(fadeSec: number): void;
  readonly stopTime: number;
}

/** Compute unison offsets for copy i of count, with given detune/spread/phase. */
export function computeUnisonOffsets(
  i: number, count: number, detune: number, spread: number, phaseRandom: boolean, rng: Rng,
): UnisonOffsets {
  if (count <= 1) return { detuneCents: 0, pan: 0, phase: 0 };
  const norm = (i / (count - 1)) - 0.5;  // -0.5..+0.5
  return {
    detuneCents: norm * 2 * detune,
    pan: norm * 2 * spread,
    phase: phaseRandom ? rng() : 0,
  };
}

/** Create an oscillator node from OscParams3D, tuned to the given base frequency. */
function createOscFromParams(
  ctx: BaseAudioContext, osc: OscParams3D, baseHz: number,
): { node: AudioNode; gain: GainNode } {
  const freq = baseHz * Math.pow(2, osc.octave + osc.semitone / 12);
  let src: AudioNode;
  if (osc.type === "noise") {
    src = createNoiseSource(ctx, "white");
  } else if (osc.type === "wavetable" && osc.wavetable.length > 0) {
    src = createWavetableOsc(ctx, osc.wavetable, Math.max(0.1, freq));
  } else {
    src = createOsc(ctx, osc.type === "sine" ? "sine" : osc.type === "saw" ? "sawtooth"
      : osc.type === "square" ? "square" : "triangle", Math.max(0.1, freq));
  }
  const gain = ctx.createGain();
  gain.gain.value = osc.enabled ? clamp(osc.level, 0, 1) : 0;
  src.connect(gain);
  // Apply fine detune (cents)
  if (osc.fine !== 0 && "detune" in src) {
    (src as OscillatorNode).detune.value = osc.fine;
  }
  return { node: src, gain };
}

/** Create a filter node from FilterParams3D. Returns null if disabled. */
function createFilterFromParams(
  ctx: BaseAudioContext, f: FilterParams3D,
): { input: AudioNode; output: AudioNode; freqParam: AudioParam; qParam: AudioParam } | null {
  if (!f.enabled) return null;
  switch (f.type) {
    case "lp": { const n = createLP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "hp": { const n = createHP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "bp": { const n = createBP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "notch": { const n = createNotch(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    // Comb and morph return multi-node structures; for the voice we use the
    // input/output nodes and expose the frequency via a wrapper. For simplicity,
    // fall back to a bandpass for comb/morph in the voice path (the main
    // filter types for synth voices are LP/HP/BP/Notch).
    default: { const n = createLP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
  }
}

/** Create a single 3D Synth voice (one unison copy). */
export function createVoice3D(
  ctx: AudioContext,
  spatialInput: AudioNode,
  params: Synth3DParams,
  when: number,
  opts: VoiceOpts3D,
  rng: Rng,
): Synth3DSynthVoice {
  const baseMidi = 60 + opts.semitone;
  const baseHz = midiToFreq(baseMidi);
  const vel = clamp(opts.velocity / 127, 0, 1);
  const gate = Math.max(0.05, opts.gateSec);

  // ── Collect all nodes for cleanup ──────────────────────────────────────
  const oscs: OscillatorNode[] = [];
  const noiseSrcs: AudioBufferSourceNode[] = [];
  const allGains: GainNode[] = [];
  const constSources: ConstantSourceNode[] = [];
  let stopTime = when + gate + params.ampEnv.release + 0.2;

  // ── Oscillators + noise → mixer ────────────────────────────────────────
  const mixerOut = ctx.createGain();
  mixerOut.gain.value = 1;
  allGains.push(mixerOut);

  const noiseGain: GainNode = ctx.createGain();
  noiseGain.gain.value = clamp(params.noise.level, 0, 1);
  allGains.push(noiseGain);

  // Per-osc pan
  const panNodes: StereoPannerNode[] = [];
  // Track each oscillator separately for modulation routing
  const mainOscs: OscillatorNode[] = [];
  let osc1Node: OscillatorNode | AudioBufferSourceNode | null = null;
  let osc2Node: OscillatorNode | AudioBufferSourceNode | null = null;
  let subNode: OscillatorNode | AudioBufferSourceNode | null = null;
  let osc1Gain: GainNode | null = null;
  let osc2Gain: GainNode | null = null;
  let subGain: GainNode | null = null;

  function addOsc(osc: OscParams3D, dest: AudioNode): { node: AudioNode; gain: GainNode } {
    const { node, gain } = createOscFromParams(ctx, osc, baseHz);
    allGains.push(gain);
    const pan = ctx.createStereoPanner();
    // Apply unison pan offset (stereo spread across copies)
    pan.pan.value = clamp(osc.pan + (opts.unisonOffsets?.pan ?? 0), -1, 1);
    panNodes.push(pan);
    gain.connect(pan);
    pan.connect(dest);
    if (node instanceof OscillatorNode) {
      // Apply unison detune offset (cents) on top of osc.fine
      if (opts.unisonOffsets && opts.unisonOffsets.detuneCents !== 0) {
        node.detune.value = (node.detune.value ?? 0) + opts.unisonOffsets.detuneCents;
      }
      oscs.push(node);
      mainOscs.push(node);
      node.start(when);
    } else if (node instanceof AudioBufferSourceNode) {
      noiseSrcs.push(node);
      node.start(when);
    }
    return { node, gain };
  }

  if (params.osc1.enabled) { const r = addOsc(params.osc1, mixerOut); osc1Node = r.node as OscillatorNode; osc1Gain = r.gain; }
  if (params.osc2.enabled) { const r = addOsc(params.osc2, mixerOut); osc2Node = r.node as OscillatorNode; osc2Gain = r.gain; }
  if (params.sub.enabled) { const r = addOsc(params.sub, mixerOut); subNode = r.node as OscillatorNode; subGain = r.gain; }
  if (params.noise.level > 0) {
    const ns = createNoiseSource(ctx, params.noise.type);
    noiseSrcs.push(ns);
    ns.connect(noiseGain);
    noiseGain.connect(mixerOut);
    ns.start(when);
  }

  // ── Filters (serial or parallel) ───────────────────────────────────────
  const filter1 = createFilterFromParams(ctx, params.filter1);
  const filter2 = createFilterFromParams(ctx, params.filter2);

  let preAmp: AudioNode = mixerOut;
  let filter1Freq: AudioParam | null = null;
  let filter1Q: AudioParam | null = null;
  let filter2Freq: AudioParam | null = null;
  let filter2Q: AudioParam | null = null;

  if (filter1 && filter2 && params.filterRouting === "parallel") {
    const sum = ctx.createGain();
    allGains.push(sum);
    mixerOut.connect(filter1.input);
    mixerOut.connect(filter2.input);
    filter1.output.connect(sum);
    filter2.output.connect(sum);
    preAmp = sum;
    filter1Freq = filter1.freqParam;
    filter1Q = filter1.qParam;
    filter2Freq = filter2.freqParam;
    filter2Q = filter2.qParam;
  } else if (filter1) {
    mixerOut.connect(filter1.input);
    preAmp = filter1.output;
    filter1Freq = filter1.freqParam;
    filter1Q = filter1.qParam;
    if (filter2) {
      filter1.output.connect(filter2.input);
      preAmp = filter2.output;
      filter2Freq = filter2.freqParam;
      filter2Q = filter2.qParam;
    }
  } else if (filter2) {
    mixerOut.connect(filter2.input);
    preAmp = filter2.output;
    filter2Freq = filter2.freqParam;
    filter2Q = filter2.qParam;
  }

  // ── Amp envelope → postAmp → spatial chain ─────────────────────────────
  const ampEnv = ctx.createGain();
  ampEnv.gain.value = 0.0001;
  allGains.push(ampEnv);
  preAmp.connect(ampEnv);

  const postAmp = ctx.createGain();
  postAmp.gain.value = 1;
  allGains.push(postAmp);
  ampEnv.connect(postAmp);
  postAmp.connect(spatialInput);

  // Schedule amp envelope (velocity scales the peak)
  const ampPeak = vel;
  if (params.ampEnv.type === "ahdsr") {
    applyAHDSR(ampEnv.gain, when, gate, {
      attack: params.ampEnv.attack, hold: params.ampEnv.hold,
      decay: params.ampEnv.decay, sustain: params.ampEnv.sustain,
      release: params.ampEnv.release, peak: ampPeak,
    });
  } else {
    applyADSR(ampEnv.gain, when, gate, {
      attack: params.ampEnv.attack, decay: params.ampEnv.decay,
      sustain: params.ampEnv.sustain, release: params.ampEnv.release, peak: ampPeak,
    });
  }

  // ── Filter envelope → filter frequency offset ───────────────────────────
  const filterEnvGain = ctx.createGain();
  filterEnvGain.gain.value = 0.0001;
  allGains.push(filterEnvGain);
  const filterEnvRange = ctx.createGain();
  filterEnvRange.gain.value = params.filterEnvAmount * 3000; // Hz offset range
  allGains.push(filterEnvRange);
  filterEnvGain.connect(filterEnvRange);
  if (filter1Freq) filterEnvRange.connect(filter1Freq);

  if (params.filterEnv.type === "ahdsr") {
    applyAHDSR(filterEnvGain.gain, when, gate, {
      attack: params.filterEnv.attack, hold: params.filterEnv.hold,
      decay: params.filterEnv.decay, sustain: params.filterEnv.sustain,
      release: params.filterEnv.release, peak: 1,
    });
  } else {
    applyADSR(filterEnvGain.gain, when, gate, {
      attack: params.filterEnv.attack, decay: params.filterEnv.decay,
      sustain: params.filterEnv.sustain, release: params.filterEnv.release, peak: 1,
    });
  }

  // ── Mod envelope (for general modulation) ────────────────────────────────
  const modEnvGain = ctx.createGain();
  modEnvGain.gain.value = 0.0001;
  allGains.push(modEnvGain);
  if (params.modEnv.type === "ahdsr") {
    applyAHDSR(modEnvGain.gain, when, gate, {
      attack: params.modEnv.attack, hold: params.modEnv.hold,
      decay: params.modEnv.decay, sustain: params.modEnv.sustain,
      release: params.modEnv.release, peak: 1,
    });
  } else {
    applyADSR(modEnvGain.gain, when, gate, {
      attack: params.modEnv.attack, decay: params.modEnv.decay,
      sustain: params.modEnv.sustain, release: params.modEnv.release, peak: 1,
    });
  }

  // ── Source nodes for modulation matrix ─────────────────────────────────
  // Map source names to their output AudioNodes (for connecting to dests)
  const sourceNodes: Partial<Record<string, AudioNode>> = {
    ENV1: ampEnv,
    ENV2: filterEnvGain,
    ENV3: modEnvGain,
  };

  // Velocity, Aftertouch, Keytrack as ConstantSources
  const velSrc = ctx.createConstantSource();
  velSrc.offset.value = vel;
  velSrc.start(when);
  constSources.push(velSrc);
  sourceNodes.Velocity = velSrc;

  const atSrc = ctx.createConstantSource();
  atSrc.offset.value = clamp(opts.aftertouch ?? 0, 0, 1);
  atSrc.start(when);
  constSources.push(atSrc);
  sourceNodes.Aftertouch = atSrc;

  const ktSrc = ctx.createConstantSource();
  ktSrc.offset.value = clamp((baseMidi - 60) / 60, -1, 1);
  ktSrc.start(when);
  constSources.push(ktSrc);
  sourceNodes.Keytrack = ktSrc;

  // Macros (8) — read from per-part params (source of truth for UI)
  for (let m = 0; m < 8; m++) {
    const mSrc = ctx.createConstantSource();
    mSrc.offset.value = params.macros[m]?.value ?? 0.5;
    mSrc.start(when);
    constSources.push(mSrc);
    sourceNodes[`Macro${m + 1}`] = mSrc;
  }

  // CC sources (4) — default 0
  for (let c = 0; c < 4; c++) {
    const ccSrc = ctx.createConstantSource();
    ccSrc.offset.value = 0;
    ccSrc.start(when);
    constSources.push(ccSrc);
    sourceNodes[`CC${c + 1}`] = ccSrc;
  }

  // Random source — seeded
  const randSrc = ctx.createConstantSource();
  randSrc.offset.value = rng() * 2 - 1;
  randSrc.start(when);
  constSources.push(randSrc);
  sourceNodes.Random = randSrc;

  // StepMod source — default 0
  const stepSrc = ctx.createConstantSource();
  stepSrc.offset.value = 0;
  stepSrc.start(when);
  constSources.push(stepSrc);
  sourceNodes.StepMod = stepSrc;

  // ── Destination AudioParams ─────────────────────────────────────────────
  const destParams: Partial<Record<ModDest3D, AudioParam>> = {
    osc1Pitch: osc1Node && "detune" in osc1Node ? (osc1Node as OscillatorNode).detune : undefined,
    osc2Pitch: osc2Node && "detune" in osc2Node ? (osc2Node as OscillatorNode).detune : undefined,
    subPitch: subNode && "detune" in subNode ? (subNode as OscillatorNode).detune : undefined,
    osc1Level: osc1Gain?.gain,
    osc2Level: osc2Gain?.gain,
    subLevel: subGain?.gain,
    noiseLevel: noiseGain.gain,
    filter1Freq: filter1Freq ?? undefined,
    filter1Q: filter1Q ?? undefined,
    filter2Freq: filter2Freq ?? undefined,
    filter2Q: filter2Q ?? undefined,
    ampGain: postAmp.gain,
    pan: panNodes[0]?.pan,
    width: opts.spatialModParams?.width,
    azimuth: opts.spatialModParams?.azimuth,
    elevation: opts.spatialModParams?.elevation,
    distance: opts.spatialModParams?.distance,
    lfo1Rate: undefined,  // LFO rates set below if LFOs exist
    lfo2Rate: undefined,
    lfo3Rate: undefined,
    lfo4Rate: undefined,
  };

  // ── LFOs (4) ────────────────────────────────────────────────────────────
  let lfoRateParams: AudioParam[] = [];
  for (let li = 0; li < params.lfos.length && li < 4; li++) {
    const lp = params.lfos[li];
    if (!lp.enabled) continue;
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = lp.waveform === "sine" ? "sine"
      : lp.waveform === "triangle" ? "triangle"
      : lp.waveform === "saw" ? "sawtooth" : "square";
    // Rate: free-run or BPM-synced via DSP Core's lfoRateHz
    const rateHz = lp.syncDiv !== "off" && opts.bpm
      ? lfoRateHz({ waveform: "sine", rate: lp.rate, depth: 1, syncDiv: lp.syncDiv as Exclude<typeof lp.syncDiv, "off">, bpm: opts.bpm })
      : clamp(lp.rate, 0.01, 20);
    lfoOsc.frequency.value = rateHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lp.depth;
    lfoOsc.connect(lfoGain);
    lfoOsc.start(when);
    oscs.push(lfoOsc);
    allGains.push(lfoGain);
    sourceNodes[`LFO${li + 1}`] = lfoGain;
    destParams[`lfo${li + 1}Rate` as ModDest3D] = lfoOsc.frequency;
    lfoRateParams.push(lfoOsc.frequency);
  }

  // ── Modulation matrix: connect sources → amount gains → dests ──────────
  for (const route of params.modRoutes) {
    const src = sourceNodes[route.source];
    const dest = destParams[route.dest];
    if (!src || !dest) continue;
    const amountGain = ctx.createGain();
    const range = MOD_DEST_RANGE[route.dest] ?? 1;
    amountGain.gain.value = route.amount * range;
    allGains.push(amountGain);
    src.connect(amountGain);
    amountGain.connect(dest);
  }

  // ── Unison drift: slow LFO on detune ───────────────────────────────────
  if (params.unison.enabled && params.unison.drift > 0) {
    const driftOsc = ctx.createOscillator();
    driftOsc.type = "sine";
    driftOsc.frequency.value = clamp(params.unison.drift, 0.01, 5);
    const driftGain = ctx.createGain();
    driftGain.gain.value = params.unison.detune * 0.3;
    driftOsc.connect(driftGain);
    driftOsc.start(when);
    oscs.push(driftOsc);
    allGains.push(driftGain);
    // Apply drift to main oscillators' detune (not LFOs)
    for (const osc of mainOscs) {
      if ("detune" in osc) driftGain.connect(osc.detune);
    }
  }

  // ── Note-off / kill / steal ─────────────────────────────────────────────
  let released = false;

  function noteOff(whenOff: number): void {
    if (released) return;
    released = true;
    stopTime = whenOff + params.ampEnv.release + 0.1;
    // The amp envelope release is already scheduled by applyADSR (noteOff = when + gate).
    // For explicit note-off before gate, we'd reschedule — but the sequencer
    // uses gateSec, so the release is pre-scheduled. Just mark for cleanup.
    scheduleCleanup(whenOff + params.ampEnv.release + 0.2);
  }

  function scheduleCleanup(after: number): void {
    const delayMs = Math.max(50, (after - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
      noiseSrcs.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
      constSources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
      allGains.forEach((g) => { try { g.disconnect(); } catch { /* already disconnected */ } });
      panNodes.forEach((p) => { try { p.disconnect(); } catch { /* already disconnected */ } });
    }, delayMs + 50);
  }

  function kill(): void {
    oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
    noiseSrcs.forEach((n) => { try { n.stop(); } catch { /* noop */ } });
    constSources.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
    allGains.forEach((g) => { try { g.disconnect(); } catch { /* noop */ } });
    panNodes.forEach((p) => { try { p.disconnect(); } catch { /* noop */ } });
  }

  function steal(fadeSec: number): void {
    const now = ctx.currentTime;
    ampEnv.gain.cancelScheduledValues(now);
    ampEnv.gain.setValueAtTime(ampEnv.gain.value, now);
    ampEnv.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    scheduleCleanup(now + fadeSec + 0.05);
  }

  // Schedule initial cleanup after the full note duration
  scheduleCleanup(when + gate + params.ampEnv.release + 0.2);

  return { noteOff, kill, steal, stopTime };
}