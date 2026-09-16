import type { PartCategory, SourceMode } from "@/lib/model";

/**
 * Canonical v4 instrument ownership.
 *
 * Sample-domain slots render audio/sample material only. General synthesis is
 * owned by 3D Synth, bass synthesis by 3D Bass. `SourceMode` remains imported
 * because persisted v12 projects can still contain the legacy values.
 */
export type InstrumentAuthority = "sample-domain" | "synth3d" | "bass3d";

export type LegacySourceReason =
  | "legacy-synth-on-sample-domain"
  | "legacy-hybrid-source"
  | "legacy-sample-on-synth-authority";

export interface SourceBoundaryDecision {
  category: PartCategory;
  authority: InstrumentAuthority;
  requestedSource: SourceMode;
  canonicalSource: SourceMode;
  compatible: boolean;
  legacyReason?: LegacySourceReason;
}

export interface LegacySourceSnapshot {
  /** Original persisted value. Never discard this during compatibility migration. */
  source: SourceMode;
  reason: LegacySourceReason;
  /** Schema that introduced the explicit ownership boundary. */
  migratedBySchema: 13;
}

const SAMPLE_DOMAIN = new Set<PartCategory>([
  "kick",
  "snare",
  "perc",
  "hat",
  "sample",
]);

export function instrumentAuthorityForCategory(category: PartCategory): InstrumentAuthority {
  if (category === "bass") return "bass3d";
  if (category === "synth") return "synth3d";
  return "sample-domain";
}

/**
 * Runtime source accepted by the canonical v4 architecture.
 *
 * `hybrid` deliberately has no canonical owner. It is compatibility data only
 * until a future explicit feature contract reintroduces such a mode.
 */
export function canonicalSourceForCategory(category: PartCategory): SourceMode {
  return SAMPLE_DOMAIN.has(category) ? "sample" : "synth";
}

export function sourceBoundaryDecision(
  category: PartCategory,
  requestedSource: SourceMode,
): SourceBoundaryDecision {
  const authority = instrumentAuthorityForCategory(category);
  const canonicalSource = canonicalSourceForCategory(category);
  const compatible = requestedSource === canonicalSource;

  let legacyReason: LegacySourceReason | undefined;
  if (!compatible) {
    if (requestedSource === "hybrid") {
      legacyReason = "legacy-hybrid-source";
    } else if (authority === "sample-domain" && requestedSource === "synth") {
      legacyReason = "legacy-synth-on-sample-domain";
    } else if (authority !== "sample-domain" && requestedSource === "sample") {
      legacyReason = "legacy-sample-on-synth-authority";
    }
  }

  return {
    category,
    authority,
    requestedSource,
    canonicalSource,
    compatible,
    legacyReason,
  };
}

/**
 * Pure compatibility helper for the v12 -> v13 loader migration.
 *
 * The returned runtime source is canonical, while an invalid legacy value is
 * retained verbatim in `legacy`. This makes migration explicit and reversible
 * instead of silently destroying project intent.
 */
export function migratePersistedSource(
  category: PartCategory,
  persistedSource: SourceMode,
): { source: SourceMode; legacy?: LegacySourceSnapshot } {
  const decision = sourceBoundaryDecision(category, persistedSource);
  if (decision.compatible) return { source: persistedSource };

  return {
    source: decision.canonicalSource,
    legacy: {
      source: persistedSource,
      reason: decision.legacyReason ?? "legacy-hybrid-source",
      migratedBySchema: 13,
    },
  };
}

export function canSelectSourceMode(category: PartCategory, source: SourceMode): boolean {
  return source === canonicalSourceForCategory(category);
}
