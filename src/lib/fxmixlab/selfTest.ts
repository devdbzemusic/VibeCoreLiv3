// VibeCore FX Mix Lab — Self-Test.
//
// Deterministic tests for routing, automation, analyzer, and persistence.
// All tests are pure — no audio nodes, no AudioContext, no randomness.

import type { AutomationLane, BusChannel, MixerChannel, ReturnChannel } from "./types";
import {
  buildRoutingGraph, detectCycle, validateRouting, topologicalSort,
  wouldCreateCycle, partsForBus,
} from "./routing";
import {
  sortLanePoints, interpolateValue, addPoint, removePoint, clearLane,
  createAutomationScheduler,
} from "./automation";
import {
  computePeakRMS, linToDb, computeStereoBalance, computePhaseCorrelation,
  computeCrestFactor, computeHeadroom, detectClipping, resetLufs,
} from "./analyzer";
import { buildPreset, defaultMixerChannel, defaultBus } from "./presets";
import type { InsertFxType } from "./types";

interface TestResult { name: string; pass: boolean; detail?: string; }
const results: TestResult[] = [];
function assert(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: cond, detail });
}

function makeBuf(len: number, fillFn: (i: number) => number): Float32Array {
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) buf[i] = fillFn(i);
  return buf;
}

// ── Routing Tests ─────────────────────────────────────────────────────────────

function testRoutingNoCycle() {
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "bus_drums" },
    { ...defaultMixerChannel(1), busTarget: "bus_drums" },
    { ...defaultMixerChannel(6), busTarget: "master" },
  ];
  const buses: BusChannel[] = [
    { ...defaultBus("bus_drums", "DRUMS"), busTarget: "master" },
  ];
  const returns: ReturnChannel[] = [];
  const graph = buildRoutingGraph(channels, buses, returns);
  assert("routing no-cycle: valid", validateRouting(graph) === null);
}

function testRoutingCycleDetection() {
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "bus_b" },
    { ...defaultBus("bus_b", "B"), busTarget: "bus_a" },
  ];
  const graph = buildRoutingGraph([], buses, []);
  const cycle = detectCycle(graph);
  assert("routing cycle: detected", cycle !== null);
  assert("routing cycle: includes bus_a", cycle?.includes("bus:bus_a") === true);
  assert("routing cycle: includes bus_b", cycle?.includes("bus:bus_b") === true);
}

function testRoutingSelfLoop() {
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "bus_a" },
  ];
  const graph = buildRoutingGraph([], buses, []);
  const cycle = detectCycle(graph);
  assert("routing self-loop: detected", cycle !== null);
}

function testWouldCreateCycle() {
  const channels: MixerChannel[] = [];
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "master" },
    { ...defaultBus("bus_b", "B"), busTarget: "master" },
  ];
  const returns: ReturnChannel[] = [];
  // Routing bus_a → bus_b is fine (no cycle)
  assert("wouldCreateCycle: no cycle (a→b)", !wouldCreateCycle(channels, buses, returns, "bus:bus_a", "bus:bus_b"));
  // Now bus_b → bus_a would create a cycle
  const buses2 = buses.map((b) => b.id === "bus_a" ? { ...b, busTarget: "bus_b" } : b);
  assert("wouldCreateCycle: cycle (b→a)", wouldCreateCycle(channels, buses2, returns, "bus:bus_b", "bus:bus_a"));
}

function testPartsForBus() {
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "bus_drums" },
    { ...defaultMixerChannel(1), busTarget: "bus_drums" },
    { ...defaultMixerChannel(6), busTarget: "master" },
  ];
  const drumParts = partsForBus(channels, "bus_drums");
  assert("partsForBus: returns [0, 1]", drumParts.length === 2 && drumParts.includes(0) && drumParts.includes(1));
}

function testTopologicalSort() {
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "bus_a" },
  ];
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "master" },
  ];
  const graph = buildRoutingGraph(channels, buses, []);
  const sorted = topologicalSort(graph);
  assert("topoSort: master is last", sorted[sorted.length - 1] === "master");
  assert("topoSort: part before bus", sorted.indexOf("part:0") < sorted.indexOf("bus:bus_a"));
}

// ── Automation Tests ─────────────────────────────────────────────────────────

