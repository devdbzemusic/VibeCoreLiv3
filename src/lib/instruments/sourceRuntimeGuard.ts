import type { Part, SourceMode } from "@/lib/model";
import { useGroove } from "@/lib/store";
import {
  PROJECT_SCHEMA_VERSION,
  migratePartToV13,
  migratePersistedProject,
} from "./projectMigration";
import { resolveSourceWrite } from "./sourcePolicy";

let bound = false;
let applying = false;

export function canonicalizeRuntimeParts(parts: Part[]): { parts: Part[]; changed: boolean } {
  let changed = false;
  const next = parts.map((part) => {
    const migrated = migratePartToV13(part) as Part;
    const legacyBefore = (part as Part & { legacyInstrument?: unknown }).legacyInstrument;
    const legacyAfter = (migrated as Part & { legacyInstrument?: unknown }).legacyInstrument;
    if (migrated.source !== part.source || legacyAfter !== legacyBefore) changed = true;
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
 * reversible `legacyInstrument.source` metadata.
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

/**
 * Guard future legacy writes such as old UI code calling setPartSource(...,
 * "hybrid"). The existing Zustand store remains authoritative; this adapter
 * replaces only the action entry point while the migration subscription catches
 * any remaining direct/legacy Part-array mutations.
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
  useGroove.setState({
    setPartSource: (id: number, requested: SourceMode) => {
      const state = useGroove.getState();
      const part = state.parts.find((candidate) => candidate.id === id);
      if (!part) return;

      const nextPart = applyCanonicalSourceWrite(part, requested);
      if (nextPart === part) return;

      const write = resolveSourceWrite(part, requested);
      if (write.accepted) {
        originalSetPartSource(id, write.source);
        return;
      }

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
