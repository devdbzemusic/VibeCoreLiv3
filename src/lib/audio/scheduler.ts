// VibeCore Sync — Look-ahead scheduler (Pattern-Domain v12).
//
// ── CLOCK CONTRACT ─────────────────────────────────────────────────────────
// Single source of truth = `AudioContext.currentTime`. setInterval only WAKES
// the scheduler; the beat grid is driven by `nextTickTime` (audio-context
// timestamps) and a monotonic `globalTick` counter.
//
// ── PATTERN MODEL (Spec) ───────────────────────────────────────────────────
// Project → PatternParts (1..111) → Scenes (1..8) → Steps (4|8|16).
// Within ONE scene every Stereo Sample Part shares the same step count, so
// every tick the scheduler:
//   1. Resolves the active scene of the current pattern part.
//   2. Triggers every part's step at index `stepInScene` (shared).
//   3. Advances stepInScene; on overflow → next scene; on chain wrap →
//      apply queued / chain pattern switch.

import { useGroove } from "@/lib/store";
import type { Pattern, Scene } from "@/lib/model";
import { ensureAudio, getCtx, triggerPart, softStart, softStop } from "./engine";
import { getQuality, onQualityChange } from "./quality";
import {
  recordCallbackLatency, recordTick, recordSchedulerDrift,
} from "./audioPerf";
import { recordScheduledTick, installProbe } from "./audioClockProbe";
import {
  generateArpEventsForStep, arpCoupling, resetArpCursors, type ArpStepContext,
} from "./arpEngine";
import { hashSeed, mulberry32, type Rng } from "@/lib/utils/random";
import { masterClock } from "@/lib/clock/masterClock";
import { quantizeStepsForGrid } from "@/lib/clock/divisions";
import type { HeldPosition, PendingSeek } from "@/lib/store";

let timer: number | null = null;
let currentTickMs = 25;

let globalTick = 0;        // absolute 16th-note count since transport (re)start
let songTicks = 0;        // monotonic song position (16th notes) — never reset on pattern switch
let stepInScene = 0;       // current step inside the active scene
let sceneIdx = 0;          // current scene index inside the active pattern
let sceneLoopCount = 0;    // number of full pattern cycles completed
let nextTickTime = 0;
let unsubPlay: (() => void) | null = null;
let unsubQuality: (() => void) | null = null;
let unsubPattern: (() => void) | null = null;

let lastTickEnter = 0;
let lastPlayheadWrite = 0;
const PLAYHEAD_WRITE_MS = 50;

function stepDurSec(bpm: number) {
  return 60 / bpm / 4;
}

function humanizeRng(seed: number, partId: number, tick: number): Rng {
  return mulberry32(hashSeed(hashSeed(seed, partId), tick));
}

function currentPattern(): Pattern | undefined {
  const s = useGroove.getState();
  return s.patterns[s.transport.currentPattern];
}

