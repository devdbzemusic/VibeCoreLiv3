import { describe, expect, it } from "vitest";
import {
  getCapability,
  probeRuntimeCapability,
  runtimeCapabilitySnapshot,
  type RuntimeCapabilityId,
} from "@/lib/capabilities/registry";

const RUNTIME_IDS: RuntimeCapabilityId[] = [
  "audio.web",
  "audio.native",
  "audio.lowLatency.native",
  "audio.input.web",
  "preview.buffer.web",
  "preview.buffer.native",
  "instrument.synth3d.web",
  "instrument.synth3d.native",
  "instrument.bass3d.web",
  "instrument.bass3d.native",
  "voice.native",
  "voice.liveInput.native",
  "midi.input.web",
  "storage.indexeddb",
];

describe("Capability Registry runtime contract", () => {
  it("returns one probe for every declared runtime capability", () => {
    const snapshot = runtimeCapabilitySnapshot();
    expect(Object.keys(snapshot).sort()).toEqual([...RUNTIME_IDS].sort());
    for (const id of RUNTIME_IDS) {
      expect(snapshot[id].id).toBe(id);
      expect(typeof snapshot[id].available).toBe("boolean");
    }
  });

  it("keeps Native 3D Synth unavailable until a dedicated renderer exists", () => {
    const capability = probeRuntimeCapability("instrument.synth3d.native");
    expect(capability.available).toBe(false);
    expect(capability.reason).toMatch(/No dedicated Native 3D Synth/i);
  });

  it("does not reserve a Native Voice slot as an implicit preview channel", () => {
    const capability = probeRuntimeCapability("preview.buffer.native");
    expect(capability.available).toBe(false);
    expect(capability.reason).toMatch(/No dedicated Native preview-buffer contract/i);
  });

  it("records ParameterHub v1 as partial rather than complete", () => {
    const capability = getCapability("parameter.authoritative-hub");
    expect(capability?.status).toBe("partial");
    expect(capability?.owner).toContain("src/lib/parameters/hub.ts");
  });
});
