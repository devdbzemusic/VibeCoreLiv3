// VibeCore Sample Forge — Deterministic Self-Test Suite.
//
// Validates the Sample Forge module's pure functions without requiring an
// AudioContext. All tests run on the control thread with synthetic PCM data.
//
// Usage: window.runSampleForgeTests()

import type { PCM } from "@/lib/audio/sampleForge";
import {
  computePeak, computeRMS, computeCrest, computeDCOffset, detectClipping,
  computeLoudness, detectBPM, detectFundamental, detectKeyFromAudio,
  pitchClassHistogramFromAudio, analyzeSample, analyzeDynamics,
} from "./analysis";
import {
  copyRegion, cutRegion, deleteRegion, pasteRegion, insertSilence,
  silenceRegion, mergeBuffers, splitAt, applyGain, normalizePCM,
  reversePCM, reverseRegion, crossfadeBuffers, stereoToMono, monoToStereo,
} from "./editor";
import {
  autoSlice, equalSlice, addSlice, mergeSlices, splitSlice, moveSlice,
  deleteSlice, renameSlice, colorSlice, sliceRegion, slicesToSteps,
} from "./sliceEngine";
import {
  applyLoopCrossfade, extractLoopRegion, barsToSamples, snapLoopToBars,
  makePingPongLoop,
} from "./loopEngine";
import {
  classifyDrum, classifyInstrument, suggestSlices, suggestLoopPoints,
  generateSampleTags, computeFingerprint, fingerprintSimilarity, findSimilarSamples,
} from "./aiAssistant";

interface TestResult { name: string; pass: boolean; detail?: string; }
const results: TestResult[] = [];
function assert(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: cond, detail });
}
function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

// ─── Test fixtures ──────────────────────────────────────────────────────────

function makeSinePCM(freq: number, durSec: number, sr = 44100): PCM {
  const len = Math.floor(sr * durSec);
  const ch = new Float32Array(len);
  for (let i = 0; i < len; i++) ch[i] = Math.sin(2 * Math.PI * freq * i / sr) * 0.8;
  return { channels: [ch], sampleRate: sr };
}

function makeSilentPCM(durSec: number, sr = 44100): PCM {
  const len = Math.floor(sr * durSec);
  return { channels: [new Float32Array(len)], sampleRate: sr };
}

function makeClickPCM(sr = 44100): PCM {
  const len = sr * 2; // 2 seconds
  const ch = new Float32Array(len);
  // Clicks every 0.5s (120 BPM)
  for (let i = 0; i < len; i++) {
    const phase = (i % Math.floor(sr * 0.5)) / sr;
    if (phase < 0.01) ch[i] = Math.sin(2 * Math.PI * 1000 * i / sr) * Math.exp(-phase * 200) * 0.9;
  }
  return { channels: [ch], sampleRate: sr };
}

// ─── Analysis Tests ────────────────────────────────────────────────────────────

function testComputePeak() {
  const pcm = makeSinePCM(440, 0.1);
  const peak = computePeak(pcm);
  assert("computePeak: sine 0.8 → ~0.8", approx(peak, 0.8, 0.01));
  const silent = makeSilentPCM(0.1);
  assert("computePeak: silent → 0", computePeak(silent) === 0);
}

function testComputeRMS() {
  const pcm = makeSinePCM(440, 0.1);
  const rms = computeRMS(pcm);
  // RMS of full-scale sine = amplitude / sqrt(2) ≈ 0.8 / 1.414 ≈ 0.566
  assert("computeRMS: sine → ~0.566", approx(rms, 0.566, 0.02));
}

function testComputeCrest() {
  const sine = makeSinePCM(440, 0.1);
  const crest = computeCrest(sine);
  // Crest of sine = sqrt(2) ≈ 1.414
  assert("computeCrest: sine → ~1.414", approx(crest, 1.414, 0.05));
}

