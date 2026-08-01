// VibeCore 3D Synth — Deterministic Self-Test Suite.
//
// Pure (audio-context-free) tests for the 3D Synth parameter types, unison
// calculations, and macro management. These run deterministically in any
// environment (browser console, CI, headless).
//
// Run:  window.runSynth3DTests()
// Returns: { passed, failed, total, results, summary, classification }

import {
  defaultSynth3D, defaultOsc, defaultFilter, defaultEnv,
  defaultLFO, defaultMacro, defaultUnison, defaultSpatial,
} from "./params";
import { computeUnisonOffsets } from "./voice";
import { MacroManager } from "./macros";
import { mulberry32 } from "@/lib/utils/random";

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => boolean | string): void {
  try {
    const r = fn();
    if (r === true || r === undefined) {
      results.push({ name, pass: true });
    } else if (typeof r === "string") {
      results.push({ name, pass: false, detail: r });
    } else {
      results.push({ name, pass: false, detail: "assertion failed" });
    }
  } catch (e) {
    results.push({ name, pass: false, detail: String(e) });
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// ── Parameter defaults ───────────────────────────────────────────────────────

test("defaultSynth3D — has osc1/osc2/sub", () => {
  const p = defaultSynth3D();
  return !!p.osc1 && !!p.osc2 && !!p.sub;
});
test("defaultSynth3D — has 4 LFOs", () => {
  const p = defaultSynth3D();
  return p.lfos.length === 4;
});
test("defaultSynth3D — has 8 macros", () => {
  const p = defaultSynth3D();
  return p.macros.length === 8;
});
test("defaultSynth3D — osc1 is saw", () => {
  return defaultSynth3D().osc1.type === "saw";
});
test("defaultSynth3D — sub is sine at octave -1", () => {
  const p = defaultSynth3D();
  return p.sub.type === "sine" && p.sub.octave === -1;
});
test("defaultSynth3D — filter1 is lp", () => {
  return defaultSynth3D().filter1.type === "lp";
});
test("defaultSynth3D — unison count 3", () => {
  return defaultSynth3D().unison.count === 3;
});
test("defaultSynth3D — polyphony 16", () => {
  return defaultSynth3D().performance.polyphony === 16;
});
test("defaultSynth3D — spatial stereo", () => {
  return defaultSynth3D().spatial.mode === "stereo";
});
test("defaultOsc — saw", () => {
  const o = defaultOsc("saw");
  return o.type === "saw" && o.enabled === true;
});
test("defaultFilter — lp at 2000", () => {
  const f = defaultFilter("lp");
  return f.type === "lp" && f.freq === 2000;
});
test("defaultEnv — adsr 10ms attack", () => {
  const e = defaultEnv("adsr");
  return e.type === "adsr" && e.attack === 0.01;
});
test("defaultLFO — sine 0.5 Hz", () => {
  const l = defaultLFO();
  return l.waveform === "sine" && l.rate === 0.5;
});
test("defaultMacro — 0.5, no CC", () => {
  const m = defaultMacro();
  return m.value === 0.5 && m.cc === null;
});
test("defaultUnison — detune 15, spread 0.5", () => {
  const u = defaultUnison();
  return u.detune === 15 && u.spread === 0.5;
});
test("defaultSpatial — width 1, azimuth 0", () => {
  const s = defaultSpatial();
  return s.width === 1 && s.azimuth === 0;
});

// ── Unison offsets ───────────────────────────────────────────────────────────

test("computeUnisonOffsets — single voice", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(0, 1, 20, 0.5, true, rng);
  return o.detuneCents === 0 && o.pan === 0;
});
test("computeUnisonOffsets — 3 voices center", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(1, 3, 20, 0.5, false, rng);
  return o.detuneCents === 0 && o.pan === 0;
});
test("computeUnisonOffsets — 3 voices first (−detune, −pan)", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(0, 3, 20, 0.5, false, rng);
  return o.detuneCents === -20 && o.pan === -0.5;
});
test("computeUnisonOffsets — 3 voices last (+detune, +pan)", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(2, 3, 20, 0.5, false, rng);
  return o.detuneCents === 20 && o.pan === 0.5;
});
test("computeUnisonOffsets — phase random in [0,1)", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(0, 3, 20, 0.5, true, rng);
  return o.phase >= 0 && o.phase < 1;
});
test("computeUnisonOffsets — phase 0 when not random", () => {
  const rng = mulberry32(42);
  const o = computeUnisonOffsets(0, 3, 20, 0.5, false, rng);
  return o.phase === 0;
});

// ── Macro management ─────────────────────────────────────────────────────────

test("MacroManager — default 0.5", () => {
  const m = new MacroManager(8);
  return m.getMacro(0) === 0.5 && m.getMacro(7) === 0.5;
});
test("MacroManager — setMacro clamps [0,1]", () => {
  const m = new MacroManager(8);
  m.setMacro(0, 2);
  return m.getMacro(0) === 1;
});
test("MacroManager — setMacro clamps negative", () => {
  const m = new MacroManager(8);
  m.setMacro(0, -1);
  return m.getMacro(0) === 0;
});
test("MacroManager — MIDI CC learn + handle", () => {
  const m = new MacroManager(8);
  m.learnCC(0, 74);
  m.handleCC(74, 127);
  return approx(m.getMacro(0), 1);
});
test("MacroManager — MIDI CC unlearn", () => {
  const m = new MacroManager(8);
  m.learnCC(0, 74);
  m.unlearnCC(0);
  m.handleCC(74, 127);
  return m.getMacro(0) === 0.5;
});
test("MacroManager — snapshot/restore", () => {
  const m = new MacroManager(8);
  m.setMacro(0, 0.8);
  m.learnCC(0, 74);
  const snap = m.snapshot();
  const m2 = new MacroManager(8);
  m2.restore(snap);
  return approx(m2.getMacro(0), 0.8);
});
test("MacroManager — subscribe receives updates", () => {
  const m = new MacroManager(8);
  let received: [number, number] = [-1, 0];
  const unsub = m.subscribe((i, v) => { received = [i, v]; });
  m.setMacro(3, 0.7);
  unsub();
  return received[0] === 3 && approx(received[1], 0.7);
});

// ── Run ───────────────────────────────────────────────────────────────────────

export interface Synth3DTestReport {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
  summary: string;
  classification: "PASS" | "FAIL";
}

/** Run all 3D Synth self-tests. Deterministic — no AudioContext needed. */
export function runSynth3DTests(): Synth3DTestReport {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;
  const summary = `${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}`;
  const classification: Synth3DTestReport["classification"] = failed === 0 ? "PASS" : "FAIL";

  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.group(`[3D Synth] ${summary}`);
    results.filter((r) => !r.pass).forEach((r) => {
      // eslint-disable-next-line no-console
      console.error(`  ✗ ${r.name}: ${r.detail ?? "failed"}`);
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    // eslint-disable-next-line no-console
    console.log(`[3D Synth] ✅ ${summary}`);
  }

  return { passed, failed, total, results, summary, classification };
}

// Attach to window for console access
declare global {
  interface Window {
    runSynth3DTests?: typeof runSynth3DTests;
  }
}
if (typeof window !== "undefined") {
  window.runSynth3DTests = runSynth3DTests;
}