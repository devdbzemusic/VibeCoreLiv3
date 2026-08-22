// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SmplTab } from "./SmplTab";
import { BUILTIN_FORGE_PRESETS } from "@/lib/forge/presets";
import { useGroove } from "@/lib/store";

const audio = vi.hoisted(() => ({
  ensureAudio: vi.fn(),
  getBuffer: vi.fn(),
  previewBuffer: vi.fn(),
  assignBufferToPart: vi.fn(),
}));
const forgeRender = vi.hoisted(() => ({
  renderPresetToAudioBuffer: vi.fn(),
}));

vi.mock("@/lib/audio/engine", () => audio);
vi.mock("@/lib/forge/render", () => forgeRender);
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const fakeContext = {} as AudioContext;
const fakeBuffer = {} as AudioBuffer;
const originalParts = useGroove.getState().parts;

describe("Forge preset browser flow", () => {
  beforeEach(() => {
    audio.ensureAudio.mockResolvedValue(fakeContext);
    audio.getBuffer.mockReturnValue(undefined);
    forgeRender.renderPresetToAudioBuffer.mockReturnValue(fakeBuffer);
    useGroove.setState({
      selectedPart: 0,
      parts: originalParts.map((part) => ({ ...part, sampleName: null })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps built-ins immutable while editing macros and sending the edited graph to a part", async () => {
    const builtInSnapshot = structuredClone(BUILTIN_FORGE_PRESETS);
    render(<SmplTab />);

    fireEvent.click(screen.getByRole("button", { name: "FORGE PRESETS" }));
    expect(screen.getByRole("heading", { name: "FORGE PRESETS" })).toBeTruthy();

    const macroLabels = [
      "SOURCE", "PITCH", "FILTER", "SHAPE",
      "HARMONICS", "SPATIAL", "EVOLUTION", "OUTPUT",
    ];
    const macros = macroLabels.map((label) => screen.getByRole("slider", { name: label }));
    expect(macros).toHaveLength(8);

    for (const macro of macros) {
      const before = Number(macro.getAttribute("aria-valuenow"));
      const min = Number(macro.getAttribute("aria-valuemin"));
      const max = Number(macro.getAttribute("aria-valuemax"));
      fireEvent.wheel(macro, { deltaY: before < max ? -100 : 100 });
      const after = Number(macro.getAttribute("aria-valuenow"));
      expect(after).not.toBe(before);
      expect(after).toBeGreaterThanOrEqual(min);
      expect(after).toBeLessThanOrEqual(max);
    }

    fireEvent.click(screen.getByRole("button", { name: /^Snares\b/ }));
    expect(screen.getByRole("heading", { name: "Analog Snare" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Digital Snare/ }));

    const digitalSnare = BUILTIN_FORGE_PRESETS.find((preset) => preset.name === "Digital Snare");
    expect(digitalSnare).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Digital Snare" })).toBeTruthy();
    const sourceMacro = screen.getByRole("slider", { name: "SOURCE" });
    const originalSourceGain = Number(sourceMacro.getAttribute("aria-valuenow"));
    expect(originalSourceGain).toBe(digitalSnare?.nodes[0].params.gain);
    fireEvent.wheel(sourceMacro, { deltaY: -100 });
    const editedSourceGain = Number(sourceMacro.getAttribute("aria-valuenow"));
    expect(editedSourceGain).not.toBe(originalSourceGain);
    expect(BUILTIN_FORGE_PRESETS).toEqual(builtInSnapshot);

    fireEvent.click(screen.getByRole("button", { name: "AUDITION" }));
    await waitFor(() => {
      expect(forgeRender.renderPresetToAudioBuffer).toHaveBeenLastCalledWith(
        fakeContext,
        expect.objectContaining({
          name: "Digital Snare",
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: digitalSnare?.nodes[0].id,
              params: expect.objectContaining({ gain: editedSourceGain }),
            }),
          ]),
        }),
      );
      expect(audio.previewBuffer).toHaveBeenCalledWith(fakeBuffer, 0, 1);
    });

    fireEvent.click(screen.getByRole("button", { name: /^SEND TO / }));
    await waitFor(() => {
      expect(audio.assignBufferToPart).toHaveBeenCalledWith(0, fakeBuffer);
      expect(useGroove.getState().parts[0].sampleName).toBe("forge:Digital Snare");
      expect(forgeRender.renderPresetToAudioBuffer).toHaveBeenLastCalledWith(
        fakeContext,
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: digitalSnare?.nodes[0].id,
              params: expect.objectContaining({ gain: editedSourceGain }),
            }),
          ]),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "WAVEFORM" }));
    expect(screen.getByText("WAVEFORM EDITOR")).toBeTruthy();
    expect(screen.getByRole("button", { name: "FORGE PRESETS" })).toBeTruthy();
  });
});