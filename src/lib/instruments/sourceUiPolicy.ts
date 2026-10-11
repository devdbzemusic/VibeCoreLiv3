import type { Part, SourceMode } from "@/lib/model";
import {
  canonicalSourceForCategory,
  instrumentAuthorityForCategory,
  type InstrumentAuthority,
  type LegacySourceSnapshot,
} from "./sourceBoundary";

export interface SourceUiOption {
  source: SourceMode;
  visible: boolean;
  enabled: boolean;
  label: string;
  reason?: string;
}

export interface SourceUiPolicy {
  authority: InstrumentAuthority;
  canonicalSource: SourceMode;
  options: SourceUiOption[];
  showHybridEditor: false;
  legacyNotice?: string;
}

function authorityLabel(authority: InstrumentAuthority): string {
  if (authority === "synth3d") return "3D Synth";
  if (authority === "bass3d") return "3D Bass";
  return "Sample";
}

/**
 * Canonical v4 UI policy for source ownership.
 *
 * New UI must not offer arbitrary Sample/Synth/Hybrid switching. A Part has one
 * authority determined by its category. Legacy state may be displayed as a
 * compatibility notice, but it does not reopen invalid source buttons.
 */
export function sourceUiPolicyForPart(
  part: Pick<Part, "category" | "source"> & {
    legacyInstrument?: { source?: LegacySourceSnapshot };
  },
): SourceUiPolicy {
  const authority = instrumentAuthorityForCategory(part.category);
  const canonicalSource = canonicalSourceForCategory(part.category);
  const legacy = part.legacyInstrument?.source;

  const options: SourceUiOption[] = (["sample", "synth", "hybrid"] as SourceMode[]).map((source) => {
    const canonical = source === canonicalSource;
    return {
      source,
      visible: canonical,
      enabled: canonical,
      label: canonical ? authorityLabel(authority) : source.toUpperCase(),
      ...(!canonical ? { reason: "not owned by this Part category in v4" } : {}),
    };
  });

  return {
    authority,
    canonicalSource,
    options,
    showHybridEditor: false,
    ...(legacy
      ? {
          legacyNotice: `Legacy ${legacy.source} source preserved (${legacy.reason}); runtime uses ${canonicalSource}.`,
        }
      : {}),
  };
}
