import type { Part } from "@/lib/model";
import { useGroove } from "@/lib/store";
import { migratePartToV13 } from "./projectMigration";

let bound = false;
let applying = false;

function migrateParts(parts: Part[]): { parts: Part[]; changed: boolean } {
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
 * Enforce the canonical v4 Sample/Synth ownership on the live Zustand state.
 *
 * This is a compatibility bridge while the monolithic store persistence config
 * still declares schema v12. The guard does not create a second state store:
 * it rewrites the existing authoritative `parts` array through Zustand and the
 * existing persist middleware serializes the resulting Part objects, including
 * reversible `legacyInstrument.source` metadata.
 */
export function migrateLiveProjectSourcesToV13(): boolean {
  const state = useGroove.getState();
  const migrated = migrateParts(state.parts);
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
 * "hybrid"). Invalid source values are canonicalized immediately and the
 * requested legacy source is retained by the v13 migration helper.
 */
export function bindCanonicalSourceGuard(): void {
  if (bound) return;
  bound = true;
  migrateLiveProjectSourcesToV13();
  useGroove.subscribe((state, previous) => {
    if (applying || state.parts === previous.parts) return;
    migrateLiveProjectSourcesToV13();
  });
}