function testDCOffset() {
  const pcm = makeSinePCM(440, 0.1);
  const dc = computeDCOffset(pcm);
  // Pure sine has ~0 DC offset
  assert("computeDCOffset: pure sine → ~0", Math.abs(dc) < 0.01);
  // Add DC offset
  const ch = pcm.channels[0];
  for (let i = 0; i < ch.length; i++) ch[i] += 0.1;
  const dc2 = computeDCOffset(pcm);
  assert("computeDCOffset: +0.1 DC → ~0.1", approx(dc2, 0.1, 0.01));
}

function testDetectClipping() {
  const normal = makeSinePCM(440, 0.1);
  const clip = detectClipping(normal);
  assert("detectClipping: normal → not clipped", !clip.clipped);
  // Create clipped signal
  const ch = normal.channels[0];
  for (let i = 0; i < 100; i++) ch[i] = 1.0; // clip at full scale
  const clip2 = detectClipping(normal);
  assert("detectClipping: full-scale → clipped", clip2.clipped);
  assert("detectClipping: clipCount > 0", clip2.clipCount > 0);
}

function testLoudness() {
  const pcm = makeSinePCM(440, 0.5);
  const lufs = computeLoudness(pcm);
  assert("computeLoudness: returns number", typeof lufs === "number");
  // Full-scale sine ≈ -1 LUFS (approximation)
  assert("computeLoudness: in reasonable range", lufs > -30 && lufs < 10);
}

function testDetectBPM() {
  const clicks = makeClickPCM(44100);
  const bpm = detectBPM(clicks);
  // Clicks every 0.5s = 120 BPM
  assert("detectBPM: 120 BPM clicks detected", bpm === 120 || bpm === 60 || bpm === 240);
}

function testDetectFundamental() {
  const pcm = makeSinePCM(440, 0.2);
  const f = detectFundamental(pcm);
  // 440 Hz sine
  assert("detectFundamental: 440 Hz → ~440", approx(f, 440, 5));
}

function testDetectKey() {
  // C major chord: C4 (261.6), E4 (329.6), G4 (392)
  const sr = 44100;
  const len = Math.floor(sr * 0.5);
  const ch = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    ch[i] = (Math.sin(2 * Math.PI * 261.6 * i / sr)
      + Math.sin(2 * Math.PI * 329.6 * i / sr)
      + Math.sin(2 * Math.PI * 392 * i / sr)) / 3 * 0.8;
  }
  const pcm = { channels: [ch], sampleRate: sr };
  const key = detectKeyFromAudio(pcm);
  assert("detectKeyFromAudio: root 0..11", key.root >= 0 && key.root <= 11);
  assert("detectKeyFromAudio: mode major/minor", key.mode === "major" || key.mode === "minor");
  assert("detectKeyFromAudio: confidence >= 0", key.confidence >= 0);
}

function testAnalyzeSample() {
  const pcm = makeSinePCM(440, 0.5);
  const a = analyzeSample(pcm);
  assert("analyzeSample: durationSec", approx(a.durationSec, 0.5, 0.01));
  assert("analyzeSample: sampleRate", a.sampleRate === 44100);
  assert("analyzeSample: channels", a.channels === 1);
  assert("analyzeSample: peak > 0", a.peak > 0);
  assert("analyzeSample: rms > 0", a.rms > 0);
  assert("analyzeSample: dynamics present", typeof a.dynamics.rms === "number");
  assert("analyzeSample: key present", typeof a.key.root === "number");
  assert("analyzeSample: clipping report", typeof a.clipping.clipped === "boolean");
}

// ─── Editor Tests ─────────────────────────────────────────────────────────────

function testCopyRegion() {
  const pcm = makeSinePCM(440, 0.2);
  const copy = copyRegion(pcm, 0.25, 0.75);
  assert("copyRegion: returns half-length", approx(copy.channels[0].length, pcm.channels[0].length * 0.5, 10));
}

function testCutRegion() {
  const pcm = makeSinePCM(440, 0.2);
  const { cut, rest } = cutRegion(pcm, 0.25, 0.75);
  assert("cutRegion: cut is half length", approx(cut.channels[0].length, pcm.channels[0].length * 0.5, 10));
  assert("cutRegion: rest is remaining", approx(rest.channels[0].length, pcm.channels[0].length * 0.5, 10));
  assert("cutRegion: cut + rest = original", cut.channels[0].length + rest.channels[0].length === pcm.channels[0].length);
}