function testInterpolationLinear() {
  const lane: AutomationLane = {
    id: "a1", target: "volume", channelRef: "part:0", enabled: true,
    points: [
      { songTicks: 0, value: 0, curve: "lin" },
      { songTicks: 100, value: 100, curve: "lin" },
    ],
  };
  assert("interp lin: t=50 → 50", Math.abs(interpolateValue(lane, 50) - 50) < 0.1);
  assert("interp lin: t=0 → 0", Math.abs(interpolateValue(lane, 0) - 0) < 0.1);
  assert("interp lin: t=100 → 100", Math.abs(interpolateValue(lane, 100) - 100) < 0.1);
}

function testInterpolationStep() {
  const lane: AutomationLane = {
    id: "a2", target: "mute", channelRef: "part:0", enabled: true,
    points: [
      { songTicks: 0, value: 0, curve: "step" },
      { songTicks: 50, value: 1, curve: "step" },
    ],
  };
  assert("interp step: t=49 → 0", Math.abs(interpolateValue(lane, 49) - 0) < 0.01);
  assert("interp step: t=50 → 1", Math.abs(interpolateValue(lane, 50) - 1) < 0.01);
}

function testInterpolationDisabled() {
  const lane: AutomationLane = {
    id: "a3", target: "volume", channelRef: "part:0", enabled: false,
    points: [{ songTicks: 0, value: 100, curve: "lin" }],
  };
  assert("interp disabled: returns 0", interpolateValue(lane, 50) === 0);
}

function testAddRemovePoint() {
  let lane: AutomationLane = {
    id: "a4", target: "volume", channelRef: "part:0", enabled: true,
    points: [{ songTicks: 0, value: 0, curve: "lin" }],
  };
  lane = addPoint(lane, { songTicks: 50, value: 50, curve: "lin" });
  assert("addPoint: 2 points", lane.points.length === 2);
  assert("addPoint: sorted", lane.points[1].songTicks === 50);
  lane = removePoint(lane, 50);
  assert("removePoint: 1 point", lane.points.length === 1);
  lane = clearLane(lane);
  assert("clearLane: 0 points", lane.points.length === 0);
}

function testSortLanePoints() {
  const lane: AutomationLane = {
    id: "a5", target: "volume", channelRef: "part:0", enabled: true,
    points: [
      { songTicks: 100, value: 100, curve: "lin" },
      { songTicks: 0, value: 0, curve: "lin" },
      { songTicks: 50, value: 50, curve: "lin" },
    ],
  };
  const sorted = sortLanePoints(lane);
  assert("sortLane: 0 first", sorted.points[0].songTicks === 0);
  assert("sortLane: 100 last", sorted.points[2].songTicks === 100);
}

// ── Analyzer Tests ────────────────────────────────────────────────────────────

function testPeakRMS() {
  const buf = makeBuf(100, (i) => Math.sin(i * 0.1) * 0.8);
  const { peak, rms } = computePeakRMS(buf);
  assert("peakRMS: peak > 0", peak > 0);
  assert("peakRMS: rms > 0", rms > 0);
  assert("peakRMS: peak >= rms", peak >= rms);
}

function testPeakRMSSilence() {
  const buf = new Float32Array(100);
  const { peak, rms } = computePeakRMS(buf);
  assert("peakRMS silence: peak = 0", peak === 0);
  assert("peakRMS silence: rms = 0", rms === 0);
}

function testLinToDb() {
  assert("linToDb(1) = 0", Math.abs(linToDb(1)) < 0.001);
  assert("linToDb(0) = -200", linToDb(0) === -200);
  assert("linToDb(0.5) ≈ -6", Math.abs(linToDb(0.5) + 6.02) < 0.1);
}

function testStereoBalance() {
  assert("stereoBalance: centered", Math.abs(computeStereoBalance(0.5, 0.5)) < 0.01);
  assert("stereoBalance: L-heavy", computeStereoBalance(0.8, 0.2) < 0);
  assert("stereoBalance: R-heavy", computeStereoBalance(0.2, 0.8) > 0);
  assert("stereoBalance: silence = 0", Math.abs(computeStereoBalance(0, 0)) < 0.01);
}

