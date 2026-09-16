import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeOboeBackend } from "./NativeOboeBackend";
import { runNativeIntegrationGateProbe } from "./nativeIntegrationGateProbe";

function bridge() {
  return {
    isAvailable: vi.fn(() => true),
    startEngine: vi.fn(() => true),
    stopEngine: vi.fn(),
    isEngineRunning: vi.fn(() => true),
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    setTempo: vi.fn(),
    getTempo: vi.fn(() => 120),
    setMasterGain: vi.fn(),
    setPosition: vi.fn(),
    getCurrentTick: vi.fn(() => 960),
    getLatencyMs: vi.fn(() => 12.5),
    getDiagnosticStatus: vi.fn(() => "native:ok"),
    voiceLoadSample: vi.fn(() => true),
    voiceClearSample: vi.fn(),
    voiceNoteOn: vi.fn(),
    voiceNoteOff: vi.fn(),
    voiceAllNotesOff: vi.fn(),
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("NativeOboeBackend", () => {
  it("maps lifecycle, transport, diagnostics, and voice calls to real bridge names", async () => {
    const native = bridge();
    (globalThis as { window?: unknown }).window = { VibeCoreNative: native };
    const backend = new NativeOboeBackend();

    await backend.init();
    await backend.startEngine();
    backend.setTempo(127.5);
    backend.setMasterGain(0.8);
    backend.setPosition(1920);
    await backend.loadVoiceSample(2, new Float32Array([0, 0.5]), 48_000, 60);
    backend.noteOn(60, 100, 2, -1);
    backend.noteOff(60);
    backend.play();
    await backend.stop();

    expect(native.startEngine).toHaveBeenCalledOnce();
    expect(native.setTempo).toHaveBeenCalledWith(127.5);
    expect(native.setMasterGain).toHaveBeenCalledWith(0.8);
    expect(native.setPosition).toHaveBeenCalledWith(1920);
    expect(native.voiceLoadSample).toHaveBeenCalledWith(2, expect.any(Float32Array), 48_000, 60);
    expect(native.voiceNoteOn).toHaveBeenCalledWith(60, 100, 2, -1);
    expect(native.voiceNoteOff).toHaveBeenCalledWith(60);
    expect(native.play).toHaveBeenCalledOnce();
    expect(native.stop).toHaveBeenCalledOnce();
    expect(backend.getOutputLatencyMs()).toBe(12.5);
    expect(backend.getDiagnosticStatus()).toBe("native:ok");
  });

  it("rejects a failed native engine start instead of silently falling back", async () => {
    const native = { ...bridge(), startEngine: vi.fn(() => false), getDiagnosticStatus: vi.fn(() => "native:error") };
    (globalThis as { window?: unknown }).window = { VibeCoreNative: native };
    const backend = new NativeOboeBackend();

    await expect(backend.startEngine()).rejects.toThrow("native:error");
  });
});

describe("runNativeIntegrationGateProbe", () => {
  it("fails explicitly when no native bridge is available", async () => {
    const report = await runNativeIntegrationGateProbe();

    expect(report.pass).toBe(false);
    expect(report.backendKind).toBe("unavailable");
    expect(report.steps[0]).toMatchObject({
      name: "native bridge available",
      pass: false,
    });
  });
});
