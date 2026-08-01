// VibeCoreLiv3 — `.vcl3` Project Format (Band 1 · D-05) — produktionsreif.
//
// Architektur: strikt getrennte, testbare Schichten.
//   • Pure Kernfunktionen (keine Store-Abhängigkeit):
//       serializeProjectState(state, name)  → Vcl3Project
//       validateProject(raw)                 → Vcl3LoadResult
//       migrateProject(raw, fromVersion)     → unknown | undefined
//       loadProjectPatch(state, project)     → Partial<ProjectState>
//   • Side-Effect-Wrapper (Store + Audio-Rückkanäle):
//       serializeProject(name)  /  loadProject(project)
//       downloadVcl3(name)     /  importVcl3FromFile(file)
//
// Realtime-Sicherheit (Band 1 §7.2): Serialisierung/Validierung/Migration
// sind pure Funktionen, berühren niemals den Audiopfad. `loadProject` stoppt
// deterministisch den Transport vor dem Apply und überlässt die Audio-Parameter-
// Reapply der bestehenden `bindParamUpdates`-Subscription (feuert auf dem
// parts/fx/master-Slice-Wechsel). Kein Doppel-State-Modell (§7.5): die
// serialisierten Felder entsprechen 1:1 dem `partialize`-Slice des Stores.
//
// Format (formatVersion 1):
//   { format:"vcl3", formatVersion:1, appVersion, createdAt, name,
//     project:{ bpm, masterVolume, master, parts, patterns, fx, fxRouting,
//               fxSharedFloor, mod, arp, selectedPattern, selectedSceneIdx,
//               qualityProfile, psychoPreset,
//               transport:{ chain, chainSteps, chainMode, currentPattern } } }

import { useGroove, type TransportState, type ChainMode, type QualityMode, type PsychoPresetName } from "@/lib/store";
import type { MasterChannel, Part, Pattern, FxSlot, FxRouting, ModRoute, ChainStep } from "@/lib/model";
import type { ArpConfig } from "@/lib/audio/arpEngine";

export const VCL3_FORMAT = "vcl3" as const;
export const VCL3_FORMAT_VERSION = 1;
export const VCL3_APP_VERSION = "1.0.0";
/** Harde Grenze für Import-Dateigröße — schützt vor OOM bei korrupten/feindlichen Dateien. */
export const VCL3_MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export const FX_SLOTS = 6;
export const CHAIN_MODES: readonly ChainMode[] = ["IMMEDIATE", "BOUNDARY"];
export const QUALITY_MODES: readonly QualityMode[] = ["AUTO", "LOW", "MEDIUM", "HIGH"];
export const PSYCHO_PRESETS: readonly PsychoPresetName[] = ["NEUTRAL", "WARM", "CRUNCH", "HI_DEF"];

export interface Vcl3Transport {
  chain: number[];
  /** Song Mode — enhanced Pattern Chain (repeat counts, skip, markers). */
  chainSteps?: ChainStep[];
  chainMode: ChainMode;
  currentPattern: number;
}

/** Daten-Slice, der ein .vcl3-Projekt ausmacht (entspricht dem Store-`partialize`). */
export interface ProjectState {
  bpm: number;
  masterVolume: number;
  master: MasterChannel;
  parts: Part[];
  patterns: Pattern[];
  fx: FxSlot[];
  fxRouting: FxRouting;
  fxSharedFloor: boolean;
  mod: ModRoute[];
  arp: ArpConfig;
  selectedPattern: number;
  selectedSceneIdx: number;
  selectedPart: number;
  qualityProfile: QualityMode;
  psychoPreset: PsychoPresetName;
  transport: TransportState;
}

export interface Vcl3Project {
  format: typeof VCL3_FORMAT;
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  name: string;
  project: ProjectState;
}

export interface Vcl3LoadResult {
  ok: boolean;
  error?: string;
  project?: Vcl3Project;
}

const fail = (error: string): Vcl3LoadResult => ({ ok: false, error });
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const oneOf = <T extends string>(x: unknown, set: readonly T[]): x is T =>
  typeof x === "string" && (set as readonly string[]).includes(x);