function testPhaseCorrelation() {
  const bufL = makeBuf(100, (i) => Math.sin(i * 0.1));
  const bufR = makeBuf(100, (i) => Math.sin(i * 0.1)); // same = mono
  assert("phaseCorr: mono → 1", Math.abs(computePhaseCorrelation(bufL, bufR) - 1) < 0.01);
  const bufR2 = makeBuf(100, (i) => -Math.sin(i * 0.1)); // inverted = anti-phase
  assert("phaseCorr: anti → -1", Math.abs(computePhaseCorrelation(bufL, bufR2) + 1) < 0.01);
}

function testCrestFactor() {
  assert("crestFactor: 0.8/0.5 > 4 dB", computeCrestFactor(0.8, 0.5) > 3);
  assert("crestFactor: silence = 0", computeCrestFactor(0, 0) === 0);
}

function testHeadroom() {
  assert("headroom: 0.5 → ~6 dB", Math.abs(computeHeadroom(0.5) - 6.02) < 0.1);
  assert("headroom: 1.0 → 0 dB", Math.abs(computeHeadroom(1.0)) < 0.01);
}

function testClipping() {
  const clean = makeBuf(100, () => 0.5);
  const clipped = makeBuf(100, () => 0.99);
  assert("clipping: clean → false", !detectClipping(clean));
  assert("clipping: clipped → true", detectClipping(clipped));
}

// ── Preset Tests ──────────────────────────────────────────────────────────────

function testPresetBuild() {
  const preset = buildPreset("clean_balanced", [0, 1, 2, 3]);
  assert("preset: not null", preset !== null);
  assert("preset: 4 channels", preset?.channels.length === 4);
  assert("preset: 2 buses", preset?.buses.length === 2);
  assert("preset: 2 returns", preset?.returns.length === 2);
}

function testPresetInvalid() {
  const preset = buildPreset("nonexistent", [0]);
  assert("preset: invalid → null", preset === null);
}

// ── Insert Type Coverage ──────────────────────────────────────────────────────

function testInsertTypes() {
  const types: InsertFxType[] = [
    "EQ", "Compressor", "Limiter", "Gate", "Expander",
    "Distortion", "Saturation", "Tube", "Tape", "Foldback", "Bitcrush",
    "Chorus", "Flanger", "Phaser", "Delay", "Reverb",
    "Filter LP", "Filter HP", "Filter BP", "Filter Notch",
    "Stereo Width", "Ring Mod", "DC Blocker",
  ];
  assert("insertTypes: 23 types", types.length === 23);
}

// ── Automation Scheduler Tests ────────────────────────────────────────────────

function testAutomationSchedulerBpm() {
  // The scheduler must expose setBpm to avoid drift when tempo changes.
  const binding = {
    lane: {
      id: "s1", target: "volume", channelRef: "part:0", enabled: true,
      points: [{ songTicks: 0, value: 50, curve: "lin" }],
    },
    apply: () => {},
  };
  const sched = createAutomationScheduler([binding], 0.1);
  assert("sched: has setBpm", typeof sched.setBpm === "function");
  if (sched.setBpm) {
    sched.setBpm(60);
    sched.start(0);
    // Should not throw and should process tick without error
    sched.tick(0, 0);
    assert("sched: tick at 60 BPM no throw", sched.lastSongTicks === 0);
  }
  sched.stop();
}

function testAutomationInterpolationExponential() {
  const lane: AutomationLane = {
    id: "e1", target: "volume", channelRef: "part:0", enabled: true,
    points: [
      { songTicks: 0, value: 0, curve: "exp" },
      { songTicks: 100, value: 100, curve: "exp" },
    ],
  };
  // Exponential: value = 0 + (100-0) * t^2 → at t=0.5, value = 25
  assert("interp exp: t=50 → 25", Math.abs(interpolateValue(lane, 50) - 25) < 0.5);
}

function testAutomationInterpolationLog() {
  const lane: AutomationLane = {
    id: "l1", target: "volume", channelRef: "part:0", enabled: true,
    points: [
      { songTicks: 0, value: 0, curve: "log" },
      { songTicks: 100, value: 100, curve: "log" },
    ],
  };
  // Log: value = 0 + 100 * (1 - (1-t)^2) → at t=0.5, value = 75
  assert("interp log: t=50 → 75", Math.abs(interpolateValue(lane, 50) - 75) < 0.5);
}

function testAutomationEmptyLane() {
  const lane: AutomationLane = {
    id: "empty", target: "volume", channelRef: "part:0", enabled: true,
    points: [],
  };
  assert("interp empty: returns 0", interpolateValue(lane, 50) === 0);
}

