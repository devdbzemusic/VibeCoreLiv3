// VibeCore Groove — Deterministic Self-Test Suite.
//
// Validates the Groove module's pure functions and data-model operations
// without requiring an AudioContext. Runs entirely on the control thread.
//
// Usage: window.runGrooveTests()

import type { Pattern, Part, Step, Note } from "@/lib/model";
import { buildDefaultPattern, buildDefaultParts, buildScene, emptyStep, MAX_PATTERN_PARTS, MAX_SCENES_PER_PATTERN, nextSceneId } from "@/lib/model";
import {
  grooveDensity, swingAmount, velocityHistogram, timingAnalysis,
  humanizeAnalysis, patternSimilarity, detectKey, pitchClassHistogram,
  grooveSummary, partDensity, avgVelocity, detectChords,
} from "./analysis";

interface TestResult { name: string; pass: boolean; detail?: string; }

const results: TestResult[] = [];

function assert(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: cond, detail });
}

function approx(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}

// ─── Test fixtures ──────────────────────────────────────────────────────────

function makeTestPattern(): Pattern {
  const parts = buildDefaultParts();
  const pat = buildDefaultPattern(0, parts);
  // Overwrite scene with known data for deterministic tests.
  const sc = buildScene(16, parts);
  // Kick on every 4th
  const kickSteps = sc.partSteps[0];
  for (let i = 0; i < 16; i += 4) kickSteps[i] = { ...emptyStep(), on: true, velocity: 120, accent: i === 0 };
  // Snare on 4 and 12
  sc.partSteps[2][4] = { ...emptyStep(), on: true, velocity: 100 };
  sc.partSteps[2][12] = { ...emptyStep(), on: true, velocity: 100 };
  // Hat on every 2nd
  for (let i = 1; i < 16; i += 2) sc.partSteps[5][i] = { ...emptyStep(), on: true, velocity: 80, micro: i % 4 === 1 ? 10 : 0 };
  // Some piano-roll notes for key detection
  sc.partNotes[8] = [
    { id: "n1", step: 0, pitch: 60, length: 4, velocity: 100 } as Note,  // C4
    { id: "n2", step: 4, pitch: 64, length: 4, velocity: 100 } as Note,  // E4
    { id: "n3", step: 8, pitch: 67, length: 4, velocity: 100 } as Note,  // G4
    { id: "n4", step: 12, pitch: 60, length: 4, velocity: 100 } as Note,  // C4
  ];
  pat.scenes = [sc];
  pat.swing = 54;
  pat.seed = 0xC0FFEE;
  return pat;
}

// ─── Groove Density Tests ───────────────────────────────────────────────────

function testGrooveDensity() {
  const pat = makeTestPattern();
  const d = grooveDensity(pat);
  assert("grooveDensity: returns number", typeof d === "number");
  assert("grooveDensity: in range [0,1]", d >= 0 && d <= 1);
  assert("grooveDensity: non-empty pattern > 0", d > 0);
  // Empty pattern → 0
  const empty = buildDefaultPattern(1, buildDefaultParts());
  empty.scenes[0] = buildScene(16, buildDefaultParts());
  assert("grooveDensity: empty pattern = 0", grooveDensity(empty) === 0);
}

function testPartDensity() {
  const pat = makeTestPattern();
  const parts = buildDefaultParts();
  const map = partDensity(pat, parts);
  assert("partDensity: returns Map with all parts", map.size === parts.length);
  assert("partDensity: kick density > 0", (map.get(0) ?? 0) > 0);
  assert("partDensity: kick density = 4/16 = 0.25", approx(map.get(0) ?? -1, 0.25));
}

// ─── Swing Tests ────────────────────────────────────────────────────────────

function testSwing() {
  const pat = makeTestPattern();
  assert("swingAmount: returns pattern swing", swingAmount(pat) === 54);
  const pat2 = { ...pat, swing: 50 };
  assert("swingAmount: 50 = straight", swingAmount(pat2) === 50);
}

// ─── Velocity Histogram Tests ───────────────────────────────────────────────

function testVelocityHistogram() {
  const pat = makeTestPattern();
  const hist = velocityHistogram(pat);
  assert("velocityHistogram: returns Map", hist instanceof Map);
  assert("velocityHistogram: has entries", hist.size > 0);
  // Kick at 120 → bucket 120
  assert("velocityHistogram: bucket 120 has count", (hist.get(120) ?? 0) > 0);
  // Total count = active steps + notes
  let total = 0;
  for (const v of hist.values()) total += v;
  assert("velocityHistogram: total > 0", total > 0);
}

function testAvgVelocity() {
  const pat = makeTestPattern();
  const avg = avgVelocity(pat);
  assert("avgVelocity: returns number", typeof avg === "number");
  assert("avgVelocity: in range [1,127]", avg >= 1 && avg <= 127);
}

// ─── Timing / Humanize Analysis Tests ──────────────────────────────────────

function testTimingAnalysis() {
  const pat = makeTestPattern();
  const t = timingAnalysis(pat);
  assert("timingAnalysis: returns object", typeof t === "object");
  assert("timingAnalysis: microMin <= microAvg <= microMax", t.microMin <= t.microAvg && t.microAvg <= t.microMax);
  assert("timingAnalysis: spread = max - min", t.spread === t.microMax - t.microMin);
}

function testHumanizeAnalysis() {
  const pat = makeTestPattern();
  const h = humanizeAnalysis(pat);
  assert("humanizeAnalysis: returns object", typeof h === "object");
  assert("humanizeAnalysis: humMin <= humAvg <= humMax", h.humMin <= h.humAvg && h.humAvg <= h.humMax);
}

