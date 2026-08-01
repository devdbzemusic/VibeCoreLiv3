// Sprint 6A — Setup Center store
// Modular, additive store. Persists user hardware & performance preferences.
// Does NOT mutate the existing groove store to remain backward-compatible.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SampleRate = 44100 | 48000 | 96000;
export type BufferSize = 64 | 128 | 256 | 512 | 1024;
export type SyncSource = "internal" | "external_audio" | "midi" | "auto";
export type CpuMode = "low" | "balanced" | "performance" | "ultra";
export type ParticleLevel = "low" | "medium" | "high" | "ultra";
export type AtmoQuality = "low" | "medium" | "high";
export type LandscapeMode = "auto" | "always" | "off";

export interface LatencyReport {
  inputMs: number;
  outputMs: number;
  roundtripMs: number;
  at: number;
}
export interface ClockReport {
  jitterMs: number;
  stableRatio: number; // 0..1
  driftMs: number;
  at: number;
}

interface SetupState {
  // Audio
  audioOutputId: string;     // mediaDevices deviceId or "default"
  audioInputId: string;
  sampleRate: SampleRate;
  bufferSize: BufferSize;

  // MIDI
  midiInputId: string | null;
  midiOutputId: string | null;
  midiClockSend: boolean;
  midiClockReceive: boolean;
  midiStart: boolean;
  midiStop: boolean;
  midiContinue: boolean;

  // VibeSync
  syncSource: SyncSource;
  beatSensitivity: number;       // 0..100
  transientSensitivity: number;  // 0..100
  bpmMin: number;
  bpmMax: number;

  // Performance / Graphics
  cpuMode: CpuMode;
  bloom: boolean;
  particles: ParticleLevel;
  atmosphere: AtmoQuality;

  // Mobile
  landscape: LandscapeMode;
  compactMixer: boolean;
  largeTouch: boolean;

  // Debug
  debugPanel: boolean;

  // Reports
  lastLatency: LatencyReport | null;
  lastClock: ClockReport | null;

  // Actions
  set: <K extends keyof SetupState>(k: K, v: SetupState[K]) => void;
  setLatency: (r: LatencyReport) => void;
  setClock: (r: ClockReport) => void;
}

export const useSetup = create<SetupState>()(persist((set) => ({
  audioOutputId: "default",
  audioInputId: "default",
  sampleRate: 48000,
  bufferSize: 256,

  midiInputId: null,
  midiOutputId: null,
  midiClockSend: false,
  midiClockReceive: false,
  midiStart: true,
  midiStop: true,
  midiContinue: true,

  syncSource: "internal",
  beatSensitivity: 65,
  transientSensitivity: 55,
  bpmMin: 60,
  bpmMax: 240,

  cpuMode: "balanced",
  bloom: true,
  particles: "medium",
  atmosphere: "medium",

  landscape: "auto",
  compactMixer: false,
  largeTouch: true,

  debugPanel: false,

  lastLatency: null,
  lastClock: null,

  set: (k, v) => set({ [k]: v } as Partial<SetupState>),
  setLatency: (r) => set({ lastLatency: r }),
  setClock: (r) => set({ lastClock: r }),
}), {
  name: "vibecore-liv3-setup",
  version: 1,
  storage: createJSONStorage(() => localStorage),
}));

// Estimated latency from a buffer size & sample rate (rough Web Audio model)
export function estimateLatencyMs(buf: BufferSize, sr: SampleRate): number {
  return (buf / sr) * 1000;
}
