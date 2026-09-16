import type { Part, PartCategory, SourceMode } from "@/lib/model";
import { migratePersistedSource, type LegacySourceSnapshot } from "./sourceBoundary";

export const PROJECT_SCHEMA_VERSION = 13 as const;

export interface LegacyInstrumentCompatibility {
  /** Original v12 source value retained for reversible compatibility. */
  source?: LegacySourceSnapshot;
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

/**
 * Migrate one persisted Part to the v4 ownership boundary.
 *
 * Deliberately conservative: malformed/unknown values are not invented here;
 * the caller keeps the original object so a higher-level validation layer can
 * decide whether to reject or repair the project.
 */
export function migratePartToV13(part: unknown): unknown {
  if (!part || typeof part !== "object") return part;
  const record = part as Record<string, unknown>;
  if (!isPartCategory(record.category) || !isSourceMode(record.source)) return part;

  const migrated = migratePersistedSource(record.category, record.source);
  const previousLegacy = record.legacyInstrument && typeof record.legacyInstrument === "object"
    ? { ...(record.legacyInstrument as Record<string, unknown>) }
    : undefined;

  const next: Record<string, unknown> = {
    ...record,
    source: migrated.source,
  };

  if (migrated.legacy) {
    next.legacyInstrument = {
      ...(previousLegacy ?? {}),
      source: migrated.legacy,
    };
  }

  return next as PersistedPartV13;
}

/**
 * Pure v12 -> v13 compatibility migration.
 *
 * - keeps the complete persisted project shape intact
 * - canonicalizes only recognized Part.source values
 * - preserves every non-canonical old value in `legacyInstrument.source`
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
