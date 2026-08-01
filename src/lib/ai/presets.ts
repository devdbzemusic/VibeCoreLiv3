// VibeCore AI — Creative Genre Presets.
//
// Deterministic, editable genre presets. Each preset defines the musical
// parameters (BPM, swing, scale, density, energy, arp config, arrangement
// structure) that the AI assistants use as starting points. Presets are
// NEVER applied automatically — they are suggestions the user confirms.
//
// All preset values are plain data (JSON-serialisable). The user can edit
// any field after applying — presets are starting points, not constraints.

import type { ScaleType, PresetPayload, ArrangementSection } from "./types";

export interface GenrePreset {
  name: string;
  label: string;
  description: string;
  payload: PresetPayload;
}

const STEPS_PER_BEAT = 4;

function makeStructure(
  patternIds: number[], sections: Array<[string, number, number]>,
): ArrangementSection[] {
  return sections.map(([name, patIdx, bars], i) => ({
    name,
    patternId: patternIds[patIdx] ?? 0,
    repeat: 1,
    bars,
  }));
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    name: "minimal", label: "Minimal", description: "Spacious, stripped-back grooves with sparse percussion.",
    payload: {
      genre: "Minimal", bpm: 128, swing: 52, scale: "minorPent", root: 9, density: 0.3, energy: 0.4,
      arp: { complexity: 25, rootNote: 45, scale: "minorPent", octaves: 2, vibeControl: 40, state: "Clean" },
      structure: makeStructure([0, 1, 2, 3], [["INTRO", 0, 4], ["BUILD", 1, 8], ["DROP", 2, 16], ["OUTRO", 3, 4]]),
    },
  },
  {
    name: "techno", label: "Techno", description: "Driving four-on-the-floor with hypnotic bass and dark textures.",
    payload: {
      genre: "Techno", bpm: 132, swing: 50, scale: "phrygian", root: 7, density: 0.6, energy: 0.75,
      arp: { complexity: 40, rootNote: 43, scale: "minor", octaves: 2, vibeControl: 50, state: "Smart" },
      structure: makeStructure([0, 1, 2, 3], [["INTRO", 0, 8], ["BUILD", 1, 8], ["DROP", 2, 16], ["BREAK", 3, 8], ["DROP", 2, 16]]),
    },
  },
  {
    name: "house", label: "House", description: "Swinging four-floor with warm chords and groove-forward bass.",
    payload: {
      genre: "House", bpm: 124, swing: 56, scale: "minorPent", root: 9, density: 0.55, energy: 0.65,
      arp: { complexity: 45, rootNote: 45, scale: "minorPent", octaves: 2, vibeControl: 55, state: "Smart" },
      structure: makeStructure([0, 1, 2, 3], [["INTRO", 0, 8], ["GROOVE", 1, 16], ["DROP", 2, 16], ["OUTRO", 3, 8]]),
    },
  },
  {
    name: "acid", label: "Acid", description: "Squelching TB-303 basslines with tight hats and 909 kick.",
    payload: {
      genre: "Acid", bpm: 130, swing: 51, scale: "minor", root: 7, density: 0.5, energy: 0.7,
      arp: { complexity: 60, rootNote: 40, scale: "minor", octaves: 3, vibeControl: 60, state: "Hard" },
      structure: makeStructure([0, 1, 2, 3], [["INTRO", 0, 4], ["ACID", 1, 16], ["DROP", 2, 16], ["OUTRO", 3, 4]]),
    },
  },
  {
    name: "trance", label: "Trance", description: "Uplifting supersaw leads with rolling bass and epic buildups.",
    payload: {
      genre: "Trance", bpm: 138, swing: 50, scale: "major", root: 9, density: 0.5, energy: 0.8,
      arp: { complexity: 55, rootNote: 48, scale: "major", octaves: 3, vibeControl: 60, state: "Smart" },
      structure: makeStructure([0, 1, 2, 3, 4], [["INTRO", 0, 8], ["BUILD", 1, 16], ["DROP", 2, 16], ["BREAK", 3, 8], ["DROP", 4, 16]]),
    },
  },
  {
    name: "dnb", label: "Drum & Bass", description: "Fast breakbeats with deep sub-bass and atmospheric pads.",
    payload: {
      genre: "DnB", bpm: 174, swing: 54, scale: "minor", root: 7, density: 0.7, energy: 0.85,
      arp: { complexity: 50, rootNote: 36, scale: "minor", octaves: 2, vibeControl: 55, state: "Hard" },
      structure: makeStructure([0, 1, 2, 3], [["INTRO", 0, 8], ["BUILD", 1, 8], ["DROP", 2, 16], ["LIQUID", 3, 16]]),
    },
  },
  {
    name: "ambient", label: "Ambient", description: "Evolving textures with slow harmonics and minimal rhythm.",
    payload: {
      genre: "Ambient", bpm: 90, swing: 50, scale: "lydian", root: 0, density: 0.2, energy: 0.3,
      arp: { complexity: 20, rootNote: 48, scale: "majorPent", octaves: 2, vibeControl: 30, state: "Clean" },
      structure: makeStructure([0, 1, 2], [["DRIFT", 0, 16], ["RISE", 1, 16], ["SETTLE", 2, 16]]),
    },
  },
  {
    name: "cinematic", label: "Cinematic", description: "Orchestral-style pads with dramatic swells and tension.",
    payload: {
      genre: "Cinematic", bpm: 80, swing: 50, scale: "harmonicMinor", root: 5, density: 0.25, energy: 0.5,
      arp: { complexity: 30, rootNote: 41, scale: "minor", octaves: 3, vibeControl: 40, state: "Smart" },
      structure: makeStructure([0, 1, 2, 3], [["OPENING", 0, 8], ["TENSION", 1, 16], ["CLIMAX", 2, 16], ["RESOLUTION", 3, 8]]),
    },
  },
  {
    name: "experimental", label: "Experimental", description: "Unconventional rhythms and textures for sound design.",
    payload: {
      genre: "Experimental", bpm: 100, swing: 58, scale: "chromatic", root: 2, density: 0.4, energy: 0.55,
      arp: { complexity: 70, rootNote: 38, scale: "phrygian", octaves: 3, vibeControl: 70, state: "Hard" },
      structure: makeStructure([0, 1, 2], [["TEXTURE", 0, 16], ["MOTION", 1, 16], ["DISSOLVE", 2, 16]]),
    },
  },
  {
    name: "user", label: "User Style", description: "Neutral starting point — adapts to your current project context.",
    payload: {
      genre: "User", bpm: 124, swing: 54, scale: "minorPent", root: 9, density: 0.5, energy: 0.5,
      arp: { complexity: 40, rootNote: 45, scale: "minorPent", octaves: 2, vibeControl: 50, state: "Smart" },
    },
  },
];

/** Look up a preset by name. Falls back to "user" if not found. */
export function getPreset(name: string): GenrePreset {
  return GENRE_PRESETS.find((p) => p.name === name) ?? GENRE_PRESETS[GENRE_PRESETS.length - 1];
}

/** List all preset names for UI display. */
export function listPresets(): Array<{ name: string; label: string; description: string }> {
  return GENRE_PRESETS.map((p) => ({ name: p.name, label: p.label, description: p.description }));
}