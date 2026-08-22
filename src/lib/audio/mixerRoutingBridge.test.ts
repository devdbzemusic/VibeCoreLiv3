import { describe, expect, it, vi } from "vitest";
import { applyMixerRoutingSnapshot } from "./mixerRoutingBridge";

function controls() {
  return {
    routePartMainToBus: vi.fn(),
    setBusChannelLevel: vi.fn(),
  };
}

describe("mixer routing store bridge", () => {
  it("maps MASTER and BUS 1–6 assignments to the matching engine bus index", () => {
    const engine = controls();

    applyMixerRoutingSnapshot({
      partBusAssignments: {
        0: null,
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
      },
    }, engine);

    expect(engine.routePartMainToBus.mock.calls).toEqual([
      [0, null],
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 5],
    ]);
  });

  it("converts persisted bus percentages and preserves mute for the dedicated bus level control", () => {
    const engine = controls();

    applyMixerRoutingSnapshot({
      busLevels: [
        { volume: 100, mute: false },
        { volume: 37, mute: true },
        { volume: 0, mute: false },
        { volume: 82, mute: true },
        { volume: 55, mute: false },
        { volume: 12, mute: false },
      ],
    }, engine);

    expect(engine.setBusChannelLevel.mock.calls).toEqual([
      [0, 1, false],
      [1, 0.37, true],
      [2, 0, false],
      [3, 0.82, true],
      [4, 0.55, false],
      [5, 0.12, false],
    ]);
  });

  it("hydrates legacy per-Part targets without overriding saved assignments", () => {
    const engine = controls();

    applyMixerRoutingSnapshot({
      partBusAssignments: { 0: 2 },
      parts: [
        { id: 0, busTarget: 5 },
        { id: 1, busTarget: null },
        { id: 2 },
      ],
    }, engine);

    expect(engine.routePartMainToBus.mock.calls).toEqual([
      [0, 2],
      [1, null],
    ]);
  });

  it("reapplies restored assignments and levels to a reconstructed graph", () => {
    const engine = controls();
    const persistedState = {
      partBusAssignments: { 0: null, 4: 3, 9: 5 },
      busLevels: [
        { volume: 64, mute: false },
        { volume: 100, mute: true },
        { volume: 25, mute: false },
        { volume: 88, mute: false },
        { volume: 41, mute: true },
        { volume: 73, mute: false },
      ],
    };

    // A new engine graph receives the same hydrated snapshot as the original
    // graph; no AudioContext or hardware is needed to verify the bridge.
    applyMixerRoutingSnapshot(persistedState, engine);

    expect(engine.routePartMainToBus.mock.calls).toEqual([
      [0, null],
      [4, 3],
      [9, 5],
    ]);
    expect(engine.setBusChannelLevel.mock.calls).toHaveLength(6);
    expect(engine.setBusChannelLevel.mock.calls[4]).toEqual([4, 0.41, true]);
  });

  it("hydrates saved store assignments and levels before applying them to a new graph", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    });
    const { useGroove } = await import("@/lib/store");

    useGroove.getState().setPartBusAssignment(0, 4);
    useGroove.getState().setPartBusAssignment(1, null);
    useGroove.getState().setBusLevelAction(4, 63, true);
    const saved = storage.get("vibecore-liv3-project");
    expect(saved).toBeTruthy();

    useGroove.setState({
      partBusAssignments: {},
      busLevels: useGroove.getState().busLevels.map(() => ({ volume: 100, mute: false })),
    });
    storage.set("vibecore-liv3-project", saved!);
    await useGroove.persist.rehydrate();

    const restored = useGroove.getState();
    expect(restored.partBusAssignments).toMatchObject({ 0: 4, 1: null });
    expect(restored.busLevels[4]).toEqual({ volume: 63, mute: true });

    restored.toggleBusMute(4);
    expect(useGroove.getState().busLevels[4]).toEqual({ volume: 63, mute: false });
    restored.toggleBusMute(4);

    const engine = controls();
    applyMixerRoutingSnapshot(restored, engine);
    expect(engine.routePartMainToBus.mock.calls.slice(0, 2)).toEqual([
      [0, 4],
      [1, null],
    ]);
    expect(engine.setBusChannelLevel.mock.calls[4]).toEqual([4, 0.63, true]);
  });
});