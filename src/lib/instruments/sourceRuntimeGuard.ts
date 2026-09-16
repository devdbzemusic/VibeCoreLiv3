import type { Part, SourceMode, SynthEngine } from "@/lib/model";
import { useGroove } from "@/lib/store";
import {
  PROJECT_SCHEMA_VERSION,
  migratePartToV13,
  migratePersistedProject,
  type LegacyInstrumentCompatibility,
} from "./projectMigration";
import { resolveSourceWrite } from "./sourcePolicy";
import {
  canonicalSynthEngineForCategory,
  instrumentAuthorityForCategory,
} from "./sourceBoundary";

let bound = false;
let applying = false;

export const SOURCE_BOUNDARY_REJECTED_EVENT = "vibecore:source-boundary-rejected";
export const ENGINE_BOUNDARY_REJECTED_EVENT = "vibecore:engine-boundary-rejected";

export interface SourceBoundaryRejectedDetail {
  partId: number;
  partName: string;
  requested: SourceMode;
  canonical: SourceMode;
  authority: "sample-domain" | "synth3d" | "bass3d";
  reason?: string;
}

export interface EngineBoundaryRejectedDetail {
  partId: number;
  partName: string;
  requested: SynthEngine;
  canonical: SynthEngine | null;
  authority: "sample-domain" | "synth3d" | "bass3d";
  reason: "sample-domain-has-no-synth-renderer" | "legacy-noncanonical-synth-engine" | "legacy-noncanonical-bass-engine";
}

type PartWithLegacy = Part & { legacyInstrument?: LegacyInstrumentCompatibility };

function sameLegacyInstrument(
  a?: LegacyInstrumentCompatibility,
  b?: LegacyInstrumentCompatibility,
): boolean {
  const aSource = a?.source;
  const bSource = b?.source;
  const aEngine = a?.engine;
  const bEngine = b?.engine;

  return (
    aSource?.source === bSource?.source
    && aSource?.reason === bSource?.reason
    && aSource?.migratedBySchema === bSource?.migratedBySchema
    && aEngine?.engine === bEngine?.engine
    && aEngine?.reason === bEngine?.reason
    && aEngine?.migratedBySchema === bEngine?.migratedBySchema
  );
}

export function canonicalizeRuntimeParts(parts: Part[]): { parts: Part[]; changed: boolean } {
  let changed = false;
  const next = parts.map((part) => {
    const migrated = migratePartToV13(part) as PartWithLegacy;
    const before = part as PartWithLegacy;
    const engineChanged = migrated.synth?.engine !== part.synth?.engine;
    const legacyChanged = !sameLegacyInstrument(before.legacyInstrument, migrated.legacyInstrument);
    if (migrated.source !== part.source || engineChanged || legacyChanged) changed = true;
    return migrated;
  });
  return { parts: next, changed };
}

/**
 * Pure compatibility adapter for legacy callers that still request a mutable
 * SourceMode. Accepted canonical writes keep the Part shape intact; rejected
 * legacy writes are canonicalized through the v13 migration helper so the
 * requested value is retained under `legacyInstrument.source`.
 */
export function applyCanonicalSourceWrite(part: Part, requested: SourceMode): Part {
  const write = resolveSourceWrite(part, requested);
  if (write.accepted) {
    return write.source === part.source ? part : { ...part, source: write.source };
  }
  return migratePartToV13({ ...part, source: requested }) as Part;
}

/**
 * Pure compatibility adapter for legacy SynthEngine selectors.
 * Sample-domain parts reject synthesis entirely. Synth/Bass authority accepts
 * only the canonical 3D renderer and keeps rejected legacy choices reversible.
 */
export function applyCanonicalEngineWrite(part: Part, requested: SynthEngine): Part {
  const canonical = canonicalSynthEngineForCategory(part.category);
  if (!canonical) return part;
  if (requested === canonical) {
    return part.synth.engine === canonical ? part : { ...part, synth: { ...part.synth, engine: canonical } };
  }
  return migratePartToV13({ ...part, synth: { ...part.synth, engine: requested } }) as Part;
}

/**
 * Promote the existing Zustand persist middleware to the v13 compatibility
 * contract without creating a second store. `setOptions` is a runtime bridge
 * until the monolithic store declaration itself can be edited safely.
 */
export function configureProjectPersistenceV13(): void {
  useGroove.persist.setOptions({
    version: PROJECT_SCHEMA_VERSION,
    migrate: (persistedState, fromVersion) =>
      migratePersistedProject(persistedState, fromVersion) as typeof persistedState,
  });
}

