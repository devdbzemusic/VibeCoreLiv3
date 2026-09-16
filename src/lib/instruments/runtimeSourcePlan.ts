import type { Part, SourceMode } from "@/lib/model";
import {
  canonicalSourceForCategory,
  instrumentAuthorityForCategory,
  sourceBoundaryDecision,
  type InstrumentAuthority,
} from "./sourceBoundary";

export type RuntimeRenderer = "sample" | "synth3d" | "bass3d";

export interface RuntimeSourcePlan {
  authority: InstrumentAuthority;
  renderer: RuntimeRenderer;
  canonicalSource: SourceMode;
  persistedSource: SourceMode;
  legacyCompatibility: boolean;
  warning?: string;
}

/**
 * Canonical v4 audible-render decision.
 *
 * The target renderer is owned by Part.category, never by the legacy mutable
 * `Part.source` switch. Until the v13 Store migration lands, the old source is
 * retained only as diagnostic compatibility information.
 */
export function runtimeSourcePlanForPart(
  part: Pick<Part, "category" | "source">,
): RuntimeSourcePlan {
  const authority = instrumentAuthorityForCategory(part.category);
  const canonicalSource = canonicalSourceForCategory(part.category);
  const decision = sourceBoundaryDecision(part.category, part.source);

  const renderer: RuntimeRenderer = authority === "synth3d"
    ? "synth3d"
    : authority === "bass3d"
      ? "bass3d"
      : "sample";

  return {
    authority,
    renderer,
    canonicalSource,
    persistedSource: part.source,
    legacyCompatibility: !decision.compatible,
    ...(!decision.compatible
      ? {
          warning: `Legacy source ${part.source} ignored for v4 render ownership; ${part.category} uses ${renderer}.`,
        }
      : {}),
  };
}
