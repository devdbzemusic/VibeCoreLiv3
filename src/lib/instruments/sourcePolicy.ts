import type { Part, SourceMode } from "@/lib/model";
import {
  canonicalSourceForCategory,
  sourceBoundaryDecision,
  type SourceBoundaryDecision,
} from "./sourceBoundary";

export interface SourceWriteResult {
  accepted: boolean;
  source: SourceMode;
  decision: SourceBoundaryDecision;
}

/**
 * Single write policy for all NEW user/runtime source changes.
 *
 * Invalid legacy modes are not silently accepted into new state. Callers get a
 * structured rejection and the canonical source they should keep displaying.
 */
export function resolveSourceWrite(part: Pick<Part, "category" | "source">, requested: SourceMode): SourceWriteResult {
  const decision = sourceBoundaryDecision(part.category, requested);
  return {
    accepted: decision.compatible,
    source: decision.compatible ? requested : canonicalSourceForCategory(part.category),
    decision,
  };
}

/**
 * Canonicalize freshly-created Part defaults without touching any other Part
 * data. This helper is for NEW/default state only; persisted v12 projects must
 * go through projectMigration so their original source is preserved.
 */
export function canonicalizeNewPart<T extends Part>(part: T): T {
  const source = canonicalSourceForCategory(part.category);
  return source === part.source ? part : { ...part, source };
}

export function canonicalizeNewParts<T extends Part>(parts: T[]): T[] {
  let changed = false;
  const next = parts.map((part) => {
    const canonical = canonicalizeNewPart(part);
    if (canonical !== part) changed = true;
    return canonical;
  });
  return changed ? next : parts;
}