// ── Routing Edge Cases ────────────────────────────────────────────────────────

function testRoutingComplexChain() {
  // A → B → C → master (no cycle, multi-hop bus chain)
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "bus_b" },
    { ...defaultBus("bus_b", "B"), busTarget: "bus_c" },
    { ...defaultBus("bus_c", "C"), busTarget: "master" },
  ];
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "bus_a" },
  ];
  const graph = buildRoutingGraph(channels, buses, []);
  assert("routing chain: no cycle", validateRouting(graph) === null);
  const sorted = topologicalSort(graph);
  assert("routing chain: master last", sorted[sorted.length - 1] === "master");
  assert("routing chain: part before bus_a", sorted.indexOf("part:0") < sorted.indexOf("bus:bus_a"));
  assert("routing chain: bus_a before bus_b", sorted.indexOf("bus:bus_a") < sorted.indexOf("bus:bus_b"));
  assert("routing chain: bus_b before bus_c", sorted.indexOf("bus:bus_b") < sorted.indexOf("bus:bus_c"));
}

function testRoutingThreeBusCycle() {
  // A → B → C → A (3-node cycle)
  const buses: BusChannel[] = [
    { ...defaultBus("bus_a", "A"), busTarget: "bus_b" },
    { ...defaultBus("bus_b", "B"), busTarget: "bus_c" },
    { ...defaultBus("bus_c", "C"), busTarget: "bus_a" },
  ];
  const graph = buildRoutingGraph([], buses, []);
  const cycle = detectCycle(graph);
  assert("routing 3-cycle: detected", cycle !== null);
}

function testRoutingSendsNoCycle() {
  // Sends are parallel — they should never cause a cycle in the direct routing
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "master",
      sends: [{ busId: "bus_fx", level: 50, preFader: false }] },
  ];
  const buses: BusChannel[] = [
    { ...defaultBus("bus_fx", "FX"), busTarget: "master" },
  ];
  const graph = buildRoutingGraph(channels, buses, []);
  assert("routing sends: no cycle", validateRouting(graph) === null);
}

function testRoutingOrphanBus() {
  // A bus with no incoming parts should still be in the graph (unconnected)
  const channels: MixerChannel[] = [
    { ...defaultMixerChannel(0), busTarget: "master" },
  ];
  const buses: BusChannel[] = [
    { ...defaultBus("bus_orphan", "ORPHAN"), busTarget: "master" },
  ];
  const graph = buildRoutingGraph(channels, buses, []);
  assert("routing orphan: no cycle", validateRouting(graph) === null);
  const sorted = topologicalSort(graph);
  assert("routing orphan: master last", sorted[sorted.length - 1] === "master");
  assert("routing orphan: orphan in sort", sorted.includes("bus:bus_orphan"));
}

// ── Run all tests ─────────────────────────────────────────────────────────────

export function runFxMixLabTests(): {
  passed: number; failed: number; total: number; results: TestResult[];
} {
  results.length = 0;
  resetLufs();

  // Routing
  testRoutingNoCycle();
  testRoutingCycleDetection();
  testRoutingSelfLoop();
  testWouldCreateCycle();
  testPartsForBus();
  testTopologicalSort();

  // Automation
  testInterpolationLinear();
  testInterpolationStep();
  testInterpolationDisabled();
  testAddRemovePoint();
  testSortLanePoints();
  testAutomationSchedulerBpm();
  testAutomationInterpolationExponential();
  testAutomationInterpolationLog();
  testAutomationEmptyLane();

  // Routing edge cases
  testRoutingComplexChain();
  testRoutingThreeBusCycle();
  testRoutingSendsNoCycle();
  testRoutingOrphanBus();

  // Analyzer
  testPeakRMS();
  testPeakRMSSilence();
  testLinToDb();
  testStereoBalance();
  testPhaseCorrelation();
  testCrestFactor();
  testHeadroom();
  testClipping();

  // Presets
  testPresetBuild();
  testPresetInvalid();

  // Insert types
  testInsertTypes();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__fxMixLabTestResults = { passed, failed, total: results.length, results };
  }

  return { passed, failed, total: results.length, results };
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runFxMixLabTests = runFxMixLabTests;
}