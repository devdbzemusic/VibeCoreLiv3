// VibeCore 3D Bass — Single Voice.
//
// Bass-optimized signal flow:
//   OSC (saw/square/tri/sine + sub + noise) → Mixer
//   → Bass Compensation (low-shelf) → Filter (LP/HP/BP/Notch, serial/parallel)
//   → [HP protect if bassStable] → Drive (saturation/tube/tape/softclip/foldback/drive)
//   → Dynamics (compressor → limiter → bass punch)
//   → Amp Envelope (ADSR/AHDSR)
//   → Mono-Compat Split:
//       Sub: LP(crossover) → stereoToMono → chainInput (direct, mono)
//       Harmonic: HP(crossover) → spatialInput (→ spatial chain → chainInput)
//
// Modulation: 4 LFOs + 3 envelopes + velocity/aftertouch/keytrack/CC/macros/
// random/step-mod → modulation matrix → any destination AudioParam (incl. bass-
// specific: driveAmount, compThreshold, bassPunch, monoCrossover, acidResonance).
//
// All DSP from `@/lib/dsp`. No new DSP primitives. Realtime-safe: all nodes
// created on the control thread at note-on; envelope scheduling uses AudioParam
// methods (audio thread); cleanup after release tail (setTimeout, control thread).

import {
  createOsc, createNoiseSource,
  createLP, createHP, createBP, createNotch,
  createDistortion,
  createCompressor, createLimiter,
  createStereoToMono, createMonoToStereo,
  applyADSR, applyAHDSR,
  clamp, midiToFreq, lfoRateHz, dbToLin,
} from "@/lib/dsp";
import type { Rng } from "@/lib/utils/random";
import type {
  Bass3DParams, OscParams3D, FilterParams3D, ModRouteBass, ModDestBass,
} from "./params";
import type { UnisonOffsets, VoiceOpts3D } from "@/lib/synth3d/voice";

// Modulation destination ranges — max absolute offset for each destination.
const BASS_MOD_DEST_RANGE: Record<string, number> = {
  osc1Pitch: 1200, osc2Pitch: 1200, subPitch: 1200,
  osc1Level: 1, osc2Level: 1, subLevel: 1, noiseLevel: 1,
  filter1Freq: 5000, filter1Q: 10, filter2Freq: 5000, filter2Q: 10,
  ampGain: 1, pan: 1, width: 2, azimuth: 1, elevation: 1, distance: 1,
  lfo1Rate: 20, lfo2Rate: 20, lfo3Rate: 20, lfo4Rate: 20,
  driveAmount: 12, compThreshold: 60, bassPunch: 1, monoCrossover: 200, acidResonance: 1,
};

export interface Bass3DVoice {
  noteOff(when: number): void;
  kill(): void;
  steal(fadeSec: number): void;
  rePitch(newSemitone: number, glideTime: number, when: number): void;
  extendGate(newNoteOffTime: number, when: number): void;
  readonly stopTime: number;
}

/** Create an oscillator from OscParams3D, tuned to the given base frequency. */
function createOscFromParams(
  ctx: BaseAudioContext, osc: OscParams3D, baseHz: number,
): { node: AudioNode; gain: GainNode } {
  const freq = baseHz * Math.pow(2, osc.octave + osc.semitone / 12);
  let src: AudioNode;
  if (osc.type === "noise") {
    src = createNoiseSource(ctx, "white");
  } else if (osc.type === "wavetable" && osc.wavetable.length > 0) {
    // Use createOsc with sawtooth as fallback for wavetable in bass (bass doesn't
    // typically use wavetables; the harmonic content comes from the filter + drive)
    src = createOsc(ctx, "sawtooth", Math.max(0.1, freq));
  } else {
    src = createOsc(
      ctx,
      osc.type === "sine" ? "sine" : osc.type === "saw" ? "sawtooth"
        : osc.type === "square" ? "square" : "triangle",
      Math.max(0.1, freq),
    );
  }
  const gain = ctx.createGain();
  gain.gain.value = osc.enabled ? clamp(osc.level, 0, 1) : 0;
  src.connect(gain);
  if (osc.fine !== 0 && "detune" in src) {
    (src as OscillatorNode).detune.value = osc.fine;
  }
  return { node: src, gain };
}