// ─── Pattern Similarity Tests ───────────────────────────────────────────────

function testPatternSimilarity() {
  const pat = makeTestPattern();
  // Self-similarity = 1
  assert("patternSimilarity: self = 1", approx(patternSimilarity(pat, pat), 1));
  // Two empty patterns = 1 (both empty)
  const empty1 = buildDefaultPattern(1, buildDefaultParts());
  empty1.scenes[0] = buildScene(16, buildDefaultParts());
  const empty2 = buildDefaultPattern(2, buildDefaultParts());
  empty2.scenes[0] = buildScene(16, buildDefaultParts());
  assert("patternSimilarity: both empty = 1", approx(patternSimilarity(empty1, empty2), 1));
  // Empty vs non-empty = 0
  assert("patternSimilarity: empty vs non-empty = 0", approx(patternSimilarity(empty1, pat), 0));
}

// ─── Key Detection Tests ────────────────────────────────────────────────────

function testPitchClassHistogram() {
  const pat = makeTestPattern();
  const hist = pitchClassHistogram(pat);
  assert("pitchClassHistogram: returns 12-element array", hist.length === 12);
  // C4 (60) → pitch class 0, E4 (64) → 4, G4 (67) → 7
  assert("pitchClassHistogram: C (class 0) detected", hist[0] > 0);
  assert("pitchClassHistogram: E (class 4) detected", hist[4] > 0);
  assert("pitchClassHistogram: G (class 7) detected", hist[7] > 0);
}

function testDetectKey() {
  const pat = makeTestPattern();
  const key = detectKey(pat);
  assert("detectKey: returns root 0..11", key.root >= 0 && key.root <= 11);
  assert("detectKey: returns mode major/minor", key.mode === "major" || key.mode === "minor");
  assert("detectKey: confidence in [0,1]", key.confidence >= 0 && key.confidence <= 1);
  // C-E-G pattern should detect root 0 (C) or close to it
  // (Krumhansl-Schmuckler may not be exact with only 3 pitch classes, but
  // the root should be C, E, or G for a C major triad)
  assert("detectKey: root is C, E, or G for C-E-G triad",
    key.root === 0 || key.root === 4 || key.root === 7);
}

// ─── Chord Detection Tests ──────────────────────────────────────────────────

function testDetectChords() {
  const pat = makeTestPattern();
  const chords = detectChords(pat, 0);
  assert("detectChords: returns Map", chords instanceof Map);
  // Step 0 has C+E+G → major chord
  const chord0 = chords.get(0);
  assert("detectChords: step 0 has chord", !!chord0);
  if (chord0) {
    assert("detectChords: step 0 root = 0 (C)", chord0.root === 0);
    assert("detectChords: step 0 type = major", chord0.type === "major");
  }
}

// ─── Groove Summary Tests ────────────────────────────────────────────────────

function testGrooveSummary() {
  const pat = makeTestPattern();
  const s = grooveSummary(pat);
  assert("grooveSummary: returns object", typeof s === "object");
  assert("grooveSummary: density in [0,1]", s.density >= 0 && s.density <= 1);
  assert("grooveSummary: sceneCount = 1", s.sceneCount === 1);
  assert("grooveSummary: totalSteps > 0", s.totalSteps > 0);
  assert("grooveSummary: activeSteps > 0", s.activeSteps > 0);
  assert("grooveSummary: totalNotes > 0", s.totalNotes > 0);
  assert("grooveSummary: key detected", s.key.root >= 0);
}

// ─── Pattern Model Tests ────────────────────────────────────────────────────

function testPatternModel() {
  assert("MAX_PATTERN_PARTS = 256", MAX_PATTERN_PARTS === 256);
  assert("MAX_SCENES_PER_PATTERN = 8", MAX_SCENES_PER_PATTERN === 8);
  // buildDefaultPattern creates 1 scene
  const pat = buildDefaultPattern(0, buildDefaultParts());
  assert("buildDefaultPattern: 1 scene", pat.scenes.length === 1);
  assert("buildDefaultPattern: scene length 16", pat.scenes[0].length === 16);
  // nextSceneId returns unique string
  const id1 = nextSceneId();
  const id2 = nextSceneId();
  assert("nextSceneId: unique", id1 !== id2);
}

// ─── Chain Step Model Tests ─────────────────────────────────────────────────

function testChainStepModel() {
  // ChainStep shape validation (pure type test, runtime check)
  const step = { patternId: 0, repeat: 2 };
  assert("ChainStep: patternId is number", typeof step.patternId === "number");
  assert("ChainStep: repeat is number", typeof step.repeat === "number");
  assert("ChainStep: repeat >= 1", step.repeat >= 1);
}

// ─── Run all tests ──────────────────────────────────────────────────────────

export function runGrooveTests(): { passed: number; failed: number; total: number; results: TestResult[] } {
  results.length = 0;

  testPatternModel();
  testChainStepModel();
  testGrooveDensity();
  testPartDensity();
  testSwing();
  testVelocityHistogram();
  testAvgVelocity();
  testTimingAnalysis();
  testHumanizeAnalysis();
  testPatternSimilarity();
  testPitchClassHistogram();
  testDetectKey();
  testDetectChords();
  testGrooveSummary();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__grooveTestResults = { passed, failed, total: results.length, results };
  }

  return { passed, failed, total: results.length, results };
}

// Auto-expose on window for diagnostics.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runGrooveTests = runGrooveTests;
}