function advancePattern() {
  const s = useGroove.getState();
  const t = s.transport;

  // Queued pattern takes priority (manual jump / live switch).
  if (t.queuedPattern != null && t.queuedPattern !== t.currentPattern) {
    useGroove.setState({
      transport: {
        ...t,
        currentPattern: t.queuedPattern,
        queuedPattern: null,
        currentStep: 0,
        currentSceneIdx: 0,
        sceneLoopCount: 0,
      },
      playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks },
    });
    sceneIdx = 0; stepInScene = 0; sceneLoopCount = 0;
    return;
  }

  // ── Enhanced Pattern Chain with repeat counts (VibeCore Groove) ──────────
  // The chainSteps array defines a Song-Mode sequence. Each step has a
  // repeat count — the pattern plays `repeat` times before advancing.
  // Skipped steps are jumped over. On chain end → loop from start.
  const chainSteps = t.chainSteps;
  if (chainSteps && chainSteps.length > 0) {
    // Check if the current chain step still has remaining repeats.
    const curRepeatLeft = t.chainRepeatLeft ?? 0;
    if (curRepeatLeft > 0) {
      // Stay on current pattern — decrement repeat counter.
      useGroove.setState({
        transport: {
          ...t,
          chainRepeatLeft: curRepeatLeft - 1,
          currentStep: 0,
          currentSceneIdx: 0,
          sceneLoopCount: 0,
        },
        playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks },
      });
      sceneIdx = 0; stepInScene = 0; sceneLoopCount = 0;
      return;
    }

    // Advance to next non-skipped chain step.
    let nextPos = (t.chainPos ?? 0) + 1;
    if (nextPos >= chainSteps.length) nextPos = 0; // loop

    // Skip over skipped steps (bounded scan).
    let guard = 0;
    while (chainSteps[nextPos]?.skip && guard < chainSteps.length) {
      nextPos++;
      if (nextPos >= chainSteps.length) nextPos = 0;
      guard++;
    }

    const step = chainSteps[nextPos];
    if (step && step.patternId !== t.currentPattern) {
      useGroove.setState({
        transport: {
          ...t,
          currentPattern: step.patternId,
          chainPos: nextPos,
          chainRepeatLeft: Math.max(0, step.repeat - 1),
          currentStep: 0,
          currentSceneIdx: 0,
          sceneLoopCount: 0,
        },
        playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks },
      });
      sceneIdx = 0; stepInScene = 0; sceneLoopCount = 0;
    } else if (step) {
      // Same pattern — just update chain position + repeat.
      useGroove.setState({
        transport: {
          ...t,
          chainPos: nextPos,
          chainRepeatLeft: Math.max(0, step.repeat - 1),
          currentStep: 0,
          currentSceneIdx: 0,
          sceneLoopCount: 0,
        },
        playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks },
      });
      sceneIdx = 0; stepInScene = 0; sceneLoopCount = 0;
    }
    return;
  }

  // ── Simple chain (backward compat — no repeat counts) ─────────────────────
  const chain = t.chain;
  if (chain.length > 0) {
    const idx = chain.indexOf(t.currentPattern);
    const next = chain[(idx >= 0 ? idx + 1 : 0) % chain.length];
    if (next !== t.currentPattern) {
      useGroove.setState({
        transport: {
          ...t,
          currentPattern: next,
          currentStep: 0,
          currentSceneIdx: 0,
          sceneLoopCount: 0,
          },
          playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks },
          });
      sceneIdx = 0; stepInScene = 0; sceneLoopCount = 0;
    }
  }
}

function scheduleTickAt(
  when: number,
  tickIndex: number,
  pat: Pattern,
  scene: Scene,
  step: number,
  bpm: number,
  partsList: ReturnType<typeof useGroove.getState>["parts"],
) {
  const dur = stepDurSec(bpm);
  const swing = pat.swing;

  for (let pIdx = 0; pIdx < partsList.length; pIdx++) {
    const part = partsList[pIdx];
    const arr = scene.partSteps[part.id];
    if (!arr) continue;
    const s = arr[step];
    if (!s || !s.on) continue;

    const rng = humanizeRng(pat.seed, part.id, tickIndex);
    if (s.probability < 100 && rng() * 100 > s.probability) continue;

    const hum = Math.max(0, Math.min(100, s.humanize ?? 0)) / 100;
    const timingJ = hum ? (rng() * 2 - 1) * dur * 0.10 * hum : 0;
    const velJ = hum ? Math.round((rng() * 2 - 1) * 15 * hum) : 0;
    const pitchJ = hum ? (rng() * 2 - 1) * 0.5 * hum : 0;

    const swingOffset = step % 2 === 1 ? ((swing - 50) / 50) * dur * 0.5 : 0;
    const micro = (s.micro / 50) * dur * 0.25 + timingJ + swingOffset;
    const gateSec = (s.gate / 100) * dur;
    const ratchet = Math.max(1, s.ratchet || 1);
    const baseVel = s.accent ? Math.min(127, s.velocity + 20) : s.velocity;
    const velOut = Math.max(1, Math.min(127, baseVel + velJ));
    const semiOut = (s.pitch ?? 0) + pitchJ;

    for (let r = 0; r < ratchet; r++) {
      const t = when + micro + (dur * r) / ratchet;
      triggerPart(part.id, t, { velocity: velOut, semitone: semiOut, gateSec: gateSec / ratchet });
    }

    const notes = scene.partNotes[part.id];
    if (notes && notes.length) {
      for (let ni = 0; ni < notes.length; ni++) {
        const n = notes[ni];
        if (n.step !== step) continue;
        const nMicro = ((n.micro ?? 0) / 50) * dur * 0.25;
        const nSwing = step % 2 === 1 ? ((swing - 50) / 50) * dur * 0.5 : 0;
        const nDur = dur * Math.max(0.25, n.length);
        triggerPart(part.id, when + nMicro + nSwing, {
          velocity: n.velocity,
          semitone: n.pitch - 60,
          gateSec: nDur * 0.95,
        });
      }
    }
  }

  // ── Shared SceneStep ArpEngine (E_ARP_NOTE) ─────────────────────────────
  // The arp produces events ON the SceneStep level. Each note then runs the
  // normal Voice Allocator → E_LACE → E_TRANSIENT_GATE → E_WARPER_MICRO chain
  // via triggerPart — the Arp NEVER touches DSP directly. GravLace coupling
  // (LaceDensity/GateIntensity/WarperChance) is applied purely through trigger
  // params (ratchet count, gateSec, micro offset) — no LFOs, no shared-state
  // writes — so the architecture stays deterministic and block-accurate.
  spawnArpNotes(when, dur, tickIndex, pat, scene, step, partsList);
}

