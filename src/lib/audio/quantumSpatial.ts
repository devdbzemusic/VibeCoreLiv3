// Quantum Spatial Engine — Phase 9
// Real-time spatial movement on a test carrier (sawtooth). Demonstrates
// width, depth (delay), distance (low-pass + gain), orbit (panner LFO),
// rotation (M/S rotation matrix), elevation (shelf tilt), motion (LFO speed),
// focus (Q on a band-pass). All updates are smoothed.

import { ensureAudio, getCtx, masterInput } from "./engine";
import { masterClock } from "@/lib/clock/masterClock";
import { divisionHz } from "@/lib/clock/divisions";
import type { Division } from "@/lib/clock/types";

export interface SpatialParams {
  width: number;      // 0..1
  depth: number;      // 0..1   delay ms 0..40
  distance: number;   // 0..1   gain + LP cutoff
  orbit: number;      // 0..1   panner LFO amount
  rotation: number;   // 0..1   M/S blend
  elevation: number;  // -1..+1 high-shelf gain
  motion: number;     // 0..1   LFO rate 0.05..6 Hz
  focus: number;      // 0..1   BP Q 0.5..12 around 1.2kHz
}

/** Phase 3 — independent sync toggle per movement axis. */
export interface SpatialSyncState {
  orbitSync: boolean;
  motionSync: boolean;
  rotationSync: boolean;
  orbitDiv: Division;
  motionDiv: Division;
  rotationDiv: Division;
}

export const DEFAULT_SPATIAL: SpatialParams = {
  width: 0.5, depth: 0.2, distance: 0.25, orbit: 0.4,
  rotation: 0.3, elevation: 0, motion: 0.3, focus: 0.3,
};

export const DEFAULT_SPATIAL_SYNC: SpatialSyncState = {
  orbitSync: false, motionSync: false, rotationSync: false,
  orbitDiv: "1/4", motionDiv: "1/2", rotationDiv: "1",
};

type N = {
  src: OscillatorNode;
  pre: GainNode;
  bp: BiquadFilterNode;
  distLp: BiquadFilterNode;
  distGain: GainNode;
  elev: BiquadFilterNode;
  delayL: DelayNode;
  delayR: DelayNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  panner: StereoPannerNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  midGain: GainNode;
  sideGain: GainNode;
  out: GainNode;
  analyser: AnalyserNode;
};

let n: N | null = null;
let enabled = false;
let p: SpatialParams = { ...DEFAULT_SPATIAL };
let sync: SpatialSyncState = { ...DEFAULT_SPATIAL_SYNC };
let syncUnsub: (() => void) | null = null;
const T = 0.02;
const c = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Effective motion LFO frequency, honouring motion sync. */
function effectiveMotionHz(): number {
  if (sync.motionSync) {
    const hz = divisionHz(sync.motionDiv, masterClock.getState().bpm);
    return Math.max(0.05, Math.min(20, hz));
  }
  return 0.05 + c(p.motion) * 5.95;
}

function apply(now: number) {
  if (!n) return;
  n.delayL.delayTime.setTargetAtTime(c(p.depth) * 0.04, now, T);
  n.delayR.delayTime.setTargetAtTime(c(p.depth) * 0.04 * 0.5, now, T);
  n.distLp.frequency.setTargetAtTime(800 + (1 - c(p.distance)) * 10000, now, T);
  n.distGain.gain.setTargetAtTime(0.4 + (1 - c(p.distance)) * 0.5, now, T);
  n.elev.gain.setTargetAtTime(c(p.elevation, -1, 1) * 9, now, T);
  n.lfo.frequency.setTargetAtTime(effectiveMotionHz(), now, T);
  // Orbit sync: rescale amount by division position to keep phase-stable orbit
  const orbitAmt = sync.orbitSync
    ? c(p.orbit) * (0.7 + 0.3 * Math.sin(masterClock.getState().phase01 * Math.PI * 2))
    : c(p.orbit);
  n.lfoGain.gain.setTargetAtTime(orbitAmt, now, T);
  // Rotation sync: tie M/S blend to clock phase for predictable rotation
  const rotBase = c(p.rotation);
  const rotMod = sync.rotationSync
    ? rotBase * (0.7 + 0.3 * Math.cos(masterClock.getState().phase01 * Math.PI * 2))
    : rotBase;
  n.midGain.gain.setTargetAtTime(1 - rotMod * 0.6, now, T);
  n.sideGain.gain.setTargetAtTime(0.5 + c(p.width) * 1.2 + rotMod * 0.4, now, T);
  n.bp.Q.setTargetAtTime(0.5 + c(p.focus) * 11.5, now, T);
  n.out.gain.setTargetAtTime(0.4, now, T);
}

