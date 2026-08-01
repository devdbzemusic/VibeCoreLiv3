// VibeCore 3D Bass — Deterministic Self-Test Suite.
//
// Pure (audio-context-free) tests for the 3D Bass parameter types, defaults,
// mono-compatibility, and modulation structure. These run deterministically
// in any environment (browser console, CI, headless).
//
// Audio-context-dependent tests (voice creation, filter response, drive
// behavior, spatial routing, phase coherence) are documented as TD-1 in
// the module review — they require a running AudioContext and are not
// reproducible in headless/CI environments.
//
// Run:  window.runBass3DTests()
// Returns: { passed, failed, total, results, summary, classification }

import { defaultBass3D } from "./params";

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

test("defaultBass3D — has osc1/osc2/sub", () => {
  const p = defaultBass3D();
  return !!p.osc1 && !!p.osc2 && !!p.sub;
});

test("defaultBass3D — osc1 is saw", () => {
  return defaultBass3D().osc1.type === "saw";
});

test("defaultBass3D — sub is sine at octave -1", () => {
  const p = defaultBass3D();
  return p.sub.type === "sine" && p.sub.octave === -1;
});

test("defaultBass3D — sub level higher than osc1 (bass focus)", () => {
  const p = defaultBass3D();
  return p.sub.level >= p.osc1.level;
});

test("defaultBass3D — filter1 is lp", () => {
  return defaultBass3D().filter1.type === "lp";
});

test("defaultBass3D — filter1 freq in bass range (< 2000)", () => {
  return defaultBass3D().filter1.freq < 2000;
});

test("defaultBass3D — has 4 LFOs", () => {
  return defaultBass3D().lfos.length === 4;
});

test("defaultBass3D — has 8 macros", () => {
  return defaultBass3D().macros.length === 8;
});

test("defaultBass3D — unison count 3", () => {
  return defaultBass3D().unison.count === 3;
});

test("defaultBass3D — unison detune ≤ 20 (bass: light detune)", () => {
  return defaultBass3D().unison.detune <= 20;
});

test("defaultBass3D — performance mode mono (bass default)", () => {
  return defaultBass3D().performance.mode === "mono";
});

test("defaultBass3D — spatial mode stereo", () => {
  return defaultBass3D().spatial.mode === "stereo";
});

// ── Mono-Compatibility ───────────────────────────────────────────────────────

test("mono-compat — crossover default 120 Hz", () => {
  return defaultBass3D().spatial.monoCrossover === 120;
});

test("mono-compat — monoEnabled default true", () => {
  return defaultBass3D().spatial.monoEnabled === true;
});

test("mono-compat — crossover range 20..500", () => {
  const p = defaultBass3D();
  return p.spatial.monoCrossover >= 20 && p.spatial.monoCrossover <= 500;
});

// ── Drive ───────────────────────────────────────────────────────────────────

test("drive — type saturation by default", () => {
  return defaultBass3D().drive.type === "saturation";
});

test("drive — bassStable default true", () => {
  return defaultBass3D().drive.bassStable === true;
});

test("drive — amount in valid range", () => {
  const a = defaultBass3D().drive.amount;
  return a >= 0 && a <= 2;
});

// ── Dynamics ─────────────────────────────────────────────────────────────────

test("dynamics — compressor enabled by default", () => {
  return defaultBass3D().dynamics.compressor.enabled === true;
});

test("dynamics — limiter enabled by default", () => {
  return defaultBass3D().dynamics.limiter.enabled === true;
});

test("dynamics — bassPunch enabled by default", () => {
  return defaultBass3D().dynamics.bassPunch.enabled === true;
});

test("dynamics — compressor ratio in valid range", () => {
  const r = defaultBass3D().dynamics.compressor.ratio;
  return r >= 1 && r <= 20;
});

test("dynamics — bassPunch amount 0..1", () => {
  const a = defaultBass3D().dynamics.bassPunch.amount;
  return a >= 0 && a <= 1;
});

// ── Filter & Acid ────────────────────────────────────────────────────────────

test("filter — acidResonance in valid range", () => {
  const a = defaultBass3D().acidResonance;
  return a >= 0 && a <= 1;
});

test("filter — bassCompensation in valid range", () => {
  const b = defaultBass3D().bassCompensation;
  return b >= 0 && b <= 1;
});

test("filter — filterEnvAmount in valid range", () => {
  const e = defaultBass3D().filterEnvAmount;
  return e >= -1 && e <= 1;
});

// ── Envelopes ────────────────────────────────────────────────────────────────

test("ampEnv — attack ≤ 0.01 (tight bass attack)", () => {
  return defaultBass3D().ampEnv.attack <= 0.01;
});

test("ampEnv — sustain ≥ 0.7 (bass sustain level)", () => {
  return defaultBass3D().ampEnv.sustain >= 0.7;
});

test("ampEnv — type adsr", () => {
  return defaultBass3D().ampEnv.type === "adsr";
});

// ── Modulation structure ─────────────────────────────────────────────────────

test("modRoutes — empty by default (user adds routes)", () => {
  return defaultBass3D().modRoutes.length === 0;
});

test("modRoutes — accepts bass-specific destinations", () => {
  const p = defaultBass3D();
  p.modRoutes = [{ source: "LFO1", dest: "driveAmount", amount: 0.5 }];
  return p.modRoutes[0].dest === "driveAmount";
});

test("modRoutes — accepts all bass-specific dests", () => {
  const p = defaultBass3D();
  const bassDests = ["driveAmount", "compThreshold", "bassPunch", "monoCrossover", "acidResonance"];
  for (const d of bassDests) {
    p.modRoutes.push({ source: "LFO1", dest: d as any, amount: 0.3 });
  }
  return p.modRoutes.length === bassDests.length;
});

// ── Spatial width (bass: narrow, not ultra-wide) ──────────────────────────────

test("spatial — width ≤ 1.0 (bass: controlled width)", () => {
  return defaultBass3D().spatial.width <= 1.0;
});

// ── Polyphony ─────────────────────────────────────────────────────────────────

test("performance — polyphony ≤ 16 (bass: limited polyphony)", () => {
  return defaultBass3D().performance.polyphony <= 16;
});

test("performance — glideMode auto (bass: smooth pitch transitions)", () => {
  return defaultBass3D().performance.glideMode === "auto";
});

// ── Run ───────────────────────────────────────────────────────────────────────

export function runBass3DTests(): {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
  summary: string;
  classification: "GOOD" | "WARNING" | "CRITICAL";
} {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;
  const classification = failed === 0 ? "GOOD" : failed <= 2 ? "WARNING" : "CRITICAL";
  const summary = `${passed}/${total} passed — ${failed} failed — classification: ${classification}`;

  if (typeof window !== "undefined") {
    console.group("%c VibeCore 3D Bass — Self-Test ", "background: #195 100% 55%; color: #000; padding: 2px 6px; border-radius: 3px;");
    results.forEach((r) => {
      if (r.pass) console.log(`✓ ${r.name}`);
      else console.error(`✗ ${r.name}: ${r.detail ?? "failed"}`);
    });
    console.log(summary);
    console.groupEnd();
  }

  return { passed, failed, total, results, summary, classification };
}

// Expose on window for manual testing
if (typeof window !== "undefined") {
  (window as any).runBass3DTests = runBass3DTests;
}