function testDeleteRegion() {
  const pcm = makeSinePCM(440, 0.2);
  const deleted = deleteRegion(pcm, 0.0, 0.5);
  assert("deleteRegion: half length", approx(deleted.channels[0].length, pcm.channels[0].length * 0.5, 10));
}

function testPasteRegion() {
  const target = makeSinePCM(440, 0.1);
  const pasted = makeSinePCM(880, 0.05);
  const result = pasteRegion(target, 0.5, pasted);
  assert("pasteRegion: length = target + pasted", result.channels[0].length === target.channels[0].length + pasted.channels[0].length);
}

function testInsertSilence() {
  const pcm = makeSinePCM(440, 0.1);
  const result = insertSilence(pcm, 0.5, 0.05);
  const expectedLen = pcm.channels[0].length + Math.floor(0.05 * 44100);
  assert("insertSilence: length increased", approx(result.channels[0].length, expectedLen, 5));
}

function testSilenceRegion() {
  const pcm = makeSinePCM(440, 0.1);
  const result = silenceRegion(pcm, 0.0, 0.5);
  // First half should be zero
  let allZero = true;
  const halfLen = Math.floor(result.channels[0].length * 0.5);
  for (let i = 0; i < halfLen; i++) {
    if (Math.abs(result.channels[0][i]) > 0.001) { allZero = false; break; }
  }
  assert("silenceRegion: first half is silence", allZero);
}

function testMergeBuffers() {
  const a = makeSinePCM(440, 0.1);
  const b = makeSinePCM(880, 0.1);
  const merged = mergeBuffers(a, b);
  assert("mergeBuffers: length = a + b", merged.channels[0].length === a.channels[0].length + b.channels[0].length);
}

function testSplitAt() {
  const pcm = makeSinePCM(440, 0.2);
  const [left, right] = splitAt(pcm, 0.5);
  assert("splitAt: left + right = original", left.channels[0].length + right.channels[0].length === pcm.channels[0].length);
}

function testApplyGain() {
  const pcm = makeSinePCM(440, 0.1);
  const gained = applyGain(pcm, 0.5);
  const origPeak = computePeak(pcm);
  const newPeak = computePeak(gained);
  assert("applyGain: 0.5 gain → half peak", approx(newPeak, origPeak * 0.5, 0.01));
}

function testNormalizePCM() {
  const pcm = makeSinePCM(440, 0.1);
  // Reduce amplitude
  const ch = pcm.channels[0];
  for (let i = 0; i < ch.length; i++) ch[i] *= 0.1;
  const normalized = normalizePCM(pcm, 0.99);
  assert("normalizePCM: peak → 0.99", approx(computePeak(normalized), 0.99, 0.01));
}

function testReversePCM() {
  const pcm = makeSinePCM(440, 0.1);
  const reversed = reversePCM(pcm);
  // First sample of reversed = last sample of original
  assert("reversePCM: first = last", approx(reversed.channels[0][0], pcm.channels[0][pcm.channels[0].length - 1], 0.001));
}

function testCrossfade() {
  const a = makeSinePCM(440, 0.1);
  const b = makeSinePCM(880, 0.1);
  const xfaded = crossfadeBuffers(a, b, 0.05);
  const expectedLen = a.channels[0].length + b.channels[0].length - Math.floor(Math.min(a.channels[0].length, b.channels[0].length) * 0.05);
  assert("crossfade: length correct", approx(xfaded.channels[0].length, expectedLen, 10));
}

function testStereoToMono() {
  const stereo = monoToStereo(makeSinePCM(440, 0.1));
  assert("monoToStereo: 2 channels", stereo.channels.length === 2);
  const mono = stereoToMono(stereo);
  assert("stereoToMono: 1 channel", mono.channels.length === 1);
}

// ─── Slice Engine Tests ────────────────────────────────────────────────────────

