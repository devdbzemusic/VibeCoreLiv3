import { describe, expect, it } from "vitest";
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

  it("preserves legacy hybrid source while assigning the canonical bass authority source", () => {
    const output = migratePartToV13({ id: 6, category: "bass", source: "hybrid" }) as any;
    expect(output.source).toBe("synth");
    expect(output.legacyInstrument.source.source).toBe("hybrid");
    expect(output.legacyInstrument.source.reason).toBe("legacy-hybrid-source");
  });

  it("leaves already canonical source values without creating legacy metadata", () => {
    const output = migratePartToV13({ id: 8, category: "synth", source: "synth" }) as any;
    expect(output.source).toBe("synth");
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
        { id: 6, category: "bass", source: "sample" },
        { id: 8, category: "synth", source: "synth" },
      ],
    } as const;

    const output = migrateProjectToV13(input) as any;
    expect(output).not.toBe(input);
    expect(output.parts).not.toBe(input.parts);
    expect(output.marker).toBe("keep-me");
    expect(output.parts.map((p: any) => p.source)).toEqual(["sample", "synth", "synth"]);
    expect((input.parts[0] as any).source).toBe("synth");
  });

  it("routes schema 12 through v13 migration and leaves schema 13 unchanged", () => {
    const project = { parts: [{ id: 0, category: "kick", source: "synth" }] };
    const migrated = migratePersistedProject(project, 12) as any;
    expect(migrated.parts[0].source).toBe("sample");
    expect(migratePersistedProject(project, 13)).toBe(project);
  });

  it("does not pretend to reconstruct pre-v12 projects", () => {
    expect(migratePersistedProject({ anything: true }, 11)).toBeUndefined();
  });
});