function spawnArpNotes(
  when: number, dur: number, tickIndex: number,
  pat: Pattern, scene: Scene, step: number,
  partsList: ReturnType<typeof useGroove.getState>["parts"],
) {
  const arp = useGroove.getState().arp;
  if (!arp.enabled || arp.targetParts.length === 0) return;

  // Chord detector: hash all note pitches present across parts at this step.
  let chordHash = pat.seed >>> 0;
  for (const p of partsList) {
    const notes = scene.partNotes[p.id];
    if (!notes) continue;
    for (const n of notes) if (n.step === step) chordHash = hashSeed(chordHash, n.pitch);
  }

  const arpCtx: ArpStepContext = {
    patternPartId: pat.id,
    scenePartId: step,
    chordHash,
    sceneStep: step,
    sceneSteps: scene.length,
    globalTick: tickIndex,
  };
  const events = generateArpEventsForStep(arp, arpCtx);
  if (events.length === 0) return;

  const rng = mulberry32(hashSeed(pat.seed, tickIndex));
  const count = events.length;
  for (let i = 0; i < count; i++) {
    const e = events[i];
    if (e.probability < 100 && rng() * 100 > e.probability) continue;
    const subOffset = (dur * i) / count;
    const cpl = arpCoupling(e.barIndex, arp.complexity);
    const gateSec = Math.max(0.02, (dur * cpl.gateFactor) / cpl.laceRatchet);
    for (let r = 0; r < cpl.laceRatchet; r++) {
      const microOff = (rng() * 2 - 1) * (cpl.warperChance / 100) * dur * 0.2;
      // e.swingOffset is a fraction of `dur` (0..0.30) set by the ARP engine from
      // cfg.swing; it delays off-beat notes into the pocket without affecting gate.
      const t = when + subOffset + (dur * r) / cpl.laceRatchet + microOff + e.swingOffset * dur;
      for (const partId of arp.targetParts) {
        const part = partsList.find((p) => p.id === partId);
        if (!part || part.mute) continue;
        triggerPart(partId, t, {
          velocity: e.velocity,
          semitone: e.note - 48,
          gateSec,
        });
      }
    }
  }
}

function publishPlayheads() {
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (now - lastPlayheadWrite < PLAYHEAD_WRITE_MS) return;
  lastPlayheadWrite = now;
  useGroove.setState({ playheads: { step: stepInScene, sceneIdx, sceneLoop: sceneLoopCount, songTicks } });
}

let cpuAvg = 0;
let cpuFrames = 0;