// ── Pure: Serialisierung ─────────────────────────────────────────────────────

/** Erzeugt ein .vcl3-Projektobjekt aus einem Daten-Slice. Deep-isoliert via
 *  JSON-Roundtrip — der Rückgabewert teilt KEINE Referenzen mit dem Live-Store,
 *  sodass Aufrufer ihn nicht mutieren können. (Der Slice ist vollständig
 *  JSON-serialisierbar: keine AudioBuffer/Funktionen.) */
export function serializeProjectState(state: ProjectState, name = "Untitled"): Vcl3Project {
  const snapshot: ProjectState = JSON.parse(JSON.stringify({
    bpm: state.bpm,
    masterVolume: state.masterVolume,
    master: state.master,
    parts: state.parts,
    patterns: state.patterns,
    fx: state.fx,
    fxRouting: state.fxRouting,
    fxSharedFloor: state.fxSharedFloor,
    mod: state.mod,
    arp: state.arp,
    selectedPattern: state.selectedPattern,
    selectedSceneIdx: state.selectedSceneIdx,
    selectedPart: state.selectedPart,
    qualityProfile: state.qualityProfile,
    psychoPreset: state.psychoPreset,
    transport: {
      chain: state.transport.chain,
      // Song Mode (enhanced Pattern Chain) — Repeat-Counts, Skip-Flags, Marker.
      // Wird ebenfalls persistiert, damit ein komplettes Arrangement roundtrip-
      // stabil bleibt (entspricht dem store partialize-Slice).
      chainSteps: Array.isArray(state.transport.chainSteps) ? state.transport.chainSteps : [],
      chainMode: state.transport.chainMode,
      currentPattern: state.transport.currentPattern,
      // Playback-Zustand wird bewusst NICHT persistiert (entspricht partialize).
    },
  }));
  return {
    format: VCL3_FORMAT,
    formatVersion: VCL3_FORMAT_VERSION,
    appVersion: VCL3_APP_VERSION,
    createdAt: new Date().toISOString(),
    name: isStr(name) && name.length ? name.slice(0, 128) : "Untitled",
    project: snapshot,
  };
}

// ── Pure: Validierung (tief, strukturell) ────────────────────────────────────

