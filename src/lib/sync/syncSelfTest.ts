// VibeCore Sync — self-test suite (Band 4 §13).
//
// Deterministic, UI-independent tests for the pure/deterministic parts of
// VibeCore Sync: store transport actions (Start/Stop/Continue, rewind,
// quantise, seek, syncStatus), MasterClock phase math (re-anchor preserves
// beat), tap-tempo median, and the quantise-grid mapping.
//
// Audio-dependent behaviour (scheduler drift, continue-from-held under a live
// AudioContext, long-term drift) is covered by the existing `runClockTest` /
// `runAudioTimingTest` entry points and is NOT duplicated here (Band 4 §11.3 —
// tests must not become the architecture).
//
// Run from the browser console:  window.runSyncTests()

import { useGroove } from "@/lib/store";
import { masterClock, __resetClock } from "@/lib/clock/masterClock";
import { tapTempo, resetTap } from "@/lib/clock/tapTempo";
import { quantizeStepsForGrid } from "@/lib/clock/divisions";

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = [];

function ok(name: string, detail?: string) { results.push({ name, pass: true, detail }); }
function fail(name: string, detail: string) { results.push({ name, pass: false, detail }); }
function assert(name: string, cond: boolean, detail: string) {
  if (cond) ok(name); else fail(name, detail);
}

function testStoreTransport() {
  // Start from a clean transport.
  useGroove.getState().resetTransport();
  const s0 = useGroove.getState();
  assert("transport initially stopped", !s0.transport.playing, "playing should be false after reset");
  assert("transport quantizeGrid default off", (s0.transport.quantizeGrid ?? "off") === "off", "default quantizeGrid");

  // Play → playing true.
  useGroove.getState().togglePlay();
  assert("togglePlay starts", useGroove.getState().transport.playing, "playing should be true");

  // Pause → playing false; scheduler would capture held (we can't run it
  // without audio, but the store flag flips deterministically).
  useGroove.getState().togglePlay();
  assert("togglePlay stops", !useGroove.getState().transport.playing, "playing should be false after second toggle");

  // Quantise grid.
  useGroove.getState().setQuantizeGrid("1/4");
  assert("setQuantizeGrid persists", useGroove.getState().transport.quantizeGrid === "1/4", "quantizeGrid should be 1/4");

  // Seek sets pendingSeek deterministically (clamped, integer).
  useGroove.getState().seekTo(2, 5);
  const ps = useGroove.getState().transport.pendingSeek;
  assert("seekTo sets pendingSeek", !!ps && ps.sceneIdx === 2 && ps.step === 5, `pendingSeek=${JSON.stringify(ps)}`);
  useGroove.getState().seekTo(-3, -1);
  const ps2 = useGroove.getState().transport.pendingSeek;
  assert("seekTo clamps negatives", !!ps2 && ps2.sceneIdx === 0 && ps2.step === 0, `clamped=${JSON.stringify(ps2)}`);

  // SyncStatus.
  useGroove.getState().setSyncStatus({ source: "midi", midiConnected: true });
  const ss = useGroove.getState().transport.syncStatus;
  assert("setSyncStatus merges", !!ss && ss.source === "midi" && ss.midiConnected === true, `syncStatus=${JSON.stringify(ss)}`);

  // Reset → rewind flag set when playing.
  useGroove.getState().togglePlay(); // playing true
  useGroove.getState().resetTransport();
  const s1 = useGroove.getState();
  assert("resetTransport stops", !s1.transport.playing, "should be stopped");
  assert("resetTransport rewinds position", s1.transport.currentStep === 0 && s1.transport.currentSceneIdx === 0, "position zeroed");
}

function testClockPhaseMath() {
  __resetClock();
  masterClock.setTempo(120, 0);
  const beat0 = masterClock.getStateAt(0).beat;
  assert("clock beat at 0 is 0", beat0 === 0, `beat=${beat0}`);

  // Re-anchor on tempo change preserves the fractional beat (phase).
  masterClock.setTempo(240, 1.0); // 1s at 120bpm = 2 beats
  const beatAt1 = masterClock.getStateAt(1.0).beat;
  assert("tempo change preserves beat (phase-stable)", Math.abs(beatAt1 - 2) < 1e-6, `beat=${beatAt1} (expected 2)`);

  // At 240 bpm, 1s later = 4 beats from anchor at beat 2 → 6 beats total? No:
  // re-anchor at t=1 captured beat 2; then getStateAt(2) at 240bpm = 2 + (2-1)*4 = 6.
  const beatAt2 = masterClock.getStateAt(2.0).beat;
  assert("clock advances at new tempo", Math.abs(beatAt2 - 6) < 1e-6, `beat=${beatAt2} (expected 6)`);

  // Output-latency compensation shifts audible time without breaking phase.
  masterClock.setOutputLatency(0.05);
  const latBeat = masterClock.getStateAt(2.05).beat;
  assert("latency compensation is applied", Math.abs(latBeat - 6) < 1e-6, `beat=${latBeat} (expected ~6)`);
  masterClock.setOutputLatency(0);
  __resetClock();
}

function testTapTempo() {
  resetTap();
  // Two taps 500ms apart → 120 BPM.
  const a = tapTempo(0);
  const b = tapTempo(500);
  assert("tap needs ≥2 taps", a == null, "first tap should return null");
  assert("tap returns ~120 BPM for 500ms intervals", b != null && Math.abs(b - 120) < 1, `bpm=${b}`);
  resetTap();
}

function testQuantizeMapping() {
  assert("1/16 → every step", quantizeStepsForGrid("1/16", 16) === 1, "");
  assert("1/8 → every 2 steps", quantizeStepsForGrid("1/8", 16) === 2, "");
  assert("1/4 → every 4 steps", quantizeStepsForGrid("1/4", 16) === 4, "");
  assert("1 bar → scene length", quantizeStepsForGrid("1", 16) === 16, "");
  assert("off → 1 (immediate)", quantizeStepsForGrid("off", 16) === 1, "");
  assert("undefined → 1", quantizeStepsForGrid(undefined, 16) === 1, "");
}

export function runSyncTests(): { passed: number; failed: number; results: TestResult[] } {
  results.length = 0;
  try { testStoreTransport(); } catch (e) { fail("testStoreTransport threw", (e as Error).message); }
  try { testClockPhaseMath(); } catch (e) { fail("testClockPhaseMath threw", (e as Error).message); }
  try { testTapTempo(); } catch (e) { fail("testTapTempo threw", (e as Error).message); }
  try { testQuantizeMapping(); } catch (e) { fail("testQuantizeMapping threw", (e as Error).message); }

  // Reset store to a sane stopped state after the suite.
  try { useGroove.getState().resetTransport(); useGroove.getState().setQuantizeGrid("off"); } catch { /* ignore */ }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  // eslint-disable-next-line no-console
  console.log(`[SyncTests] ${passed} passed · ${failed} failed`, results);
  return { passed, failed, results };
}

if (typeof window !== "undefined") {
  (window as unknown as { runSyncTests: typeof runSyncTests }).runSyncTests = runSyncTests;
}