function testEqualSlice() {
  const slices = equalSlice(8);
  assert("equalSlice: 8 slices", slices.length === 8);
  assert("equalSlice: first at 0", slices[0].start === 0);
  assert("equalSlice: names S1..S8", slices[0].name === "S1" && slices[7].name === "S8");
}

function testAutoSlice() {
  const clicks = makeClickPCM(44100);
  const slices = autoSlice(clicks, 0.5, 16);
  assert("autoSlice: returns array", Array.isArray(slices));
  assert("autoSlice: first at 0", slices[0]?.start === 0);
  assert("autoSlice: sorted", slices.every((s, i) => i === 0 || s.start >= slices[i - 1].start));
}

function testAddSlice() {
  const slices = equalSlice(4);
  const added = addSlice(slices, 0.5, "MID");
  assert("addSlice: +1 slice", added.length === 5);
  assert("addSlice: sorted", added.every((s, i) => i === 0 || s.start >= slices[i - 1].start));
}

function testMergeSlices() {
  const slices = equalSlice(4);
  const merged = mergeSlices(slices, 1);
  assert("mergeSlices: -1 slice", merged.length === 3);
}

function testSplitSlice() {
  const slices = equalSlice(4);
  const split = splitSlice(slices, 0, 0.05);
  assert("splitSlice: +1 slice", split.length === 5);
}

function testDeleteSlice() {
  const slices = equalSlice(4);
  const deleted = deleteSlice(slices, 0);
  assert("deleteSlice: -1 slice", deleted.length === 3);
}

function testRenameSlice() {
  const slices = equalSlice(4);
  const renamed = renameSlice(slices, 0, "KICK");
  assert("renameSlice: name changed", renamed[0].name === "KICK");
}

function testColorSlice() {
  const slices = equalSlice(4);
  const colored = colorSlice(slices, 0, "#ff0000");
  assert("colorSlice: color set", colored[0].color === "#ff0000");
}

function testSliceRegion() {
  const slices = equalSlice(4);
  const region = sliceRegion(slices, 0);
  assert("sliceRegion: start 0", region?.start === 0);
  assert("sliceRegion: end = next slice start", region?.end === 0.25);
}

function testSlicesToSteps() {
  const slices = equalSlice(4);
  const steps = slicesToSteps(slices, 16);
  assert("slicesToSteps: 16 steps", steps.length === 16);
  assert("slicesToSteps: step 0 active", steps[0].on);
  assert("slicesToSteps: step 4 active", steps[4].on);
  assert("slicesToSteps: step 1 inactive", !steps[1].on);
}

// ─── Loop Engine Tests ─────────────────────────────────────────────────────────

function testBarsToSamples() {
  const s = barsToSamples(120, 1, 44100);
  // 120 BPM = 0.5s/beat, 4 beats/bar = 2s, 2 * 44100 = 88200
  assert("barsToSamples: 120 BPM 1 bar", s === 88200);
}

function testSnapLoopToBars() {
  const result = snapLoopToBars(88100, 120, 44100);
  assert("snapLoopToBars: snaps to 1 bar", result.bars === 1);
}

function testExtractLoopRegion() {
  const pcm = makeSinePCM(440, 0.2);
  const region = extractLoopRegion(pcm, 0.25, 0.75);
  assert("extractLoopRegion: half length", approx(region.channels[0].length, pcm.channels[0].length * 0.5, 10));
}

function testApplyLoopCrossfade() {
  const pcm = makeSinePCM(440, 0.1);
  const xfaded = applyLoopCrossfade(pcm, 4);
  assert("applyLoopCrossfade: same length", xfaded.channels[0].length === pcm.channels[0].length);
}

function testMakePingPongLoop() {
  const pcm = makeSinePCM(440, 0.1);
  const pp = makePingPongLoop(pcm);
  assert("makePingPongLoop: double length", approx(pp.channels[0].length, pcm.channels[0].length * 2, 10));
}

// ─── AI Assistant Tests ────────────────────────────────────────────────────────

