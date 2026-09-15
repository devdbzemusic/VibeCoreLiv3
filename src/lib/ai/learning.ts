// VibeCore AI — Project-Local Learning System.
//
// Merkt sich projektbezogene Präferenzen (bevorzugte Akkorde, Groove-Stil,
// Swing, Humanize, Instrumentierung, Mix-Stil). Ausschließlich projektbezogen
// gespeichert — keine globalen Profile, kein Cloud-Upload, kein Tracking.
//
// Persistenz: localStorage (key: vibecore-ai-prefs::<projectId>). Pure
// Funktionen — keine Audio-Path-Abhängigkeit, keine Store-Mutation.

export interface ProjectPreferences {
  projectId: string;
  profileVersion?: number;
  consent?: LearningConsent;
  preferredChords?: number[];
  grooveStyle?: string;
  swing?: number;
  humanize?: number;
  instrumentation?: Record<string, number>;
  mixStyle?: string;
  genreAffinity?: Record<string, number>;
  lastUpdated?: string;
}

export type LearningSource = "current-project" | "selected-patterns" | "performance" | "reference-audio";
export type LearningUse = "suggestions" | "presets" | "arrangement" | "mix" | "remix";

export interface LearningConsent {
  enabled: boolean;
  version: number;
  acceptedAt?: string;
  revokedAt?: string;
  sources: LearningSource[];
  uses: LearningUse[];
  notes?: string;
}

export interface LearningConsentOptions {
  sources?: LearningSource[];
  uses?: LearningUse[];
  notes?: string;
}

export const LEARNING_PROFILE_VERSION = 1;
const STORAGE_PREFIX = "vibecore-ai-prefs::";

function safeKey(projectId: string): string {
  return STORAGE_PREFIX + projectId.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 64);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePreferences(parsed: unknown, projectId: string): ProjectPreferences {
  if (!parsed || typeof parsed !== "object") return { projectId, profileVersion: LEARNING_PROFILE_VERSION };
  const prefs = parsed as ProjectPreferences;
  return {
    ...prefs,
    projectId,
    profileVersion: prefs.profileVersion ?? LEARNING_PROFILE_VERSION,
  };
}

/** Load project-local preferences. Returns a fresh default if none saved. */
export function loadPreferences(projectId: string): ProjectPreferences {
  try {
    const raw = localStorage.getItem(safeKey(projectId));
    if (!raw) return { projectId, profileVersion: LEARNING_PROFILE_VERSION };
    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed, projectId);
  } catch { /* ignore corrupt data */ }
  return { projectId, profileVersion: LEARNING_PROFILE_VERSION };
}

/** Save project-local preferences. */
export function savePreferences(prefs: ProjectPreferences): void {
  try {
    const toSave: ProjectPreferences = {
      ...prefs,
      profileVersion: prefs.profileVersion ?? LEARNING_PROFILE_VERSION,
      lastUpdated: nowIso(),
    };
    localStorage.setItem(safeKey(toSave.projectId), JSON.stringify(toSave));
  } catch { /* storage full or unavailable — silent */ }
}

/** Explicitly allow project-local learning for selected sources and uses. */
export function grantLearningConsent(
  projectId: string,
  options: LearningConsentOptions = {},
): ProjectPreferences {
  const prefs = loadPreferences(projectId);
  const next: ProjectPreferences = {
    ...prefs,
    profileVersion: LEARNING_PROFILE_VERSION,
    consent: {
      enabled: true,
      version: LEARNING_PROFILE_VERSION,
      acceptedAt: nowIso(),
      sources: options.sources ?? ["current-project"],
      uses: options.uses ?? ["suggestions"],
      notes: options.notes,
    },
  };
  savePreferences(next);
  return next;
}

/** Disable learning while keeping a small audit marker. Learned fields are removed. */
export function revokeLearningConsent(projectId: string): ProjectPreferences {
  const prefs = loadPreferences(projectId);
  const next: ProjectPreferences = {
    projectId,
    profileVersion: LEARNING_PROFILE_VERSION,
    consent: {
      enabled: false,
      version: LEARNING_PROFILE_VERSION,
      acceptedAt: prefs.consent?.acceptedAt,
      revokedAt: nowIso(),
      sources: prefs.consent?.sources ?? [],
      uses: prefs.consent?.uses ?? [],
      notes: prefs.consent?.notes,
    },
  };
  savePreferences(next);
  return next;
}

export function hasLearningConsent(projectId: string): boolean {
  return loadPreferences(projectId).consent?.enabled === true;
}

/** Record a single preference (merge into existing). */
export function recordPreference(
  projectId: string, key: keyof ProjectPreferences, value: unknown,
): ProjectPreferences {
  const prefs = loadPreferences(projectId);
  if (!prefs.consent?.enabled) return prefs;
  (prefs as Record<string, unknown>)[key] = value;
  savePreferences(prefs);
  return prefs;
}

/** Infer preferences from a context snapshot (heuristic). */
export function inferPreferences(
  ctx: { swing: number; density: number; energy: number; parts: Array<{ category: string }> },
  projectId: string,
): ProjectPreferences {
  const prefs = loadPreferences(projectId);
  if (!prefs.consent?.enabled) return prefs;

  const instrumentation: Record<string, number> = {};
  for (const p of ctx.parts) {
    instrumentation[p.category] = (instrumentation[p.category] ?? 0) + 1;
  }
  const next: ProjectPreferences = {
    ...prefs,
    projectId,
    swing: ctx.swing,
    humanize: Math.round(ctx.density * 50),
    instrumentation,
  };
  savePreferences(next);
  return next;
}

/** Clear all preferences for a project. */
export function clearPreferences(projectId: string): void {
  try { localStorage.removeItem(safeKey(projectId)); } catch { /* silent */ }
}