/** Validiert ein geparstes Objekt strukturell als .vcl3-Projekt. */
export function validateProject(raw: unknown): Vcl3LoadResult {
  if (!isObj(raw)) return fail("Kein gültiges JSON-Objekt.");
  if (raw.format !== VCL3_FORMAT) return fail(`Falsches Format „${String(raw.format)}" — erwartet „${VCL3_FORMAT}".`);
  if (!isNum(raw.formatVersion)) return fail("formatVersion fehlt oder ist keine Zahl.");
  if (raw.formatVersion < 1) return fail(`formatVersion ${raw.formatVersion} ist ungültig.`);
  if (raw.formatVersion > VCL3_FORMAT_VERSION) {
    return fail(`Datei-Format-Version ${raw.formatVersion} ist neuer als unterstützt (max. ${VCL3_FORMAT_VERSION}).`);
  }
  if (!isStr(raw.appVersion)) return fail("appVersion fehlt.");
  if (!isStr(raw.createdAt)) return fail("createdAt fehlt.");
  if (!isStr(raw.name)) return fail("name fehlt.");
  const p = raw.project;
  if (!isObj(p)) return fail("project-Block fehlt.");
  if (!isNum(p.bpm)) return fail("project.bpm fehlt.");
  if (!isNum(p.masterVolume)) return fail("project.masterVolume fehlt.");
  if (!isObj(p.master)) return fail("project.master fehlt.");
  if (!Array.isArray(p.parts)) return fail("project.parts muss ein Array sein.");
  for (const part of p.parts) {
    if (!isObj(part) || !isNum(part.id)) return fail("project.parts[*].id fehlt.");
  }
  if (!Array.isArray(p.patterns) || p.patterns.length === 0) return fail("project.patterns muss ein nicht-leeres Array sein.");
  for (const pat of p.patterns) {
    if (!isObj(pat) || !isNum(pat.id)) return fail("project.patterns[*].id fehlt.");
    if (!Array.isArray((pat as Record<string, unknown>).scenes)) return fail(`project.patterns[${pat.id}].scenes muss ein Array sein.`);
  }
  if (!Array.isArray(p.fx)) return fail("project.fx muss ein Array sein.");
  if (!Array.isArray(p.mod)) return fail("project.mod muss ein Array sein.");
  if (!isObj(p.arp)) return fail("project.arp fehlt.");
  if (!isNum(p.selectedPattern)) return fail("project.selectedPattern fehlt.");
  if (!isNum(p.selectedSceneIdx)) return fail("project.selectedSceneIdx fehlt.");
  if (!isNum(p.selectedPart)) return fail("project.selectedPart fehlt.");
  if (!oneOf(p.qualityProfile, QUALITY_MODES)) return fail(`project.qualityProfile ungültig: ${String(p.qualityProfile)}`);
  if (!oneOf(p.psychoPreset, PSYCHO_PRESETS)) return fail(`project.psychoPreset ungültig: ${String(p.psychoPreset)}`);
  if (!isObj(p.transport)) return fail("project.transport fehlt.");
  if (!Array.isArray(p.transport.chain)) return fail("project.transport.chain muss ein Array sein.");
  // chainSteps (Song Mode) — optional in v1.0-Dateien, aber wenn vorhanden validieren.
  if (p.transport.chainSteps !== undefined && !Array.isArray(p.transport.chainSteps)) {
    return fail("project.transport.chainSteps muss ein Array sein.");
  }
  if (Array.isArray(p.transport.chainSteps)) {
    for (const cs of p.transport.chainSteps) {
      if (!isObj(cs) || !isNum(cs.patternId) || !isNum(cs.repeat)) {
        return fail("project.transport.chainSteps[*].patternId/repeat fehlt.");
      }
    }
  }
  if (!oneOf(p.transport.chainMode, CHAIN_MODES)) return fail(`project.transport.chainMode ungültig: ${String(p.transport.chainMode)}`);
  if (!isNum(p.transport.currentPattern)) return fail("project.transport.currentPattern fehlt.");
  return { ok: true, project: raw as Vcl3Project };
}

// ── Pure: Migration (versioniert, erweiterbar) ────────────────────────────────

/** Migrations-Registry: fromVersion → Transform. Aktuell nur v1 (Identity).
 *  Künftige Versionen registrieren hier ihre Up-/Down-Grader. Gibt `undefined`
 *  zurück, wenn die Quellversion nicht migriert werden kann. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => unknown> = {
  1: (raw) => raw, // Identity — Format v1 ist die Baseline.
};

export function migrateProject(raw: unknown, fromVersion: number): unknown | undefined {
  if (!isObj(raw)) return undefined;
  let cur = raw;
  let v = fromVersion;
  while (v < VCL3_FORMAT_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) return undefined;
    cur = fn(cur as Record<string, unknown>) as Record<string, unknown>;
    if (!cur) return undefined;
    v += 1;
  }
  // Setze/aktualisiere die Zieldatei-Version.
  (cur as Record<string, unknown>).formatVersion = VCL3_FORMAT_VERSION;
  return cur;
}

// ── Pure: Deserialisierung (validate + migrate) ───────────────────────────────

export function deserializeProject(raw: unknown): Vcl3LoadResult {
  if (!isObj(raw)) return fail("Kein gültiges JSON-Objekt.");
  if (raw.format !== VCL3_FORMAT) return fail(`Falsches Format „${String(raw.format)}".`);
  const fv = raw.formatVersion;
  if (!isNum(fv)) return fail("formatVersion fehlt.");
  if (fv > VCL3_FORMAT_VERSION) return fail(`Datei-Format-Version ${fv} wird nicht unterstützt.`);
  const migrated = migrateProject(raw, fv);
  if (migrated === undefined) return fail(`Migration von Version ${fv} fehlgeschlagen.`);
  return validateProject(migrated);
}

// ── Pure: State-Patch mit Sanitizing + Referenz-Integrität ────────────────────

/** Berechnet den Store-Patch für ein validiertes Projekt. Pure — mutiert
 *  weder den Store noch das Projekt. Sanitizes/clampt alle Werte und entfernt
 *  orphan partSteps/partNotes-Keys (Referenz-Integrität zu parts[]). */
