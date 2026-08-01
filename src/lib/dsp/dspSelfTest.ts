// VibeCore DSP Core — Deterministic Self-Test Suite.
//
// Pure (audio-context-free) tests for all DSP primitives. These verify
// mathematical correctness, curve properties, and API contracts without
// needing a running AudioContext — so they run deterministically in any
// environment (browser console, CI, headless).
//
// Run:  window.runDspTests()
// Returns: { passed, failed, results, summary }

import {
  clamp, lerp, mapRange, dbToLin, linToDb,
  midiToFreq, semiToHz, hzToMidi, fastTanh, equalPowerPan,
  wrapPhase, denormalFlush,
} from "./math";
import {
  makeTanhCurve, makeTubeCurve, makeTapeCurve,
  makeFoldbackCurve, makeSoftClipCurve, makeOverdriveCurve,
  makeBitcrushCurve, makeDriveCurve,
} from "./curves";
import { computeADSR } from "./envelope";
import { computeLFO, lfoRateHz } from "./lfo";
import { bpmToDelaySec } from "./delay";
import { semisToRatio, ratioToSemis } from "./pitch";
import { crossFadeGains } from "./spatial";

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
      results.push({ name, pass: false, detail: `assertion failed` });
    }
  } catch (e) {
    results.push({ name, pass: false, detail: String(e) });
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// ── Math utilities ───────────────────────────────────────────────────────────

test("clamp — in range", () => clamp(5, 0, 10) === 5);
test("clamp — below", () => clamp(-5, 0, 10) === 0);
test("clamp — above", () => clamp(15, 0, 10) === 10);
test("lerp — midpoint", () => approx(lerp(0, 10, 0.5), 5));
test("lerp — start", () => approx(lerp(0, 10, 0), 0));
test("lerp — end", () => approx(lerp(0, 10, 1), 10));
test("mapRange — mid", () => approx(mapRange(5, 0, 10, 100, 200), 150));
test("mapRange — clamped", () => approx(mapRange(-5, 0, 10, 0, 1), 0));

test("dbToLin — 0 dB", () => approx(dbToLin(0), 1));
test("dbToLin — -6 dB", () => approx(dbToLin(-6), 0.501, 0.01));
test("dbToLin — +6 dB", () => approx(dbToLin(6), 1.995, 0.01));
test("linToDb — 1.0", () => approx(linToDb(1), 0));
test("linToDb — 0", () => linToDb(0) === -Infinity);

test("midiToFreq — A4 (69)", () => approx(midiToFreq(69), 440));
test("midiToFreq — A5 (81)", () => approx(midiToFreq(81), 880, 0.01));
test("semiToHz — +12", () => approx(semiToHz(440, 12), 880));
test("semiToHz — -12", () => approx(semiToHz(440, -12), 220));
test("hzToMidi — 440 Hz", () => approx(hzToMidi(440), 69));

test("fastTanh — 0", () => approx(fastTanh(0), 0, 0.001));
test("fastTanh — ±1", () => {
  const a = fastTanh(1);
  const b = fastTanh(-1);
  return approx(a, 0.76, 0.05) && approx(b, -0.76, 0.05);
});

test("equalPowerPan — center", () => {
  const [l, r] = equalPowerPan(0);
  return approx(l, r, 0.001);
});
test("equalPowerPan — full left", () => {
  const [l, r] = equalPowerPan(-1);
  return approx(l, 1, 0.001) && approx(r, 0, 0.001);
});
test("equalPowerPan — full right", () => {
  const [l, r] = equalPowerPan(1);
  return approx(l, 0, 0.001) && approx(r, 1, 0.001);
});

test("wrapPhase — 1.5", () => approx(wrapPhase(1.5), 0.5));
test("wrapPhase — -0.5", () => approx(wrapPhase(-0.5), 0.5));
test("wrapPhase — 0", () => approx(wrapPhase(0), 0));

test("denormalFlush — zero", () => denormalFlush(0) === 0);
test("denormalFlush — denormal", () => denormalFlush(1e-40) === 0);
test("denormalFlush — normal", () => approx(denormalFlush(1e-10), 1e-10));

// ── Curves ───────────────────────────────────────────────────────────────────

test("makeTanhCurve — length", () => {
  const c = makeTanhCurve(1, 1024);
  return c.length === 1024;
});
test("makeTanhCurve — center is zero", () => {
  const c = makeTanhCurve(1, 1024);
  return approx(c[512], 0, 0.01);
});
test("makeTanhCurve — endpoints ±1", () => {
  const c = makeTanhCurve(1, 1024);
  return c[0] < -0.7 && c[1023] > 0.7;
});
test("makeTanhCurve — odd symmetry", () => {
  const c = makeTanhCurve(1.5, 1024);
  return approx(c[256], -c[768], 0.01);
});

test("makeTubeCurve — length", () => makeTubeCurve(1, 512).length === 512);
test("makeTapeCurve — length", () => makeTapeCurve(1, 512).length === 512);
test("makeFoldbackCurve — length", () => makeFoldbackCurve(0.5, 512).length === 512);
test("makeSoftClipCurve — length", () => makeSoftClipCurve(1, 512).length === 512);
test("makeOverdriveCurve — length", () => makeOverdriveCurve(0.5, 512).length === 512);
test("makeBitcrushCurve — length", () => makeBitcrushCurve(4, 512).length === 512);
test("makeDriveCurve — length", () => makeDriveCurve(50, 512).length === 512);

test("makeBitcrushCurve — quantisation", () => {
  const c = makeBitcrushCurve(2, 256);
  // With 2 bits, there should be only 4 distinct levels
  const levels = new Set(c);
  return levels.size <= 5;
});

test("makeOverdriveCurve — hard clip", () => {
  const c = makeOverdriveCurve(1, 256);
  // At full overdrive, the curve should hit ±1 (hard clip)
  return c[0] <= -0.99 && c[255] >= 0.99;
});

// ── Envelopes ───────────────────────────────────────────────────────────────

test("computeADSR — attack", () => {
  const v = computeADSR(0.05, 1, { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.1 });
  return approx(v, 0.5, 0.01);
});
test("computeADSR — sustain", () => {
  const v = computeADSR(0.5, 2, { attack: 0.01, decay: 0.01, sustain: 0.7, release: 0.1 });
  return approx(v, 0.7, 0.01);
});
test("computeADSR — release", () => {
  const v = computeADSR(2.5, 2, { attack: 0.01, decay: 0.01, sustain: 0.7, release: 0.5 });
  return v < 0.7 && v > 0;
});
test("computeADSR — after release", () => {
  const v = computeADSR(10, 1, { attack: 0.01, decay: 0.01, sustain: 0.7, release: 0.1 });
  return v === 0;
});

// ── LFO ──────────────────────────────────────────────────────────────────────

test("computeLFO — sine at 0", () => approx(computeLFO("sine", 0), 0, 0.01));
test("computeLFO — sine at 0.25", () => approx(computeLFO("sine", 0.25), 1, 0.01));
test("computeLFO — sine at 0.5", () => approx(computeLFO("sine", 0.5), 0, 0.01));
test("computeLFO — sine at 0.75", () => approx(computeLFO("sine", 0.75), -1, 0.01));
test("computeLFO — square at 0.25", () => computeLFO("square", 0.25) === 1);
test("computeLFO — square at 0.75", () => computeLFO("square", 0.75) === -1);
test("computeLFO — saw at 0", () => approx(computeLFO("saw", 0), -1));
test("computeLFO — saw at 0.5", () => approx(computeLFO("saw", 0.5), 0));
test("computeLFO — triangle at 0", () => approx(computeLFO("triangle", 0), -1));
test("computeLFO — triangle at 0.5", () => approx(computeLFO("triangle", 0.5), 1));

test("lfoRateHz — free-run", () => approx(lfoRateHz({ rate: 5, waveform: "sine", depth: 1 }), 5));
test("lfoRateHz — sync 1/4 at 120 BPM", () => {
  const r = lfoRateHz({ rate: 0, waveform: "sine", depth: 1, syncDiv: "1/4", bpm: 120 });
  return approx(r, 2, 0.01);
});

// ── Delay ────────────────────────────────────────────────────────────────────

test("bpmToDelaySec — 120 BPM 1/4", () => {
  const s = bpmToDelaySec(120, "1/4");
  return approx(s, 0.5, 0.001);
});
test("bpmToDelaySec — 120 BPM 1/16", () => {
  const s = bpmToDelaySec(120, "1/16");
  return approx(s, 0.125, 0.001);
});
test("bpmToDelaySec — 60 BPM 1/4", () => {
  const s = bpmToDelaySec(60, "1/4");
  return approx(s, 1, 0.001);
});

// ── Pitch ────────────────────────────────────────────────────────────────────

test("semisToRatio — +12", () => approx(semisToRatio(12), 2));
test("semisToRatio — -12", () => approx(semisToRatio(-12), 0.5));
test("semisToRatio — 0", () => approx(semisToRatio(0), 1));
test("ratioToSemis — 2", () => approx(ratioToSemis(2), 12));
test("ratioToSemis — 0.5", () => approx(ratioToSemis(0.5), -12));
test("ratioToSemis — inverse", () => {
  const s = 7;
  return approx(ratioToSemis(semisToRatio(s)), s, 0.001);
});

// ── Spatial ───────────────────────────────────────────────────────────────────

test("crossFadeGains — A only", () => {
  const [a, b] = crossFadeGains(0);
  return approx(a, 1, 0.001) && approx(b, 0, 0.001);
});
test("crossFadeGains — B only", () => {
  const [a, b] = crossFadeGains(1);
  return approx(a, 0, 0.001) && approx(b, 1, 0.001);
});
test("crossFadeGains — midpoint", () => {
  const [a, b] = crossFadeGains(0.5);
  return approx(a, b, 0.001);
});

// ── Run ──────────────────────────────────────────────────────────────────────

export interface DspTestReport {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
  summary: string;
  classification: "PASS" | "FAIL";
}

/** Run all DSP Core self-tests. Deterministic — no AudioContext needed. */
export function runDspTests(): DspTestReport {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;
  const summary = `${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}`;
  const classification: DspTestReport["classification"] = failed === 0 ? "PASS" : "FAIL";

  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.group(`[DSP Core] ${summary}`);
    results.filter((r) => !r.pass).forEach((r) => {
      // eslint-disable-next-line no-console
      console.error(`  ✗ ${r.name}: ${r.detail ?? "failed"}`);
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    // eslint-disable-next-line no-console
    console.log(`[DSP Core] ✅ ${summary}`);
  }

  return { passed, failed, total, results, summary, classification };
}

// Attach to window for console access
declare global {
  interface Window {
    runDspTests?: typeof runDspTests;
  }
}
if (typeof window !== "undefined") {
  window.runDspTests = runDspTests;
}