function testClassifyDrum() {
  // Low-frequency short = kick-like
  const kick = makeSinePCM(60, 0.05);
  const cls = classifyDrum(kick);
  assert("classifyDrum: returns class", typeof cls.class === "string");
  assert("classifyDrum: confidence 0..1", cls.confidence >= 0 && cls.confidence <= 1);
}

function testClassifyInstrument() {
  const drum = makeSinePCM(80, 0.05);
  const inst = classifyInstrument(drum);
  assert("classifyInstrument: returns class", typeof inst.class === "string");
}

function testSuggestSlices() {
  const clicks = makeClickPCM(44100);
  const sugg = suggestSlices(clicks);
  assert("suggestSlices: returns slices", sugg.slices.length > 0);
  assert("suggestSlices: has rationale", typeof sugg.rationale === "string");
}

function testSuggestLoopPoints() {
  const pcm = makeSinePCM(440, 0.5);
  const loop = suggestLoopPoints(pcm);
  assert("suggestLoopPoints: start >= 0", loop.startNorm >= 0);
  assert("suggestLoopPoints: end <= 1", loop.endNorm <= 1);
}

function testGenerateSampleTags() {
  const pcm = makeSinePCM(80, 0.05);
  const tags = generateSampleTags(pcm);
  assert("generateSampleTags: returns array", Array.isArray(tags));
  assert("generateSampleTags: has tags", tags.length > 0);
}

function testFingerprint() {
  const pcm = makeSinePCM(440, 0.5);
  const fp = computeFingerprint(pcm);
  const fp2 = computeFingerprint(pcm);
  assert("computeFingerprint: same input → same fingerprint", fingerprintSimilarity(fp, fp2) > 0.9);
}

function testFindSimilarSamples() {
  const pcm = makeSinePCM(440, 0.5);
  const target = computeFingerprint(pcm);
  const library = [computeFingerprint(makeSinePCM(440, 0.5)), computeFingerprint(makeSinePCM(100, 0.1))];
  const similar = findSimilarSamples(target, library, 5);
  assert("findSimilarSamples: returns sorted", similar.length > 0);
  assert("findSimilarSamples: best match is self (index 0)", similar[0].idx === 0);
}

// ─── Edge-case tests (Review fixes A-2, A-3, A-4, A-5, L-1, AI-2) ──────────────

function testCutRegionEmpty() {
  // A-2: empty region (startNorm === endNorm) must not throw RangeError
  const pcm = makeSinePCM(440, 0.2);
  let threw = false;
  try {
    const { cut, rest } = cutRegion(pcm, 0.5, 0.5);
    assert("cutRegion empty: cut is 0-length", cut.channels[0].length === 0);
    assert("cutRegion empty: rest is full length", rest.channels[0].length === pcm.channels[0].length);
  } catch (e) { threw = true; }
  assert("cutRegion empty: no RangeError", !threw);
}

function testCutRegionFullBuffer() {
  // A-1: cutting the entire buffer — rest should be 0-length, not 1 spurious sample
  const pcm = makeSinePCM(440, 0.1);
  const { cut, rest } = cutRegion(pcm, 0, 1);
  assert("cutRegion full: cut = original length", cut.channels[0].length === pcm.channels[0].length);
  assert("cutRegion full: rest is 0-length", rest.channels[0].length === 0);
}

function testCutRegionStartZero() {
  // Edge: region starts at sample 0
  const pcm = makeSinePCM(440, 0.1);
  const { cut, rest } = cutRegion(pcm, 0, 0.5);
  assert("cutRegion start=0: cut is half", approx(cut.channels[0].length, pcm.channels[0].length * 0.5, 2));
  assert("cutRegion start=0: rest is half", approx(rest.channels[0].length, pcm.channels[0].length * 0.5, 2));
}

function testCutRegionEndLast() {
  // Edge: region ends at last sample
  const pcm = makeSinePCM(440, 0.1);
  const { cut, rest } = cutRegion(pcm, 0.5, 1);
  assert("cutRegion end=1: cut is half", approx(cut.channels[0].length, pcm.channels[0].length * 0.5, 2));
  assert("cutRegion end=1: rest is half", approx(rest.channels[0].length, pcm.channels[0].length * 0.5, 2));
}

