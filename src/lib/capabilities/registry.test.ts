import { describe, expect, it } from "vitest";
import {
  getCapability,
  hasCapability,
  listCapabilities,
  listCapabilitiesByArea,
} from "./registry";

describe("capability registry", () => {
  it("contains unique capability ids", () => {
    const ids = listCapabilities().map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks implemented and planned v4 capabilities separately", () => {
    expect(hasCapability("sync.master-clock")).toBe(true);
    expect(hasCapability("remix.audio-input")).toBe(false);
    expect(hasCapability("remix.audio-input", "planned")).toBe(true);
  });

  it("returns defensive copies", () => {
    const capability = getCapability("android.native-oboe");
    expect(capability?.status).toBe("ready");
    if (capability) capability.status = "blocked";
    expect(getCapability("android.native-oboe")?.status).toBe("ready");
  });

  it("can list capabilities by area", () => {
    expect(listCapabilitiesByArea("ai").map((capability) => capability.id)).toContain("ai.intent-layer");
  });
});