export function loadProjectPatch(state: ProjectState, project: Vcl3Project): Partial<ProjectState> {
  const p = project.project;
  const parts: Part[] = Array.isArray(p.parts) ? p.parts : [];
  const patterns: Pattern[] = Array.isArray(p.patterns) ? p.patterns : [];
  const partIds = new Set(parts.map((pt) => pt.id));

  // Referenz-Integrität: entferne orphan Step/Note-Keys pro Scene.
  const sanitizedPatterns = patterns.map((pat) => {
    if (!pat || !Array.isArray(pat.scenes)) return pat;
    const scenes = pat.scenes.map((sc) => {
      if (!sc) return sc;
      const partSteps: Record<string, unknown> = {};
      const partNotes: Record<string, unknown> = {};
      if (sc.partSteps) {
        for (const k of Object.keys(sc.partSteps)) {
          if (partIds.has(Number(k))) partSteps[k] = sc.partSteps[k];
        }
      }
      if (sc.partNotes) {
        for (const k of Object.keys(sc.partNotes)) {
          if (partIds.has(Number(k))) partNotes[k] = sc.partNotes[k];
        }
      }
      return { ...sc, partSteps, partNotes };
    });
    return { ...pat, scenes };
  });

  const patIdx = clamp(p.selectedPattern, 0, Math.max(0, sanitizedPatterns.length - 1));
  const sceneCount = sanitizedPatterns[patIdx]?.scenes.length ?? 1;
  const scIdx = clamp(p.selectedSceneIdx, 0, Math.max(0, sceneCount - 1));

  return {
    bpm: clamp(p.bpm, 40, 240),
    masterVolume: clamp(p.masterVolume, 0, 100),
    master: p.master,
    parts,
    patterns: sanitizedPatterns,
    fx: Array.isArray(p.fx) ? p.fx : [],
    fxRouting: p.fxRouting,
    fxSharedFloor: !!p.fxSharedFloor,
    mod: Array.isArray(p.mod) ? p.mod : [],
    arp: p.arp,
    selectedPattern: patIdx,
    selectedSceneIdx: scIdx,
    selectedPart: parts.length ? clamp(p.selectedPart, 0, parts.length - 1) : 0,
    qualityProfile: p.qualityProfile,
    psychoPreset: p.psychoPreset,
    transport: {
      playing: false,
      currentPattern: clamp(p.transport.currentPattern, 0, Math.max(0, sanitizedPatterns.length - 1)),
      chain: Array.isArray(p.transport.chain) ? p.transport.chain.filter(isNum) : [],
      // Song Mode — sanitisiere chainSteps: nur Steps mit gültigem patternId-Index
      // übernehmen (Referenz-Integrität zu patterns[]). repeat ≥ 1, skip/marker
      // optional. Verhindert orphan-Chain-Referenzen nach Projekt-Import.
      chainSteps: Array.isArray(p.transport.chainSteps)
        ? p.transport.chainSteps
            .filter((cs) => isObj(cs) && isNum(cs.patternId) && isNum(cs.repeat)
              && Number(cs.patternId) >= 0 && Number(cs.patternId) < sanitizedPatterns.length)
            .map((cs) => ({
              patternId: Number(cs.patternId),
              repeat: Math.max(1, Math.min(999, Math.round(Number(cs.repeat)))),
              ...(cs.skip === true ? { skip: true } : {}),
              ...(isStr(cs.marker) ? { marker: String(cs.marker).slice(0, 64) } : {}),
            }) as ChainStep)
        : [],
      queuedPattern: null,
      chainMode: p.transport.chainMode,
      currentStep: 0,
      currentSceneIdx: 0,
      sceneLoopCount: 0,
      // Globale Sync-Präferenzen werden aus dem Live-Store bewahrt, nicht
      // aus der Datei (quantizeGrid = Nutzereinstellung; die serialisierte
      // Datei enthält nur chain/chainMode/currentPattern). Transiente Sync-
      // Felder werden deterministisch zurückgesetzt, damit nach einem Load
      // kein inkonsistenter Zustand (verwaistes held/pendingSeek/rewind)
      // stehen bleibt (Band 4 §5.4 / §15 — keine inkonsistenten Zustände).
      quantizeGrid: state.transport.quantizeGrid ?? "off",
      held: null,
      pendingSeek: null,
      rewind: false,
      syncStatus: state.transport.syncStatus ?? {
        source: "internal", confidence: 1, externalActive: false,
        midiConnected: false, error: null,
      },
    },
    // Transient — nicht aus Datei übernehmen.
    playheads: { step: 0, sceneIdx: 0, sceneLoop: 0, songTicks: 0 },
    activeVoices: 0,
  } as Partial<ProjectState>;
}