export function getSpatialParams(): SpatialParams { return { ...p }; }
export function getSpatialSync(): SpatialSyncState { return { ...sync }; }
export function isSpatialEnabled(): boolean { return enabled; }
export function setSpatialParam<K extends keyof SpatialParams>(k: K, v: SpatialParams[K]) {
  p = { ...p, [k]: v };
  const ctx = getCtx();
  if (ctx && n) apply(ctx.currentTime);
}
export function setSpatialSync<K extends keyof SpatialSyncState>(k: K, v: SpatialSyncState[K]) {
  sync = { ...sync, [k]: v };
  ensureSyncSubscription();
  const ctx = getCtx();
  if (ctx && n) apply(ctx.currentTime);
}

function ensureSyncSubscription() {
  const anyOn = sync.motionSync || sync.orbitSync || sync.rotationSync;
  if (!anyOn) {
    if (syncUnsub) { syncUnsub(); syncUnsub = null; }
    return;
  }
  if (syncUnsub) return;
  syncUnsub = masterClock.subscribe(() => {
    const ctx = getCtx();
    if (ctx && n) apply(ctx.currentTime);
  });
}

export async function enableSpatial(): Promise<void> {
  if (enabled) return;
  const ctx = await ensureAudio();
  const dst = masterInput();
  if (!dst) return;

  const src = ctx.createOscillator();
  src.type = "sawtooth";
  src.frequency.value = 220;

  const pre = ctx.createGain(); pre.gain.value = 0.18;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 1;
  const distLp = ctx.createBiquadFilter(); distLp.type = "lowpass"; distLp.frequency.value = 8000;
  const distGain = ctx.createGain(); distGain.gain.value = 0.7;
  const elev = ctx.createBiquadFilter(); elev.type = "highshelf"; elev.frequency.value = 6000;

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const delayL = ctx.createDelay(0.1); delayL.delayTime.value = 0.01;
  const delayR = ctx.createDelay(0.1); delayR.delayTime.value = 0.005;
  const midGain = ctx.createGain(); midGain.gain.value = 1;
  const sideGain = ctx.createGain(); sideGain.gain.value = 1;

  const panner = ctx.createStereoPanner();
  const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.5;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;

  const out = ctx.createGain(); out.gain.value = 0.4;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512;

  // Wire
  src.connect(pre); pre.connect(bp); bp.connect(distLp); distLp.connect(distGain); distGain.connect(elev);
  // mono → split into L (direct) + R (delayed) for stereo depth
  elev.connect(delayL); elev.connect(delayR);
  delayL.connect(merger, 0, 0);
  delayR.connect(merger, 0, 1);
  merger.connect(splitter);
  splitter.connect(midGain, 0); splitter.connect(midGain, 1);
  splitter.connect(sideGain, 0);
  midGain.connect(panner); sideGain.connect(panner);
  // LFO modulates panner.pan
  lfo.connect(lfoGain); lfoGain.connect(panner.pan);
  panner.connect(out); out.connect(analyser); out.connect(dst);

  src.start(); lfo.start();
  n = { src, pre, bp, distLp, distGain, elev, delayL, delayR, splitter, merger, panner, lfo, lfoGain, midGain, sideGain, out, analyser };
  enabled = true;
  apply(ctx.currentTime);
}

export function disableSpatial() {
  if (!enabled || !n) return;
  try { n.src.stop(); } catch { /* ignore */ }
  try { n.lfo.stop(); } catch { /* ignore */ }
  try { n.out.disconnect(); } catch { /* ignore */ }
  n = null;
  enabled = false;
}

/** XY orbit coordinate for visualisation (normalised -1..+1). */
export function readSpatialPosition(time: number): { x: number; y: number; r: number } {
  const rate = 0.05 + c(p.motion) * 5.95;
  const amp = c(p.orbit);
  const x = Math.sin(time * rate * Math.PI * 2) * amp;
  const y = Math.cos(time * rate * Math.PI * 2) * amp * (0.4 + c(p.width) * 0.6);
  const r = c(p.distance);
  return { x, y, r };
}