function testCutRegionLengthOne() {
  // Edge: region with length 1 sample
  const pcm = makeSinePCM(440, 0.01);
  const L = pcm.channels[0].length;
  if (L > 2) {
    const { cut } = cutRegion(pcm, 0.5, 0.5 + 1 / L);
    assert("cutRegion len=1: cut is 1 sample", cut.channels[0].length === 1);
  }
}

function testCrossfadeShortBuffers() {
  // A-3: very short buffers must not cause RangeError or NaN
  const short: PCM = { channels: [new Float32Array(10).fill(0.5)], sampleRate: 44100 };
  let threw = false;
  let hasNaN = false;
  try {
    const result = crossfadeBuffers(short, short, 0.05);
    for (let i = 0; i < result.channels[0].length; i++) {
      if (Number.isNaN(result.channels[0][i])) { hasNaN = true; break; }
    }
    assert("crossfade short: no RangeError", true);
  } catch (e) { threw = true; }
  assert("crossfade short: no throw", !threw);
  assert("crossfade short: no NaN in output", !hasNaN);
}

function testCrossfadeEmptyBuffer() {
  // A-3 edge: 0-length buffer
  const empty: PCM = { channels: [new Float32Array(0)], sampleRate: 44100 };
  const full = makeSinePCM(440, 0.1);
  let threw = false;
  try {
    const r1 = crossfadeBuffers(empty, full);
    assert("crossfade empty+full: returns full", r1.channels[0].length === full.channels[0].length);
    const r2 = crossfadeBuffers(full, empty);
    assert("crossfade full+empty: returns full", r2.channels[0].length === full.channels[0].length);
  } catch (e) { threw = true; }
  assert("crossfade empty: no throw", !threw);
}

function testStereoToMonoZeroChannel() {
  // A-4: 0-channel PCM must not crash
  const zero: PCM = { channels: [], sampleRate: 44100 };
  let threw = false;
  try {
    const mono = stereoToMono(zero);
    assert("stereoToMono 0ch: returns 1 channel", mono.channels.length === 1);
  } catch (e) { threw = true; }
  assert("stereoToMono 0ch: no TypeError", !threw);
}

function testMonoToStereoZeroChannel() {
  // A-5: 0-channel PCM must not crash
  const zero: PCM = { channels: [], sampleRate: 44100 };
  let threw = false;
  try {
    const stereo = monoToStereo(zero);
    assert("monoToStereo 0ch: returns 2 channels", stereo.channels.length === 2);
  } catch (e) { threw = true; }
  assert("monoToStereo 0ch: no TypeError", !threw);
}

function testApplyLoopCrossfadeNoSilenceDip() {
  // L-1: verify the linear crossfade puts the HEAD value at the splice point.
  // With the old full-Hann window, g=0 at i=fadeLen-1, so the last sample was
  // the TAIL value (no head mixed in → discontinuity on loop wrap).
  // With the linear fix, g=1 at i=fadeLen-1, so the last sample IS the head.
  const sr = 44100;
  const len = Math.floor(sr * 0.1);
  const fadeLen = Math.max(16, Math.floor((4 / 1000) * sr));
  const ch = new Float32Array(len);
  // Head (first fadeLen samples) = 0.9, tail = 0.1 — different values
  // so we can detect which one ends up at the splice point.
  for (let i = 0; i < fadeLen; i++) ch[i] = 0.9;
  for (let i = fadeLen; i < len; i++) ch[i] = 0.1;
  const pcm: PCM = { channels: [ch], sampleRate: sr };
  const xfaded = applyLoopCrossfade(pcm, 4);
  const lastVal = xfaded.channels[0][xfaded.channels[0].length - 1];
  // Linear: last = src[fadeLen-1] = 0.9 (head). Old Hann: last = src[L-1] = 0.1 (tail).
  assert("loopCrossfade L-1: last sample = head value (0.9)", approx(lastVal, 0.9, 0.02));
}