/** Create a filter from FilterParams3D. Returns null if disabled. */
function createFilterFromParams(
  ctx: BaseAudioContext, f: FilterParams3D,
): { input: AudioNode; output: AudioNode; freqParam: AudioParam; qParam: AudioParam } | null {
  if (!f.enabled) return null;
  switch (f.type) {
    case "lp": { const n = createLP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "hp": { const n = createHP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "bp": { const n = createBP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    case "notch": { const n = createNotch(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
    // Comb/Morph: fall back to LP for the voice path (main bass filter types are LP/HP/BP/Notch)
    default: { const n = createLP(ctx, { frequency: f.freq, q: f.q }); return { input: n, output: n, freqParam: n.frequency, qParam: n.Q }; }
  }
}

/** Create a single 3D Bass voice (one unison copy). */
export function createVoice3DBass(
  ctx: AudioContext,
  spatialInput: AudioNode,   // harmonic path → spatial chain
  directOutput: AudioNode,    // mono sub path → chain.input (bypasses spatial)
  params: Bass3DParams,
  when: number,
  opts: VoiceOpts3D,
  rng: Rng,
): Bass3DVoice {
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

  const panNodes: StereoPannerNode[] = [];
  const mainOscs: OscillatorNode[] = [];
  let osc1Node: OscillatorNode | null = null;
  let osc2Node: OscillatorNode | null = null;
  let subNode: OscillatorNode | null = null;
  let osc1Gain: GainNode | null = null;
  let osc2Gain: GainNode | null = null;
  let subGain: GainNode | null = null;

  function addOsc(osc: OscParams3D, dest: AudioNode): { node: AudioNode; gain: GainNode } {
    const { node, gain } = createOscFromParams(ctx, osc, baseHz);
    allGains.push(gain);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(osc.pan + (opts.unisonOffsets?.pan ?? 0), -1, 1);
    panNodes.push(pan);
    gain.connect(pan);
    pan.connect(dest);
    if (node instanceof OscillatorNode) {
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

  // ── Bass Compensation: low-shelf boost before filter ─────────────────────
  let preFilter: AudioNode = mixerOut;
  if (params.bassCompensation > 0) {
    const bassComp = ctx.createBiquadFilter();
    bassComp.type = "lowshelf";
    bassComp.frequency.value = 120;
    bassComp.gain.value = params.bassCompensation * 6; // up to +6 dB
    mixerOut.connect(bassComp);
    preFilter = bassComp;
  }

  // ── Filters (serial or parallel) with acid resonance ─────────────────────
  // Acid resonance: boost filter1 Q beyond the base value
  const f1Params = params.filter1.enabled
    ? { ...params.filter1, q: params.filter1.q + params.acidResonance * 15 }
    : params.filter1;
  const filter1 = createFilterFromParams(ctx, f1Params);
  const filter2 = createFilterFromParams(ctx, params.filter2);

  let preDrive: AudioNode = preFilter;
  let filter1Freq: AudioParam | null = null;
  let filter1Q: AudioParam | null = null;
  let filter2Freq: AudioParam | null = null;
  let filter2Q: AudioParam | null = null;

  if (filter1 && filter2 && params.filterRouting === "parallel") {
    const sum = ctx.createGain();
    allGains.push(sum);
    preFilter.connect(filter1.input);
    preFilter.connect(filter2.input);
    filter1.output.connect(sum);
    filter2.output.connect(sum);
    preDrive = sum;
    filter1Freq = filter1.freqParam;
    filter1Q = filter1.qParam;
    filter2Freq = filter2.freqParam;
    filter2Q = filter2.qParam;
  } else if (filter1) {
    preFilter.connect(filter1.input);
    preDrive = filter1.output;
    filter1Freq = filter1.freqParam;
    filter1Q = filter1.qParam;
    if (filter2) {
      filter1.output.connect(filter2.input);
      preDrive = filter2.output;
      filter2Freq = filter2.freqParam;
      filter2Q = filter2.qParam;
    }
  } else if (filter2) {
    preFilter.connect(filter2.input);
    preDrive = filter2.output;
    filter2Freq = filter2.freqParam;
    filter2Q = filter2.qParam;
  }

  // ── Bass-stable HP: protect sub from drive intermodulation ────────────────
  let driveInput: AudioNode = preDrive;
  if (params.drive.enabled && params.drive.bassStable) {
    const protectHP = createHP(ctx, { frequency: 80, q: 0.7 });
    preDrive.connect(protectHP);
    driveInput = protectHP;
  }

  // ── Drive section ──────────────────────────────────────────────────────────
  let postDrive: AudioNode = driveInput;
  let driveInputGain: GainNode | null = null;
  if (params.drive.enabled) {
    const drive = createDistortion(ctx, {
      type: params.drive.type,
      amount: params.drive.amount,
      preGain: params.drive.preGain,
      postGain: params.drive.postGain,
      oversample: "2x",
    });
    // Add a modulation gain before the drive for driveAmount modulation
    driveInputGain = ctx.createGain();
    driveInputGain.gain.value = 1;
    allGains.push(driveInputGain);
    driveInput.connect(driveInputGain);
    driveInputGain.connect(drive.input);
    postDrive = drive.output;
  }

  // ── Dynamics: compressor → limiter → bass punch ───────────────────────────
  let postDynamics: AudioNode = postDrive;

  // Compressor
  if (params.dynamics.compressor.enabled) {
    const comp = createCompressor(ctx, {
      threshold: params.dynamics.compressor.threshold,
      knee: 6,
      ratio: params.dynamics.compressor.ratio,
      attack: params.dynamics.compressor.attack,
      release: params.dynamics.compressor.release,
      makeup: params.dynamics.compressor.makeup,
    });
    postDrive.connect(comp.input);
    postDynamics = comp.output;
  }

  // Limiter
  if (params.dynamics.limiter.enabled) {
    const lim = createLimiter(ctx, {
      threshold: params.dynamics.limiter.threshold,
      release: params.dynamics.limiter.release,
    });
    postDynamics.connect(lim);
    postDynamics = lim;
  }

  // Bass Punch: transient gain boost at note-on
  const punchGain = ctx.createGain();
  punchGain.gain.value = 1;
  allGains.push(punchGain);
  postDynamics.connect(punchGain);
  if (params.dynamics.bassPunch.enabled && params.dynamics.bassPunch.amount > 0) {
    const p = params.dynamics.bassPunch;
    punchGain.gain.setValueAtTime(1, when);
    punchGain.gain.linearRampToValueAtTime(1 + p.amount, when + Math.max(0.0005, p.attack));
    punchGain.gain.exponentialRampToValueAtTime(1.001, when + p.attack + p.release);
  }

  // ── Amp envelope ───────────────────────────────────────────────────────────
  const ampEnv = ctx.createGain();
  ampEnv.gain.value = 0.0001;
  allGains.push(ampEnv);
  punchGain.connect(ampEnv);

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

  // ── Mono-Compat Split: sub (mono) + harmonic (spatial) ──────────────────────
  const crossFreq = clamp(params.spatial.monoCrossover, 20, 500);

  if (params.spatial.monoEnabled) {
    // REVIEW FIX R1: Phase-coherent crossover. A 2nd-order Butterworth (Q=0.707)
    // at identical LP/HP frequencies creates 180° phase shift at fc → complete
    // signal cancellation (notch to -∞ at exactly fc). Fix: offset HP 1.3× above
    // LP and use Q=0.5 (Linkwitz-Riley) for a smooth transition band where both
    // filters overlap without phase cancellation. The sub path still guarantees
    // mono compatibility via stereoToMono — the offset only affects the crossover
    // transition slope, not the mono guarantee.
    const lpFreq = crossFreq;
    const hpFreq = crossFreq * 1.3;

    // Sub path: LP(crossover) → stereoToMono → directOutput (mono, bypasses spatial)
    const subLP = createLP(ctx, { frequency: lpFreq, q: 0.5 });
    const subMono = createStereoToMono(ctx);
    const subStereo = createMonoToStereo(ctx);
    ampEnv.connect(subLP);
    subLP.connect(subMono.input);
    subMono.output.connect(subStereo.input);
    subStereo.output.connect(directOutput);

    // Harmonic path: HP(crossover) → spatialInput (→ spatial chain → directOutput)
    const harmHP = createHP(ctx, { frequency: hpFreq, q: 0.5 });
    ampEnv.connect(harmHP);
    harmHP.connect(spatialInput);
  } else {
    // No mono split — full signal goes through spatial chain
    ampEnv.connect(spatialInput);
  }

  // ── Filter envelope → filter frequency offset ───────────────────────────────
  const filterEnvGain = ctx.createGain();
  filterEnvGain.gain.value = 0.0001;
  allGains.push(filterEnvGain);
  const filterEnvRange = ctx.createGain();
  filterEnvRange.gain.value = params.filterEnvAmount * 3000;
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

  // ── Mod envelope ────────────────────────────────────────────────────────────
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

  // ── Source nodes for modulation matrix ───────────────────────────────────
  const sourceNodes: Partial<Record<string, AudioNode>> = {
    ENV1: ampEnv,
    ENV2: filterEnvGain,
    ENV3: modEnvGain,
  };

  // Velocity, Aftertouch, Keytrack
  const velSrc = ctx.createConstantSource();
  velSrc.offset.value = vel;
  velSrc.start(when); constSources.push(velSrc); sourceNodes.Velocity = velSrc;

  const atSrc = ctx.createConstantSource();
  atSrc.offset.value = clamp(opts.aftertouch ?? 0, 0, 1);
  atSrc.start(when); constSources.push(atSrc); sourceNodes.Aftertouch = atSrc;

  const ktSrc = ctx.createConstantSource();
  ktSrc.offset.value = clamp((baseMidi - 60) / 60, -1, 1);
  ktSrc.start(when); constSources.push(ktSrc); sourceNodes.Keytrack = ktSrc;

  // Macros (8) — per-part from params
  for (let m = 0; m < 8; m++) {
    const mSrc = ctx.createConstantSource();
    mSrc.offset.value = params.macros[m]?.value ?? 0.5;
    mSrc.start(when); constSources.push(mSrc);
    sourceNodes[`Macro${m + 1}`] = mSrc;
  }

  // CC sources (4)
  for (let c = 0; c < 4; c++) {
    const ccSrc = ctx.createConstantSource();
    ccSrc.offset.value = 0;
    ccSrc.start(when); constSources.push(ccSrc);
    sourceNodes[`CC${c + 1}`] = ccSrc;
  }

  // Random + StepMod
  const randSrc = ctx.createConstantSource();
  randSrc.offset.value = rng() * 2 - 1;
  randSrc.start(when); constSources.push(randSrc); sourceNodes.Random = randSrc;

  const stepSrc = ctx.createConstantSource();
  stepSrc.offset.value = 0;
  stepSrc.start(when); constSources.push(stepSrc); sourceNodes.StepMod = stepSrc;

  // ── Destination AudioParams (incl. bass-specific) ────────────────────────
  const destParams: Partial<Record<string, AudioParam>> = {
    osc1Pitch: osc1Node?.detune,
    osc2Pitch: osc2Node?.detune,
    subPitch: subNode?.detune,
    osc1Level: osc1Gain?.gain,
    osc2Level: osc2Gain?.gain,
    subLevel: subGain?.gain,
    noiseLevel: noiseGain.gain,
    filter1Freq: filter1Freq ?? undefined,
    filter1Q: filter1Q ?? undefined,
    filter2Freq: filter2Freq ?? undefined,
    filter2Q: filter2Q ?? undefined,
    ampGain: ampEnv.gain,
    pan: panNodes[0]?.pan,
    width: opts.spatialModParams?.width,
    azimuth: opts.spatialModParams?.azimuth,
    elevation: opts.spatialModParams?.elevation,
    distance: opts.spatialModParams?.distance,
    driveAmount: driveInputGain?.gain,
    compThreshold: undefined, // set below if compressor enabled
    bassPunch: punchGain.gain,
    acidResonance: filter1Q ?? undefined,
  };

  // ── LFOs (4) — BPM-synced via lfoRateHz ──────────────────────────────────
  for (let li = 0; li < params.lfos.length && li < 4; li++) {
    const lp = params.lfos[li];
    if (!lp.enabled) continue;
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = lp.waveform === "sine" ? "sine"
      : lp.waveform === "triangle" ? "triangle"
      : lp.waveform === "saw" ? "sawtooth" : "square";
    const rateHz = lp.syncDiv !== "off" && opts.bpm
      ? lfoRateHz({ rate: lp.rate, syncDiv: lp.syncDiv, bpm: opts.bpm })
      : clamp(lp.rate, 0.01, 20);
    lfoOsc.frequency.value = rateHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lp.depth;
    lfoOsc.connect(lfoGain);
    lfoOsc.start(when);
    oscs.push(lfoOsc);
    allGains.push(lfoGain);
    sourceNodes[`LFO${li + 1}`] = lfoGain;
    destParams[`lfo${li + 1}Rate`] = lfoOsc.frequency;
  }

  // ── Modulation matrix ──────────────────────────────────────────────────────
  for (const route of params.modRoutes) {
    const src = sourceNodes[route.source];
    const dest = destParams[route.dest as string];
    if (!src || !dest) continue;
    const amountGain = ctx.createGain();
    const range = BASS_MOD_DEST_RANGE[route.dest as string] ?? 1;
    amountGain.gain.value = route.amount * range;
    allGains.push(amountGain);
    src.connect(amountGain);
    amountGain.connect(dest);
  }

  // ── Unison drift: slow LFO on detune ───────────────────────────────────────
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
    for (const osc of mainOscs) {
      if ("detune" in osc) driftGain.connect(osc.detune);
    }
  }

  // ── Note-off / kill / steal ─────────────────────────────────────────────────
  let released = false;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  const sustainLevel = Math.max(0.0001, params.ampEnv.sustain * vel);

  function scheduleCleanup(after: number): void {
    if (cleanupTimer !== null) { clearTimeout(cleanupTimer); cleanupTimer = null; }
    const delayMs = Math.max(50, (after - ctx.currentTime) * 1000);
    cleanupTimer = setTimeout(() => {
      oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
      noiseSrcs.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
      constSources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
      allGains.forEach((g) => { try { g.disconnect(); } catch { /* already disconnected */ } });
      panNodes.forEach((p) => { try { p.disconnect(); } catch { /* already disconnected */ } });
      cleanupTimer = null;
    }, delayMs + 50);
  }

  function noteOff(whenOff: number): void {
    if (released) return;
    released = true;
    stopTime = whenOff + params.ampEnv.release + 0.1;
    scheduleCleanup(whenOff + params.ampEnv.release + 0.2);
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

  // REVIEW FIX R2: True legato glide — re-pitch existing oscillators via detune
  // ramp. The voice stays alive; only the pitch changes smoothly over glideTime.
  // The amp envelope remains in sustain phase — no new attack, seamless transition.
  let currentSemitone = opts.semitone;
  function rePitch(newSemitone: number, glideTime: number, when: number): void {
    const diff = newSemitone - currentSemitone;
    if (Math.abs(diff) < 0.01) return;
    const cents = diff * 100;
    currentSemitone = newSemitone;
    for (const osc of mainOscs) {
      if ("detune" in osc) {
        const cur = osc.detune.value;
        osc.detune.cancelScheduledValues(when);
        osc.detune.setValueAtTime(cur, when);
        osc.detune.linearRampToValueAtTime(cur + cents, when + glideTime);
      }
    }
  }

  // REVIEW FIX R2: Extend the note's gate duration (for legato glide).
  // Cancels the scheduled release and reschedules it at newNoteOffTime.
  // Assumes the voice is in the sustain phase (gate > attack + decay).
  function extendGate(newNoteOffTime: number, when: number): void {
    ampEnv.gain.cancelScheduledValues(when);
    ampEnv.gain.setValueAtTime(sustainLevel, when);
    ampEnv.gain.setValueAtTime(sustainLevel, newNoteOffTime);
    ampEnv.gain.linearRampToValueAtTime(0.0001, newNoteOffTime + params.ampEnv.release);
    stopTime = newNoteOffTime + params.ampEnv.release + 0.1;
    released = false;
    scheduleCleanup(newNoteOffTime + params.ampEnv.release + 0.2);
  }

  // Schedule initial cleanup
  scheduleCleanup(when + gate + params.ampEnv.release + 0.2);

  return { noteOff, kill, steal, rePitch, extendGate, stopTime };
}