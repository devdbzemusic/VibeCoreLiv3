import type { Part, PartCategory, SourceMode, SynthEngine } from "@/lib/model";
import {
  canonicalSynthEngineForCategory,
  migratePersistedSource,
  type LegacySourceSnapshot,
} from "./sourceBoundary";

export const PROJECT_SCHEMA_VERSION = 13 as const;

export interface LegacyEngineSnapshot {
  engine: SynthEngine;
  reason: "legacy-noncanonical-synth-engine" | "legacy-noncanonical-bass-engine";
  migratedBySchema: 13;
}

export interface LegacyInstrumentCompatibility {
  /** Original v12 source value retained for reversible compatibility. */
  source?: LegacySourceSnapshot;
  /** Original v12 synth-engine selector retained for reversible compatibility. */
  engine?: LegacyEngineSnapshot;
}

/**
 * v13 extends Part only at the persistence boundary. Runtime code can continue
 * to consume Part while compatibility-aware UI/export code may inspect legacy.
 */
export type PersistedPartV13 = Part & {
  legacyInstrument?: LegacyInstrumentCompatibility;
};

export interface PersistedProjectLike {
  parts?: unknown;
  [key: string]: unknown;
}

function isPartCategory(value: unknown): value is PartCategory {
  return value === "kick" || value === "snare" || value === "perc" || value === "hat"
    || value === "bass" || value === "synth" || value === "sample";
}

function isSourceMode(value: unknown): value is SourceMode {
  return value === "sample" || value === "synth" || value === "hybrid";
}

function isSynthEngine(value: unknown): value is SynthEngine {
  return value === "Kick" || value === "Snare" || value === "Hat" || value === "Bass"
    || value === "Synth" || value === "3D" || value === "3D Bass";
}

/**
 * Migrate one persisted Part to the v4 ownership boundary.
 *
 * Deliberately conservative for malformed data: unknown categories/sources are
 * not invented here. Recognized Synth/Bass parts additionally move their legacy
 * engine selector to the canonical 3D renderer while retaining the old choice
 * under compatibility metadata.
 */
export function migratePartToV13(part: unknown): unknown {
  if (!part || typeof part !== "object") return part;
  const record = part as Record<string, unknown>;
  if (!isPartCategory(record.category) || !isSourceMode(record.source)) return part;

  const migratedSource = migratePersistedSource(record.category, record.source);
  const previousLegacy = record.legacyInstrument && typeof record.legacyInstrument === "object"
    ? { ...(record.legacyInstrument as Record<string, unknown>) }
    : undefined;

  const next: Record<string, unknown> = {
    ...record,
    source: migratedSource.source,
  };

  let nextLegacy = previousLegacy ? { ...previousLegacy } : undefined;

  if (migratedSource.legacy) {
    nextLegacy = {
      ...(nextLegacy ?? {}),
      source: migratedSource.legacy,
    };
  }

  const canonicalEngine = canonicalSynthEngineForCategory(record.category);
  const synth = record.synth;
  if (canonicalEngine && synth && typeof synth === "object") {
    const synthRecord = synth as Record<string, unknown>;
    if (isSynthEngine(synthRecord.engine) && synthRecord.engine !== canonicalEngine) {
      const legacyEngine: LegacyEngineSnapshot = {
        engine: synthRecord.engine,
        reason: record.category === "bass"
          ? "legacy-noncanonical-bass-engine"
          : "legacy-noncanonical-synth-engine",
        migratedBySchema: 13,
      };
      next.synth = { ...synthRecord, engine: canonicalEngine };
      nextLegacy = {
        ...(nextLegacy ?? {}),
        engine: legacyEngine,
      };
    }
  }

  if (nextLegacy) next.legacyInstrument = nextLegacy;

  return next as PersistedPartV13;
}

/**
 * Pure v12 -> v13 compatibility migration.
 *
 * - keeps the complete persisted project shape intact
 * - canonicalizes recognized Part.source values
 * - promotes Synth/Bass engine ownership to 3D / 3D Bass when a recognized
 *   legacy engine selector exists
 * - preserves incompatible old source/engine values in `legacyInstrument`
 * - never mutates the input object/part array
 */
export function migrateProjectToV13(persisted: unknown): unknown {
  if (!persisted || typeof persisted !== "object") return persisted;
  const project = persisted as PersistedProjectLike;
  if (!Array.isArray(project.parts)) return persisted;

  return {
    ...project,
    parts: project.parts.map(migratePartToV13),
  };
}

/**
 * Zustand persist migration entry point. Versions older than v12 cannot be
 * reconstructed by this module because v11 -> v12 changed the Pattern/Scene
 * domain shape. Those versions must continue through the existing legacy gate.
 */
export function migratePersistedProject(persisted: unknown, fromVersion: number): unknown {
  if (fromVersion < 12) return undefined;
  if (fromVersion === 12) return migrateProjectToV13(persisted);
  return persisted;
}