function testSuggestLoopPointsEmpty() {
  // AI-2: 0-length PCM must not produce NaN endNorm
  const empty: PCM = { channels: [new Float32Array(0)], sampleRate: 44100 };
  let threw = false;
  try {
    const loop = suggestLoopPoints(empty);
    assert("suggestLoopPoints empty: no NaN endNorm", !Number.isNaN(loop.endNorm));
    assert("suggestLoopPoints empty: endNorm >= 0", loop.endNorm >= 0);
  } catch (e) { threw = true; }
  assert("suggestLoopPoints empty: no throw", !threw);
}

function testSliceEngineEdgeCases() {
  // Slice 0 edge case
  const slices = equalSlice(4);
  const r0 = sliceRegion(slices, 0);
  assert("sliceRegion idx=0: start=0", r0?.start === 0);

  // Last slice edge case
  const rLast = sliceRegion(slices, slices.length - 1);
  assert("sliceRegion last: end=1", rLast?.end === 1);

  // Merge first slice
  const merged0 = mergeSlices(slices, 0);
  assert("mergeSlices idx=0: reduces by 1", merged0.length === slices.length - 1);

  // Merge last slice (should be no-op since idx >= length-1)
  const mergedLast = mergeSlices(slices, slices.length - 1);
  assert("mergeSlices last: no-op", mergedLast.length === slices.length);

  // Out-of-bounds indices
  assert("sliceRegion OOB: null", sliceRegion(slices, -1) === null);
  assert("sliceRegion OOB: null", sliceRegion(slices, 999) === null);
  assert("deleteSlice OOB: no-op", deleteSlice(slices, -1).length === slices.length);
  assert("mergeSlices OOB: no-op", mergeSlices(slices, -1).length === slices.length);
}

// ─── Run all tests ─────────────────────────────────────────────────────────────

export function runSampleForgeTests(): {
  passed: number; failed: number; total: number; results: TestResult[];
} {
  results.length = 0;

  // Analysis
  testComputePeak();
  testComputeRMS();
  testComputeCrest();
  testDCOffset();
  testDetectClipping();
  testLoudness();
  testDetectBPM();
  testDetectFundamental();
  testDetectKey();
  testAnalyzeSample();

  // Editor
  testCopyRegion();
  testCutRegion();
  testDeleteRegion();
  testPasteRegion();
  testInsertSilence();
  testSilenceRegion();
  testMergeBuffers();
  testSplitAt();
  testApplyGain();
  testNormalizePCM();
  testReversePCM();
  testCrossfade();
  testStereoToMono();

  // Slice Engine
  testEqualSlice();
  testAutoSlice();
  testAddSlice();
  testMergeSlices();
  testSplitSlice();
  testDeleteSlice();
  testRenameSlice();
  testColorSlice();
  testSliceRegion();
  testSlicesToSteps();

  // Loop Engine
  testBarsToSamples();
  testSnapLoopToBars();
  testExtractLoopRegion();
  testApplyLoopCrossfade();
  testMakePingPongLoop();

  // AI Assistant
  testClassifyDrum();
  testClassifyInstrument();
  testSuggestSlices();
  testSuggestLoopPoints();
  testGenerateSampleTags();
  testFingerprint();
  testFindSimilarSamples();

  // Edge-case tests (Review fixes)
  testCutRegionEmpty();
  testCutRegionFullBuffer();
  testCutRegionStartZero();
  testCutRegionEndLast();
  testCutRegionLengthOne();
  testCrossfadeShortBuffers();
  testCrossfadeEmptyBuffer();
  testStereoToMonoZeroChannel();
  testMonoToStereoZeroChannel();
  testApplyLoopCrossfadeNoSilenceDip();
  testSuggestLoopPointsEmpty();
  testSliceEngineEdgeCases();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__sampleForgeTestResults = { passed, failed, total: results.length, results };
  }

  return { passed, failed, total: results.length, results };
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runSampleForgeTests = runSampleForgeTests;
}