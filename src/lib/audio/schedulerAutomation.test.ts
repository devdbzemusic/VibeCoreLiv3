import { beforeEach, describe, expect, it } from "vitest";
import { buildDefaultParts, type Pattern, type Scene } from "@/lib/model";
import { useGroove } from "@/lib/store";
import { scheduleStepAutomation } from "./engine";
import { scheduleTickAt, type PartTrigger } from "./scheduler";

const lpFreq = (cutoff: number) => 200 * Math.pow(100, cutoff / 100);

describe("step automation hand-off", () => {
  beforeEach(() => {
    const state = useGroove.getState();
    useGroove.setState({ arp: { ...state.arp, enabled: false } });
  });

  it("forwards filter and pan automation from a Step to both step and Piano-Roll triggers", () => {
    const part = buildDefaultParts()[0];
    const scene: Scene = {
      id: "automation-scene",
      length: 2,
      partSteps: {
        [part.id]: [
          {
            on: true, velocity: 104, probability: 100, gate: 50, ratchet: 1,
            micro: 0, accent: false, filterCutoff: 28, panOffset: -18,
          },
          { on: false, velocity: 100, probability: 100, gate: 50, ratchet: 1, micro: 0, accent: false },
        ],
      },
      partNotes: {
        [part.id]: [{ id: "roll-note", step: 0, pitch: 64, length: 1, velocity: 91 }],
      },
    };
    const pattern: Pattern = { id: 0, name: "automation", seed: 1, swing: 50, scenes: [scene] };
    const calls: Array<{ partId: number; when: number; opts: Parameters<PartTrigger>[2] }> = [];
    const capture: PartTrigger = (partId, when, opts) => calls.push({ partId, when, opts });

    scheduleTickAt(1, 0, pattern, scene, 0, 120, [part], capture);

    expect(calls).toHaveLength(2);
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        partId: part.id,
        opts: expect.objectContaining({ filterCutoff: 28, panOffset: -18 }),
      }),
    ]));
    expect(calls.map((call) => ({
      filterCutoff: call.opts.filterCutoff,
      panOffset: call.opts.panOffset,
    }))).toEqual([
      { filterCutoff: 28, panOffset: -18 },
      { filterCutoff: 28, panOffset: -18 },
    ]);
  });

  it("returns missing step values to channel defaults on the next scheduled trigger", () => {
    const lowPassWrites: number[] = [];
    const panWrites: number[] = [];
    const targets = {
      lowPassFrequency: {
        setTargetAtTime: (value: number) => { lowPassWrites.push(value); },
      },
      pan: {
        setTargetAtTime: (value: number) => { panWrites.push(value); },
      },
    };
    const part = { channel: { lpCut: 62 }, pan: 10 };

    scheduleStepAutomation(targets, part, 1, { filterCutoff: 28, panOffset: -18 });
    scheduleStepAutomation(targets, part, 1.125, {});

    expect(lowPassWrites).toEqual([lpFreq(28), lpFreq(62)]);
    expect(panWrites).toEqual([-0.16, 0.2]);
  });
});