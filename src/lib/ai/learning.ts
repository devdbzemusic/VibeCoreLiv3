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
  preferredChords?: number[];
  grooveStyle?: string;
  swing?: number;
  humanize?: number;
  instrumentation?: Record<string, number>;
  mixStyle?: string;
  genreAffinity?: Record<string, number>;
  lastUpdated?: string;
}

const STORAGE_PREFIX = "vibecore-ai-prefs::";

function safeKey(projectId: string): string {
  return STORAGE_PREFIX + projectId.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 64);
}

/** Load project-local preferences. Returns a fresh default if none saved. */
export function loadPreferences(projectId: string): ProjectPreferences {
  try {
    const raw = localStorage.getItem(safeKey(projectId));
    if (!raw) return { projectId };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return { ...parsed, projectId };
  } catch { /* ignore corrupt data */ }
  return { projectId };
}

/** Save project-local preferences. */
export function savePreferences(prefs: ProjectPreferences): void {
  try {
    const toSave: ProjectPreferences = { ...prefs, lastUpdated: new Date().toISOString() };
    localStorage.setItem(safeKey(toSave.projectId), JSON.stringify(toSave));
  } catch { /* storage full or unavailable — silent */ }
}

/** Record a single preference (merge into existing). */
export function recordPreference(
  projectId: string, key: keyof ProjectPreferences, value: unknown,
): ProjectPreferences {
  const prefs = loadPreferences(projectId);
  (prefs as Record<string, unknown>)[key] = value;
  savePreferences(prefs);
  return prefs;
}

/** Infer preferences from a context snapshot (heuristic). */
export function inferPreferences(
  ctx: { swing: number; density: number; energy: number; parts: Array<{ category: string }> },
  projectId: string,
): ProjectPreferences {
  const instrumentation: Record<string, number> = {};
  for (const p of ctx.parts) {
    instrumentation[p.category] = (instrumentation[p.category] ?? 0) + 1;
  }
  return {
    projectId,
    swing: ctx.swing,
    humanize: Math.round(ctx.density * 50),
    instrumentation,
    lastUpdated: new Date().toISOString(),
  };
}

/** Clear all preferences for a project. */
export function clearPreferences(projectId: string): void {
  try { localStorage.removeItem(safeKey(projectId)); } catch { /* silent */ }
}