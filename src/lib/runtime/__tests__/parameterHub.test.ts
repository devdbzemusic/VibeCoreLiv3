import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGroove } from "@/lib/store";
import {
  beginParameterGesture,
  endParameterGesture,
  getParameter,
  getParameterDescriptor,
  setParameter,
  subscribeParameter,
} from "@/lib/parameters/hub";

let baseline: ReturnType<typeof useGroove.getState>;

beforeEach(() => {
  baseline = useGroove.getState();
});

describe("ParameterHub v1", () => {
  it("reads canonical store values instead of owning a duplicate state", () => {
    expect(getParameter("transport.bpm")).toBe(useGroove.getState().bpm);
    expect(getParameter("master.volume")).toBe(useGroove.getState().masterVolume);
  });

  it("describes persistent realtime parameter domains", () => {
    expect(getParameterDescriptor("transport.bpm")).toMatchObject({
      min: 20,
      max: 300,
      unit: "BPM",
      persistent: true,
      realtime: true,
    });
    expect(getParameterDescriptor("part.0.pan")).toMatchObject({ min: -50, max: 50 });
  });

  it("writes through existing canonical actions and clamps domains", () => {
    expect(setParameter("transport.bpm", 999)).toBe(true);
    expect(useGroove.getState().bpm).toBe(300);

    expect(setParameter("master.volume", -20)).toBe(true);
    expect(useGroove.getState().masterVolume).toBe(0);

    useGroove.getState().setBpm(baseline.bpm);
    useGroove.getState().setMasterVolume(baseline.masterVolume);
  });

  it("rejects writes for a part that does not exist", () => {
    expect(setParameter("part.999.volume", 50)).toBe(false);
  });

  it("subscribes to one parameter and ignores unrelated store updates", () => {
    const listener = vi.fn();
    const unsub = subscribeParameter("transport.bpm", listener);

    useGroove.getState().setMasterVolume(Math.max(0, baseline.masterVolume - 1));
    expect(listener).not.toHaveBeenCalled();

    const nextBpm = baseline.bpm === 121 ? 122 : 121;
    useGroove.getState().setBpm(nextBpm);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(nextBpm, baseline.bpm);

    unsub();
    useGroove.getState().setBpm(baseline.bpm);
    useGroove.getState().setMasterVolume(baseline.masterVolume);
  });

  it("keeps gesture hooks stateless in v1", () => {
    expect(beginParameterGesture("master.volume")).toBeUndefined();
    expect(endParameterGesture("master.volume")).toBeUndefined();
  });
});