/**
 * Enforce the canonical v4 Sample/Synth ownership on the live Zustand state.
 *
 * This is a compatibility bridge while the monolithic store source still
 * declares schema v12. The guard does not create a second state store: it
 * rewrites the existing authoritative `parts` array through Zustand and the
 * existing persist middleware serializes the resulting Part objects, including
 * reversible `legacyInstrument` metadata.
 */
export function migrateLiveProjectSourcesToV13(): boolean {
  const state = useGroove.getState();
  const migrated = canonicalizeRuntimeParts(state.parts);
  if (!migrated.changed) return false;
  applying = true;
  try {
    useGroove.setState({ parts: migrated.parts });
  } finally {
    applying = false;
  }
  return true;
}

function publishRejectedSourceWrite(part: Part, requested: SourceMode): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  const write = resolveSourceWrite(part, requested);
  if (write.accepted) return;

  const detail: SourceBoundaryRejectedDetail = {
    partId: part.id,
    partName: part.name,
    requested,
    canonical: write.source,
    authority: write.decision.authority,
    reason: write.decision.legacyReason,
  };
  window.dispatchEvent(new CustomEvent<SourceBoundaryRejectedDetail>(SOURCE_BOUNDARY_REJECTED_EVENT, { detail }));
}

function publishRejectedEngineWrite(part: Part, requested: SynthEngine): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  const authority = instrumentAuthorityForCategory(part.category);
  const canonical = canonicalSynthEngineForCategory(part.category);
  const reason: EngineBoundaryRejectedDetail["reason"] = canonical == null
    ? "sample-domain-has-no-synth-renderer"
    : part.category === "bass"
      ? "legacy-noncanonical-bass-engine"
      : "legacy-noncanonical-synth-engine";

  const detail: EngineBoundaryRejectedDetail = {
    partId: part.id,
    partName: part.name,
    requested,
    canonical,
    authority,
    reason,
  };
  window.dispatchEvent(new CustomEvent<EngineBoundaryRejectedDetail>(ENGINE_BOUNDARY_REJECTED_EVENT, { detail }));
}

/**
 * Guard future legacy source/engine writes from old UI surfaces. The existing
 * Zustand store remains authoritative; only its legacy action entry points are
 * wrapped while a migration subscription catches any remaining direct Part
 * mutations.
 */
export function bindCanonicalSourceGuard(): void {
  if (bound) return;
  bound = true;

  // Set the persist contract before the first compatibility write so any
  // migration write is serialized with the v13 envelope.
  configureProjectPersistenceV13();
  const migrated = migrateLiveProjectSourcesToV13();
  if (!migrated) {
    // Persist middleware v5 does not write initial state at creation time. A
    // no-op-equivalent partial update stamps an already-canonical project with
    // the new v13 persistence version without changing musical data.
    useGroove.setState({ parts: useGroove.getState().parts });
  }

  const originalSetPartSource = useGroove.getState().setPartSource;
  const originalSetSynthEngine = useGroove.getState().setSynthEngine;

  useGroove.setState({
    setPartSource: (id: number, requested: SourceMode) => {
      const state = useGroove.getState();
      const part = state.parts.find((candidate) => candidate.id === id);
      if (!part) return;

      const write = resolveSourceWrite(part, requested);
      const nextPart = applyCanonicalSourceWrite(part, requested);
      if (nextPart === part) return;

      if (write.accepted) {
        originalSetPartSource(id, write.source);
        return;
      }

      publishRejectedSourceWrite(part, requested);
      applying = true;
      try {
        useGroove.setState({
          parts: state.parts.map((candidate) => candidate.id === id ? nextPart : candidate),
        });
      } finally {
        applying = false;
      }
    },

    setSynthEngine: (id: number, requested: SynthEngine) => {
      const state = useGroove.getState();
      const part = state.parts.find((candidate) => candidate.id === id);
      if (!part) return;

      const canonical = canonicalSynthEngineForCategory(part.category);
      if (canonical == null) {
        publishRejectedEngineWrite(part, requested);
        return;
      }
      if (requested === canonical) {
        originalSetSynthEngine(id, canonical);
        return;
      }

      publishRejectedEngineWrite(part, requested);
      const nextPart = applyCanonicalEngineWrite(part, requested);
      applying = true;
      try {
        useGroove.setState({
          parts: state.parts.map((candidate) => candidate.id === id ? nextPart : candidate),
        });
      } finally {
        applying = false;
      }
    },
  });

  useGroove.subscribe((state, previous) => {
    if (applying || state.parts === previous.parts) return;
    migrateLiveProjectSourcesToV13();
  });
}
