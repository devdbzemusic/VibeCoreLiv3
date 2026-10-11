import { describe, expect, it } from "vitest";
import { defaultSynth } from "@/lib/model";
import {
  migratePartToV13,
  migratePersistedProject,
  migrateProjectToV13,
  PROJECT_SCHEMA_VERSION,
} from "../projectMigration";

describe("v13 instrument ownership project migration", () => {
  it("declares schema version 13", () => {
    expect(PROJECT_SCHEMA_VERSION).toBe(13);
  });

  it("canonicalizes legacy synth-on-drum and preserves the original source", () => {
    const input = {
      id: 0,
      category: "kick",
      source: "synth",
      name: "KICK 1",
      untouched: { nested: true },
    } as const;

    const output = migratePartToV13(input) as any;
    expect(output).not.toBe(input);
    expect(output.source).toBe("sample");
    expect(output.legacyInstrument.source).toEqual({
      source: "synth",
      reason: "legacy-synth-on-sample-domain",
      migratedBySchema: 13,
    });
    expect(output.untouched).toBe(input.untouched);
    expect(input.source).toBe("synth");
  });

  it("preserves legacy hybrid source while promoting bass to the 3D Bass renderer", () => {
    const output = migratePartToV13({
      id: 6,
      category: "bass",
      source: "hybrid",
      synth: defaultSynth("Bass"),
    }) as any;

    expect(output.source).toBe("synth");
    expect(output.synth.engine).toBe("3D Bass");
    expect(output.legacyInstrument.source.source).toBe("hybrid");
    expect(output.legacyInstrument.source.reason).toBe("legacy-hybrid-source");
    expect(output.legacyInstrument.engine).toEqual({
      engine: "Bass",
      reason: "legacy-noncanonical-bass-engine",
      migratedBySchema: 13,
    });
  });

  it("promotes legacy synth engines to the 3D Synth renderer and keeps the old selector", () => {
    const output = migratePartToV13({
      id: 8,
      category: "synth",
      source: "synth",
      synth: defaultSynth("Synth"),
    }) as any;

    expect(output.source).toBe("synth");
    expect(output.synth.engine).toBe("3D");
    expect(output.legacyInstrument.engine).toEqual({
      engine: "Synth",
      reason: "legacy-noncanonical-synth-engine",
      migratedBySchema: 13,
    });
  });

  it("leaves already canonical 3D engine/source values without creating legacy metadata", () => {
    const output = migratePartToV13({
      id: 8,
      category: "synth",
      source: "synth",
      synth: defaultSynth("3D"),
    }) as any;

    expect(output.source).toBe("synth");
    expect(output.synth.engine).toBe("3D");
    expect(output.legacyInstrument).toBeUndefined();
  });

  it("does not invent repairs for malformed unknown part data", () => {
    const malformed = { id: 99, category: "mystery", source: "magic" };
    expect(migratePartToV13(malformed)).toBe(malformed);
  });

  it("migrates recognized project parts without mutating the input project", () => {
    const input = {
      bpm: 124,
      marker: "keep-me",
      parts: [
        { id: 0, category: "kick", source: "synth" },
        { id: 6, category: "bass", source: "sample", synth: defaultSynth("Bass") },
        { id: 8, category: "synth", source: "synth", synth: defaultSynth("Synth") },
      ],
    } as const;

    const output = migrateProjectToV13(input) as any;
    expect(output).not.toBe(input);
    expect(output.parts).not.toBe(input.parts);
    expect(output.marker).toBe("keep-me");
    expect(output.parts.map((p: any) => p.source)).toEqual(["sample", "synth", "synth"]);
    expect(output.parts[1].synth.engine).toBe("3D Bass");
    expect(output.parts[2].synth.engine).toBe("3D");
    expect((input.parts[0] as any).source).toBe("synth");
    expect((input.parts[1] as any).synth.engine).toBe("Bass");
  });

  it("routes schema 12 through v13 migration and leaves schema 13 unchanged", () => {
    const project = {
      parts: [{ id: 8, category: "synth", source: "synth", synth: defaultSynth("Synth") }],
    };
    const migrated = migratePersistedProject(project, 12) as any;
    expect(migrated.parts[0].source).toBe("synth");
    expect(migrated.parts[0].synth.engine).toBe("3D");
    expect(migratePersistedProject(project, 13)).toBe(project);
  });

  it("does not pretend to reconstruct pre-v12 projects", () => {
    expect(migratePersistedProject({ anything: true }, 11)).toBeUndefined();
  });
});
