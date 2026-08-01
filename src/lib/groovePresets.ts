// VibeCoreLiv3 — Groove Preset Library.
// Benannte Snapshots des gesamten Groove-Zustands (BPM, Parts, Patterns, FX,
// Mod, Master …). Speichern per Klick, später per Klick wieder laden.
// Separater persistierter Store, damit das Hauptprojekt schlank bleibt.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useGroove, type PsychoPresetName, type QualityMode } from "@/lib/store";

export interface GroovePreset {
  id: string;
  name: string;
  createdAt: number;
  snapshot: GrooveSnapshot;
}

export interface GrooveSnapshot {
  bpm: number;
  masterVolume: number;
  master: unknown;
  parts: unknown;
  patterns: unknown;
  fx: unknown;
  fxRouting: unknown;
  fxSharedFloor: boolean;
  mod: unknown;
  psychoPreset: PsychoPresetName;
  qualityProfile: QualityMode;
}

interface PresetState {
  presets: GroovePreset[];
  savePreset: (name: string) => string;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
}

export const useGroovePresets = create<PresetState>()(persist((set, get) => ({
  presets: [],

  savePreset: (name: string): string => {
    const s = useGroove.getState();
    const snapshot: GrooveSnapshot = {
      bpm: s.bpm,
      masterVolume: s.masterVolume,
      master: s.master,
      parts: s.parts,
      patterns: s.patterns,
      fx: s.fx,
      fxRouting: s.fxRouting,
      fxSharedFloor: s.fxSharedFloor,
      mod: s.mod,
      psychoPreset: s.psychoPreset,
      qualityProfile: s.qualityProfile,
    };
    const id = `gp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const preset: GroovePreset = {
      id,
      name: name.trim() || `Preset ${get().presets.length + 1}`,
      createdAt: Date.now(),
      snapshot,
    };
    set({ presets: [preset, ...get().presets] });
    return id;
  },

  loadPreset: (id: string): void => {
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    useGroove.setState({
      ...p.snapshot,
      selectedPattern: 0,
      selectedSceneIdx: 0,
      selectedStep: null,
    } as Parameters<typeof useGroove.setState>[0]);
    // Psycho-Preset audioseitig reaktivieren (store-Action triggert Import).
    useGroove.getState().setPsychoPreset(p.snapshot.psychoPreset);
  },

  deletePreset: (id: string): void => {
    set({ presets: get().presets.filter((x) => x.id !== id) });
  },

  renamePreset: (id: string, name: string): void => {
    set({
      presets: get().presets.map((x) => (x.id === id ? { ...x, name } : x)),
    });
  },
}), {
  name: "vibecore-groove-presets",
  version: 1,
  storage: createJSONStorage(() => localStorage),
}));