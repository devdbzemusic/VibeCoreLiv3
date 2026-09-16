import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGroove } from "@/lib/store";
import {
  beginParameterGesture,
  endParameterGesture,
  getParameter,
  setParameter,
  subscribeParameter,
} from "@/lib/runtime/parameterHub";

let baseline: ReturnType<typeof useGroove.getState>;

beforeEach(() => {
  baseline = useGroove.getState();
});

describe("ParameterHub v1", () => {
  it("reads canonical store values instead of owning a duplicate state", () => {
    expect(getParameter("transport.bpm")).toBe(useGroove.getState().bpm);
    expect(getParameter("master.volume")).toBe(useGroove.getState().masterVolume);
  });

  it("writes through existing canonical actions and clamps domains", () => {
    expect(setParameter("transport.bpm", 999)).toBe(true);
    expect(useGroove.getState().bpm).toBe(300);

    expect(setParameter("master.volume", -20)).toBe(true);
    expect(useGroove.getState().masterVolume).toBe(0);

    // restore values used by the surrounding suite
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
    expect(listener).toHaveBeenLastCalledWith(nextBpm);

    unsub();
    useGroove.getState().setBpm(baseline.bpm);
    useGroove.getState().setMasterVolume(baseline.masterVolume);
  });

  it("uses gesture tokens as correlation metadata only", () => {
    const gesture = beginParameterGesture("master.volume");
    expect(gesture.parameter).toBe("master.volume");
    expect(gesture.id).toBeGreaterThan(0);
    expect(() => endParameterGesture(gesture)).not.toThrow();
  });
});