// ── Side-Effect-Wrapper: Store + Audio-Rückkanäle ────────────────────────────

/** Liest den Daten-Slice aus dem Live-Store. Pure Lesefunktion — keine Mutation. */
export function projectStateFromStore(): ProjectState {
  const s = useGroove.getState();
  return {
    bpm: s.bpm, masterVolume: s.masterVolume, master: s.master,
    parts: s.parts, patterns: s.patterns, fx: s.fx, fxRouting: s.fxRouting,
    fxSharedFloor: s.fxSharedFloor, mod: s.mod, arp: s.arp,
    selectedPattern: s.selectedPattern, selectedSceneIdx: s.selectedSceneIdx,
    selectedPart: s.selectedPart, qualityProfile: s.qualityProfile,
    psychoPreset: s.psychoPreset,
    transport: {
      chain: s.transport.chain, chainMode: s.transport.chainMode,
      chainSteps: s.transport.chainSteps ?? [],
      currentPattern: s.transport.currentPattern, playing: s.transport.playing,
      queuedPattern: s.transport.queuedPattern, currentStep: s.transport.currentStep,
      currentSceneIdx: s.transport.currentSceneIdx, sceneLoopCount: s.transport.sceneLoopCount,
    },
  };
}

/** Serialisiert den aktuellen Live-Store-Stand (v1-Schema). */
export function serializeProject(name = "Untitled"): Vcl3Project {
  return serializeProjectState(projectStateFromStore(), name);
}

/** Lädt ein validiertes Projekt in den Live-Store. Stoppt vorher deterministisch
 *  den Transport, wendet den sanitizierten Patch an und reapplyt das psycho-
 *  akustische Preset über die Store-Action (DSP-Seiteneffekt). */
export function loadProject(project: Vcl3Project): void {
  const s = useGroove.getState();
  if (s.transport.playing) useGroove.getState().resetTransport();
  const patch = loadProjectPatch(s as unknown as ProjectState, project);
  useGroove.setState(patch as Parameters<typeof useGroove.setState>[0]);
  // Psychoakustik live anwenden — sauber über die Action (kein require/import-Hack).
  try { useGroove.getState().setPsychoPreset(patch.psychoPreset as PsychoPresetName); } catch { /* Store-Wert reicht */ }
}

// ── Datei-IO ──────────────────────────────────────────────────────────────────

/** Löst einen .vcl3-Download im Browser aus. */
export function downloadVcl3(name = "Untitled"): { files: number; bytes: number } {
  const project = serializeProject(name);
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (name || "untitled").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 48) || "untitled";
  a.href = url;
  a.download = `${safe}.vcl3.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { files: 1, bytes: blob.size };
}

/** Liest eine .vcl3-Datei ein und lädt sie in den Store. Mit Dateigrößen-Guard. */
export async function importVcl3FromFile(file: File): Promise<Vcl3LoadResult> {
  if (file.size > VCL3_MAX_IMPORT_BYTES) {
    return fail(`Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB > ${VCL3_MAX_IMPORT_BYTES / 1024 / 1024} MB).`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    return fail(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
  }
  const res = deserializeProject(raw);
  if (!res.ok || !res.project) return res;
  loadProject(res.project);
  return { ok: true, project: res.project };
}