function tick() {
  const t0 = performance.now();
  if (lastTickEnter > 0) recordSchedulerDrift(t0 - lastTickEnter, currentTickMs);
  lastTickEnter = t0;

  const ctx = getCtx();
  if (!ctx) return;
  const state = useGroove.getState();
  if (!state.transport.playing) return;
  let pat = currentPattern();
  if (!pat || pat.scenes.length === 0) return;

  const q = getQuality();
  const baseLatency = (ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0;
  const outputLatency = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  const lookAhead = q.lookAheadSec + baseLatency + outputLatency;
  // Read BPM from MasterClock — the single timing authority.
  // store.bpm is the user's *internal* preference; when MIDI or adaptive sync
  // is active, MasterClock.bpm reflects the actual running tempo. Using the
  // store directly causes the scheduler to keep running at the old internal BPM
  // while MasterClock has already locked to the external tempo.
  const bpm = masterClock.getState().bpm;
  const dur = stepDurSec(bpm);
  const partsList = state.parts;

  while (nextTickTime < ctx.currentTime + lookAhead) {
    const curPat = currentPattern();
    if (!curPat || curPat.scenes.length === 0) return;
    pat = curPat;
    if (sceneIdx >= pat.scenes.length) sceneIdx = 0;
    const scene = pat.scenes[sceneIdx];
    if (!scene) return;
    if (stepInScene >= scene.length) stepInScene = 0;

    const tickWhen = nextTickTime + q.scheduleOffsetSec;
    scheduleTickAt(tickWhen, globalTick, pat, scene, stepInScene, bpm, partsList);
    recordScheduledTick(ctx.currentTime, tickWhen);

    globalTick += 1;
    songTicks += 1;
    nextTickTime += dur;
    stepInScene += 1;

    if (stepInScene >= scene.length) {
      stepInScene = 0;
      sceneIdx += 1;
      if (sceneIdx >= pat.scenes.length) {
        sceneIdx = 0;
        sceneLoopCount += 1;
        // Pattern boundary — apply queued pattern / advance chain.
        const cur = useGroove.getState().transport;
        // B-1 fix: chainSteps (enhanced chain) must also trigger advancePattern,
        // not just the legacy chain[] array. Without this, the enhanced Pattern
        // Chain never advances during playback — the scheduler would loop the
        // current pattern forever, ignoring the entire chainSteps sequence.
        const wantsSwitch = cur.queuedPattern != null
          || cur.chain.length > 0
          || (cur.chainSteps != null && cur.chainSteps.length > 0)
          || state.transport.chainMode === "IMMEDIATE";
        if (wantsSwitch) advancePattern();
      }
    }

    // ── VibeCore Sync — quantised queued switch / seek (Band 4 §6.1) ──────
    const tr = useGroove.getState().transport;
    if (tr.pendingSeek) {
      const livePat = currentPattern();
      const liveLen = livePat?.scenes[sceneIdx]?.length ?? scene.length;
      const qSteps = tr.quantizeGrid && tr.quantizeGrid !== "off"
        ? quantizeStepsForGrid(tr.quantizeGrid, liveLen) : 1;
      if (tr.quantizeGrid === "off" || stepInScene % qSteps === 0) {
        applySeekNow(ctx, tr.pendingSeek);
      }
    } else if (tr.quantizeGrid && tr.quantizeGrid !== "off"
      && tr.queuedPattern != null && tr.queuedPattern !== tr.currentPattern) {
      const livePat = currentPattern();
      const liveLen = livePat?.scenes[sceneIdx]?.length ?? scene.length;
      const qSteps = quantizeStepsForGrid(tr.quantizeGrid, liveLen);
      if (stepInScene % qSteps === 0) applyQueuedNow();
    }
  }

  publishPlayheads();

  const elapsed = performance.now() - t0;
  recordTick(elapsed, currentTickMs);
  recordCallbackLatency(baseLatency + outputLatency);
  const inst = Math.min(100, (elapsed / currentTickMs) * 100);
  cpuAvg = cpuAvg * 0.9 + inst * 0.1;
  cpuFrames++;
  if (cpuFrames % 8 === 0) useGroove.setState({ cpu: Math.round(cpuAvg) });
}

function armTimer() {
  if (timer != null) window.clearInterval(timer);
  currentTickMs = getQuality().schedulerTickMs;
  lastTickEnter = 0;
  timer = window.setInterval(tick, currentTickMs);
}

// Cold-start guard: a freshly created or previously-suspended AudioContext
// can take well over the usual ~50ms lookahead before its hardware callback
// is actually flowing (observed up to ~100ms on Android WebView / mobile
// Chrome). Anchoring the first tick at `currentTime + 0.05` in that case
// schedules audio for a moment the context clock hasn't reached yet by the
// time the callback fires, producing a late tick + xrun on bar 1. Anchoring
// further out only for a genuine cold start keeps normal start/stop (context
// already running) at the original tight 50ms latency.
const COLD_START_ANCHOR_SEC = 0.15;
const WARM_START_ANCHOR_SEC = 0.05;

async function startScheduler() {
  const wasCold = getCtx()?.state !== "running";
  const ctx = await ensureAudio();
  const startAnchor = wasCold ? COLD_START_ANCHOR_SEC : WARM_START_ANCHOR_SEC;
  resetArpCursors();
  const st0 = useGroove.getState();
  const held = st0.transport.held ?? null;
  if (held) {
    // Continue — resume from the held (frozen) position on the same grid.
    songTicks = held.songTicks;
    stepInScene = held.step;
    sceneIdx = held.sceneIdx;
    sceneLoopCount = 0;
    globalTick = 0;
    nextTickTime = ctx.currentTime + startAnchor;
    if (masterClock.getState().source === "internal") masterClock.startTransportPhase(nextTickTime, held.beat);
    useGroove.setState({ transport: { ...st0.transport, held: null } });
  } else {
    // Start from 0 — align MasterClock beat 0 with transport start so all
    // clock consumers share the sequencer's bar grid. External sources keep phase.
    globalTick = 0; stepInScene = 0; sceneIdx = 0; sceneLoopCount = 0; songTicks = 0;
    nextTickTime = ctx.currentTime + startAnchor;
    if (masterClock.getState().source === "internal") masterClock.startTransportPhase(nextTickTime, 0);
    // B-2 fix: initialize chainRepeatLeft so the FIRST chain step's repeat
    // count is honored. Without this, chainRepeatLeft starts at 0 and the
    // first boundary immediately advances — the first step only plays once
    // regardless of its repeat setting.
    const cs = st0.transport.chainSteps;
    if (cs && cs.length > 0) {
      const initRepeat = Math.max(0, (cs[0].repeat ?? 1) - 1);
      useGroove.setState({
        transport: { ...st0.transport, chainPos: 0, chainRepeatLeft: initRepeat },
      });
    }
  }
  lastPlayheadWrite = 0;
  await installProbe(ctx);
  await softStart();
  armTimer();
  if (!unsubQuality) {
    unsubQuality = onQualityChange((q) => {
      if (timer != null && q.schedulerTickMs !== currentTickMs) armTimer();
    });
  }
}

async function stopScheduler() {
  if (timer != null) { window.clearInterval(timer); timer = null; }
  const c = getCtx();
  const st = useGroove.getState();
  if (c && masterClock.getState().source === "internal") masterClock.holdTransport(c.currentTime);
  if (st.transport.rewind) {
    // Stop / Rewind — discard held, zero position.
    useGroove.setState({
      transport: { ...st.transport, rewind: false, held: null, pendingSeek: null, currentStep: 0, currentSceneIdx: 0, sceneLoopCount: 0 },
      playheads: { ...st.playheads, step: 0, sceneIdx: 0, sceneLoop: 0, songTicks: 0 },
    });
    songTicks = 0; stepInScene = 0; sceneIdx = 0; sceneLoopCount = 0;
  } else {
    // Pause — capture held position for Continue (Band 4 §6.1 Start/Stop/Continue).
    const beat = masterClock.getState().beat;
    const held: HeldPosition = { step: stepInScene, sceneIdx, songTicks, beat };
    useGroove.setState({ transport: { ...st.transport, held }, playheads: { ...st.playheads, songTicks } });
  }
  await softStop(true);
}

export function initSchedulerBindings() {
  if (unsubPlay) return;
  let prevPlaying = useGroove.getState().transport.playing;
  unsubPlay = useGroove.subscribe((s) => {
    if (s.transport.playing !== prevPlaying) {
      prevPlaying = s.transport.playing;
      if (s.transport.playing) startScheduler();
      else stopScheduler();
    }
  });

  let prevPattern = useGroove.getState().transport.currentPattern;
  unsubPattern = useGroove.subscribe((s) => {
    if (s.transport.currentPattern !== prevPattern) {
      prevPattern = s.transport.currentPattern;
      const c = getCtx();
      if (c && s.transport.playing) {
        globalTick = 0;
        stepInScene = 0;
        sceneIdx = 0;
        sceneLoopCount = 0;
        // Grid-aligned switch: continue from the next already-computed step
        // boundary instead of re-anchoring to currentTime+30ms. Re-anchoring
        // lands mid-step → the new pattern's first hit is off-grid → audible
        // flam. Preserving nextTickTime keeps the new pattern exactly on the
        // old grid, so the switch is seamless and delay-free. Only nudge
        // forward if the boundary is already too close to schedule safely.
        if (nextTickTime < c.currentTime + 0.02) nextTickTime = c.currentTime + 0.02;
      }
    }
  });
  void unsubPattern;
}

// ── VibeCore Sync — quantised transition helpers (Band 4 §6.1) ───────────────
function applyQueuedNow() {
  const st = useGroove.getState();
  const t = st.transport;
  if (t.queuedPattern == null || t.queuedPattern === t.currentPattern) return;
  useGroove.setState({
    transport: { ...t, currentPattern: t.queuedPattern, queuedPattern: null, currentStep: 0, currentSceneIdx: 0, sceneLoopCount: 0 },
    playheads: { ...st.playheads, step: 0, sceneIdx: 0, sceneLoop: 0 },
  });
  stepInScene = 0; sceneIdx = 0; sceneLoopCount = 0;
}

function applySeekNow(ctx: AudioContext, seek: PendingSeek) {
  const st = useGroove.getState();
  const pat = st.patterns[st.transport.currentPattern];
  if (!pat) { useGroove.setState({ transport: { ...st.transport, pendingSeek: null } }); return; }
  const sIdx = Math.max(0, Math.min(pat.scenes.length - 1, seek.sceneIdx));
  const sc = pat.scenes[sIdx];
  if (!sc) { useGroove.setState({ transport: { ...st.transport, pendingSeek: null } }); return; }
  const step = Math.max(0, Math.min(sc.length - 1, seek.step));
  sceneIdx = sIdx; stepInScene = step; sceneLoopCount = 0; globalTick = 0;
  nextTickTime = ctx.currentTime + 0.05;
  // Re-anchor clock beat to the new position (quarter-notes = songTicks/4);
  // songTicks stays monotonic so phase continuity is preserved across seeks.
  const beat = songTicks / 4;
  if (masterClock.getState().source === "internal") masterClock.startTransportPhase(nextTickTime, beat);
  useGroove.setState({
    transport: { ...st.transport, pendingSeek: null, currentStep: step, currentSceneIdx: sIdx, sceneLoopCount: 0 },
    playheads: { ...st.playheads, step, sceneIdx: sIdx, sceneLoop: 0 },
  });
}

/** Live scheduler position (for diagnostics / tests). */
export function getSchedulerPosition() {
  return { step: stepInScene, sceneIdx, songTicks, globalTick, nextTickTime };
}

// ── Test-only exports ──────────────────────────────────────────────────────
export function __resetGlobalTickForTests() {
  globalTick = 0; nextTickTime = 0; stepInScene = 0; sceneIdx = 0; sceneLoopCount = 0; songTicks = 0;
}
export { advancePattern };