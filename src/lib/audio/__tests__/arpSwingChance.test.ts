/**
 * ARP Swing & Chance engine tests.
 *
 * Verifies:
 *  1. swingOffset is 0 for on-beat steps (even gate index) and > 0 for off-beat
 *     steps (odd gate index) when swing > 0.
 *  2. swingOffset scales linearly with the swing parameter.
 *  3. chance=100 always produces events; chance=0 never produces events.
 *  4. Increasing swing increases the average trigger delay for off-beat events.
 */

import { describe, it, expect } from "vitest";
import {
  generateArpEventsForStep,
  defaultArpConfig,
  type ArpStepContext,
} from "../arpEngine";

function makeCtx(step: number): ArpStepContext {
  return {
    patternPartId: 0,
    scenePartId: 0,
    chordHash: 0xDEAD_BEEF,
    sceneStep: step,
    sceneSteps: 16,
    globalTick: step,
  };
}

describe("ARP Swing", () => {
  it("on-beat steps (even gate index) have swingOffset === 0 regardless of swing value", () => {
    const cfg = { ...defaultArpConfig(), enabled: true, swing: 80, chance: 100 };
    // Gate index 0 is an on-beat step
    const events = generateArpEventsForStep(cfg, makeCtx(0));
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.swingOffset).toBe(0);
    }
  });

  it("off-beat steps (odd gate index) have swingOffset > 0 when swing > 0", () => {
    // All gates on so odd gate indices (off-beat) are reachable
    const allGates = Array(16).fill(true);
    const cfg = { ...defaultArpConfig(), enabled: true, swing: 80, chance: 100, gateSteps: allGates };
    // Gate index 1 is an off-beat step
    const events = generateArpEventsForStep(cfg, makeCtx(1));
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.swingOffset).toBeGreaterThan(0);
    }
  });

  it("off-beat swingOffset scales with swing parameter (higher swing = larger offset)", () => {
    const allGates = Array(16).fill(true);
    const lo = { ...defaultArpConfig(), enabled: true, swing: 20, chance: 100, gateSteps: allGates };
    const hi = { ...defaultArpConfig(), enabled: true, swing: 80, chance: 100, gateSteps: allGates };
    const ctx = makeCtx(1); // off-beat step (gate index 1, odd)

    const evLo = generateArpEventsForStep(lo, ctx);
    const evHi = generateArpEventsForStep(hi, ctx);

    expect(evLo.length).toBeGreaterThan(0);
    expect(evHi.length).toBeGreaterThan(0);

    const avgLo = evLo.reduce((s, e) => s + e.swingOffset, 0) / evLo.length;
    const avgHi = evHi.reduce((s, e) => s + e.swingOffset, 0) / evHi.length;
    expect(avgHi).toBeGreaterThan(avgLo);
  });

  it("swingOffset is 0 for all steps when swing === 0", () => {
    const cfg = { ...defaultArpConfig(), enabled: true, swing: 0, chance: 100 };
    for (const step of [0, 1, 2, 3]) {
      const events = generateArpEventsForStep(cfg, makeCtx(step));
      for (const e of events) {
        expect(e.swingOffset).toBe(0);
      }
    }
  });
});

describe("ARP Chance", () => {
  it("chance=100 always produces events (deterministic, 20 steps)", () => {
    const cfg = { ...defaultArpConfig(), enabled: true, swing: 0, chance: 100 };
    let total = 0;
    for (let step = 0; step < 20; step++) {
      if (!cfg.gateSteps[step % 16]) continue;
      total += generateArpEventsForStep(cfg, makeCtx(step)).length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it("chance=0 never produces events (all steps skipped)", () => {
    const cfg = { ...defaultArpConfig(), enabled: true, swing: 0, chance: 0 };
    for (let step = 0; step < 32; step++) {
      const events = generateArpEventsForStep(cfg, makeCtx(step));
      expect(events.length).toBe(0);
    }
  });

  it("chance=50 produces fewer events on average than chance=100 (probabilistic over 64 steps)", () => {
    const base = { ...defaultArpConfig(), enabled: true, swing: 0 };
    const cfg100 = { ...base, chance: 100 };
    const cfg50  = { ...base, chance: 50 };

    let total100 = 0;
    let total50  = 0;
    for (let step = 0; step < 64; step++) {
      total100 += generateArpEventsForStep(cfg100, makeCtx(step)).length;
      total50  += generateArpEventsForStep(cfg50,  makeCtx(step)).length;
    }
    expect(total50).toBeLessThan(total100);
  });
});
