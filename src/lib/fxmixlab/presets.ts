// VibeCore FX Mix Lab — Mix Presets.
//
// Deterministic, JSON-serialisable mix configuration presets. Each preset
// is a complete mixer state: channels, buses, returns, automation.
// Presets are pure data — no audio nodes, no side effects.

import type { BusChannel, MixerChannel, MixPreset, ReturnChannel } from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Build a default mixer channel for a part (no inserts, direct to master). */
export function defaultMixerChannel(partId: number): MixerChannel {
  return {
    partId,
    phaseInvert: false,
    inserts: [],
    sends: [],
    busTarget: "master",
  };
}

/** Build a default bus channel (subgroup). */
export function defaultBus(id: string, name: string): BusChannel {
  return {
    id: id || uid("bus"),
    name,
    volume: 100,
    pan: 0,
    mute: false,
    solo: false,
    phaseInvert: false,
    inserts: [],
    busTarget: "master",
  };
}

/** Build a default return channel. */
export function defaultReturn(id: string, name: string): ReturnChannel {
  return {
    id: id || uid("ret"),
    name,
    fxType: null,
    volume: 100,
    pan: 0,
    mute: false,
    solo: false,
    inserts: [],
  };
}

// ── Built-in Mix Presets ──────────────────────────────────────────────────────

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  build: (partIds: number[]) => MixPreset;
}

const PRESETS: PresetTemplate[] = [
  {
    id: "clean_balanced",
    name: "Clean & Balanced",
    description: "Transparent mixing with gentle bus compression and wide stereo.",
    build: (partIds) => ({
      id: uid("preset"),
      name: "Clean & Balanced",
      channels: partIds.map((id) => defaultMixerChannel(id)),
      buses: [
        { ...defaultBus("bus_drums", "DRUMS"), color: "part-kick" },
        { ...defaultBus("bus_melodic", "MELODIC"), color: "part-synth" },
      ],
      returns: [
        defaultReturn("ret_reverb", "REVERB"),
        defaultReturn("ret_delay", "DELAY"),
      ],
      automation: [],
    }),
  },
  {
    id: "punch_loud",
    name: "Punch & Loud",
    description: "Aggressive bus compression, parallel drum bus, limiter on master.",
    build: (partIds) => ({
      id: uid("preset"),
      name: "Punch & Loud",
      channels: partIds.map((id) => ({
        ...defaultMixerChannel(id),
        busTarget: id < 6 ? "bus_drums" : id < 10 ? "bus_melodic" : "master",
      })),
      buses: [
        { ...defaultBus("bus_drums", "DRUMS"), color: "part-kick" },
        { ...defaultBus("bus_melodic", "MELODIC"), color: "part-synth" },
      ],
      returns: [
        defaultReturn("ret_reverb", "REVERB"),
        defaultReturn("ret_delay", "DELAY"),
      ],
      automation: [],
    }),
  },
  {
    id: "ambient_wide",
    name: "Ambient & Wide",
    description: "Wide stereo, lush reverb returns, gentle low-pass on melodic bus.",
    build: (partIds) => ({
      id: uid("preset"),
      name: "Ambient & Wide",
      channels: partIds.map((id) => ({
        ...defaultMixerChannel(id),
        sends: [{ busId: "ret_reverb", level: 40, preFader: false }],
      })),
      buses: [
        { ...defaultBus("bus_drums", "DRUMS"), color: "part-kick" },
        { ...defaultBus("bus_melodic", "MELODIC"), color: "part-synth" },
      ],
      returns: [
        defaultReturn("ret_reverb", "REVERB"),
        defaultReturn("ret_delay", "DELAY"),
      ],
      automation: [],
    }),
  },
];

export function getPresetTemplates(): PresetTemplate[] {
  return PRESETS;
}

export function buildPreset(templateId: string, partIds: number[]): MixPreset | null {
  const tpl = PRESETS.find((p) => p.id === templateId);
  if (!tpl) return null;
  return tpl.build(partIds);
}