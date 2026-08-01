// VibeCore MasterClock — central timing authority.
//
// Design principles:
//   • Pure pull-API: consumers call getStateAt(audioTime) or getState().
//     No setInterval-driven timing path lives inside the clock itself.
//   • Phase stability: position is computed from (audioTime - anchorTime)
//     against the current BPM, plus an offsetBeats accumulator that is
//     only updated on explicit re-anchor (BPM change, source swap).
//   • Source-agnostic: internal/midi/link/adaptive/hybrid all funnel
//     `setTempo` and `reanchor` into the same state machine.
//   • Additive: existing modules can continue to ignore the clock; opt-in
//     consumers read from it without breaking older code paths.

import type { ClockSource, ClockState, ClockSubscriber, Division } from "./types";
import { divisionSeconds, nextDivisionTime } from "./divisions";

interface Internal {
  bpm: number;
  beatsPerBar: number;
  source: ClockSource;
  confidence: number;
  /** audioTime where offsetBeats applies. */
  anchorAudioTime: number;
  /** beats elapsed before anchorAudioTime. */
  offsetBeats: number;
}

const state: Internal = {
  bpm: 120,
  beatsPerBar: 4,
  source: "internal",
  confidence: 1,
  anchorAudioTime: 0,
  offsetBeats: 0,
};

const subs = new Set<ClockSubscriber>();
let rafId: number | null = null;
let started = false;

/** Output-latency compensation (baseLatency + outputLatency) in seconds.
 *  getStateAt reports the audible (latency-compensated) position so all
 *  clock consumers see what is actually heard, not what is scheduled. */
let outputLatencySec = 0;

/** Transport phase state. While the internal transport is stopped the clock
 *  reports a frozen position (no drift between stop and the next play);
 *  on play it re-anchors deterministically to beat 0. External sources
 *  (adaptive/midi/link) drive the clock regardless of transport state. */
let transportRunning = false;
let holdAudioTime = 0;

function beatsAt(audioTime: number): number {
  const dt = Math.max(0, audioTime - state.anchorAudioTime);
  return state.offsetBeats + dt * (state.bpm / 60);
}

export function getStateAt(audioTime: number): ClockState {
  // Internal transport stopped → freeze at the hold point so consumers don't
  // see the phase drift while playback is paused. External sources keep going.
  const frozen = !transportRunning && state.source === "internal";
  const t = frozen ? holdAudioTime : audioTime;
  const beat = beatsAt(t - outputLatencySec);
  const bar = beat / state.beatsPerBar;
  const phase01 = ((bar % 1) + 1) % 1;
  const tick = beat * 24;
  const songPos = beat * (60 / Math.max(1, state.bpm));
  return {
    bpm: state.bpm,
    beatsPerBar: state.beatsPerBar,
    beat,
    bar,
    tick,
    phase01,
    songPos,
    audioTime: t,
    source: state.source,
    confidence: state.confidence,
  };
}

export function getState(): ClockState {
  return getStateAt(state.anchorAudioTime);
}

/**
 * Re-anchor the clock so that `audioTime` corresponds to current beat
 * position (preserving phase). Required whenever BPM changes.
 */
function reanchorPreservePhase(audioTime: number) {
  state.offsetBeats = beatsAt(audioTime);
  state.anchorAudioTime = audioTime;
}

export function setTempo(bpm: number, audioTime: number) {
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  if (bpm === state.bpm) return;
  reanchorPreservePhase(audioTime);
  state.bpm = bpm;
  notify();
}

export function setBeatsPerBar(n: number) {
  if (!Number.isFinite(n) || n < 1) return;
  state.beatsPerBar = Math.round(n);
  notify();
}

export function setSource(src: ClockSource, audioTime?: number) {
  if (src === state.source) return;
  if (typeof audioTime === "number") reanchorPreservePhase(audioTime);
  state.source = src;
  state.confidence = src === "internal" ? 1 : state.confidence;
  notify();
}

export function setConfidence(c: number) {
  state.confidence = Math.max(0, Math.min(1, c));
}

/** Register the combined output latency so the clock reports audible time. */
export function setOutputLatency(sec: number) {
  outputLatencySec = Number.isFinite(sec) && sec > 0 ? sec : 0;
}

/** Current output-latency compensation in seconds. */
export function getOutputLatency(): number {
  return outputLatencySec;
}

/** Freeze the clock position at audioTime (transport stop). The audible
 *  position is captured and reported constantly until the next play. Only
 *  affects the internal source — external sources keep advancing. */
export function holdTransport(audioTime: number) {
  holdAudioTime = audioTime;
  transportRunning = false;
  state.offsetBeats = beatsAt(audioTime - outputLatencySec);
  state.anchorAudioTime = audioTime - outputLatencySec;
  notify();
}

/** Re-anchor beat `atBeat` at audioTime and mark the transport running —
 *  called by the scheduler on play so the clock's bar grid aligns with
 *  sequencer step 0 and consumers see the phase advance live again. */
export function startTransportPhase(audioTime: number, atBeat = 0) {
  transportRunning = true;
  state.anchorAudioTime = audioTime - outputLatencySec;
  state.offsetBeats = atBeat;
  notify();
}

export function isTransportRunning(): boolean {
  return transportRunning;
}

/**
 * Hard-align beat 0 to a known audio time (used by adaptive sync on
 * downbeat detection). Preserves BPM.
 */
export function alignDownbeat(audioTime: number, atBeat = 0) {
  state.anchorAudioTime = audioTime;
  state.offsetBeats = atBeat;
  notify();
}

export function divisionSec(div: Division): number {
  return divisionSeconds(div, state.bpm);
}

export function nextDivisionAt(div: Division, fromAudioTime: number): number {
  return nextDivisionTime(div, state.bpm, fromAudioTime, state.anchorAudioTime);
}

export function subscribe(cb: ClockSubscriber): () => void {
  subs.add(cb);
  startRaf();
  return () => {
    subs.delete(cb);
    if (subs.size === 0) stopRaf();
  };
}

function notify() {
  if (subs.size === 0) return;
  const s = getState();
  subs.forEach((cb) => { try { cb(s); } catch { /* ignore */ } });
}

function startRaf() {
  if (started || typeof requestAnimationFrame === "undefined") return;
  started = true;
  const loop = () => {
    if (!started) return;
    notify();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function stopRaf() {
  started = false;
  if (rafId != null && typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(rafId);
  }
  rafId = null;
}

/** Test/reset helper. */
export function __resetClock() {
  state.bpm = 120;
  state.beatsPerBar = 4;
  state.source = "internal";
  state.confidence = 1;
  state.anchorAudioTime = 0;
  state.offsetBeats = 0;
  subs.clear();
  stopRaf();
}

export const masterClock = {
  getState, getStateAt, setTempo, setBeatsPerBar, setSource, setConfidence,
  setOutputLatency, getOutputLatency,
  holdTransport, startTransportPhase, isTransportRunning,
  alignDownbeat, divisionSec, nextDivisionAt, subscribe,
};