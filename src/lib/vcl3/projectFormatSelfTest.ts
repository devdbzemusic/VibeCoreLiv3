// VibeCoreLiv3 — .vcl3 Format Self-Tests (Band 1 · D-05 QA).
//
// Reine, store-unabhängige Tests für Export/Import des .vcl3-Formats.
// Deckt: Roundtrip-Integrität, Versions-Handling (älter/gleich/neuer),
// Fehlerfälle (kaputtes JSON, falsches Format, fehlende Felder, orphan
// Referenzen, Bereichs-Clamping) und Migration-Registry.
//
// Ausführung: `window.runVcl3FormatTests()` im Browser/Android-Konsole.
// Folgt dem bewährten `window.runTimingTest`-Muster des Projekts — kein
// externer Test-Runner nötig (vitest wurde bewusst entfernt).

import {
  serializeProjectState, deserializeProject, validateProject, migrateProject,
  loadProjectPatch, VCL3_FORMAT, VCL3_FORMAT_VERSION,
  type ProjectState, type Vcl3Project,
} from "@/lib/vcl3/projectFormat";
import {
  buildDefaultParts, buildDefaultPattern, buildDefaultFx, buildDefaultMod, defaultMaster,
  type FxRouting,
} from "@/lib/model";
import { defaultArpConfig } from "@/lib/audio/arpEngine";

interface CaseResult { name: string; pass: boolean; detail?: string; }
function eq<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  const parts = buildDefaultParts();
  const patterns = [buildDefaultPattern(0, parts), buildDefaultPattern(1, parts)];
  return {
    bpm: 124,
    masterVolume: 82,
    master: defaultMaster(),
    parts,
    patterns,
    fx: buildDefaultFx(),
    fxRouting: "hybrid" as FxRouting,
    fxSharedFloor: false,
    mod: buildDefaultMod(),
    arp: defaultArpConfig(),
    selectedPattern: 1,
    selectedSceneIdx: 0,
    selectedPart: 2,
    qualityProfile: "HIGH",
    psychoPreset: "WARM",
    transport: {
      playing: false, currentPattern: 1, chain: [0, 1],
      chainSteps: [
        { patternId: 0, repeat: 2 },
        { patternId: 1, repeat: 1, skip: false, marker: "Drop" },
      ],
      queuedPattern: null,
      chainMode: "BOUNDARY", currentStep: 0, currentSceneIdx: 0, sceneLoopCount: 0,
    },
    ...overrides,
  };
}

function run(name: string, fn: () => void): CaseResult {
  try { fn(); return { name, pass: true }; }
  catch (e) { return { name, pass: false, detail: (e as Error).message }; }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

export interface Vcl3TestReport {
  total: number; passed: number; failed: number;
  pass: boolean;
  results: CaseResult[];
}

export function runVcl3FormatTests(): Vcl3TestReport {
  const cases: CaseResult[] = [];

  // ── Roundtrip ─────────────────────────────────────────────────────────────
  cases.push(run("roundtrip: serialize → deserialize → patch ist identisch", () => {
    const a = makeState();
    const proj = serializeProjectState(a, "RT");
    assert(proj.format === VCL3_FORMAT, "format nicht gesetzt");
    assert(proj.formatVersion === VCL3_FORMAT_VERSION, "formatVersion nicht gesetzt");
    assert(proj.name === "RT", "name nicht übernommen");
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(res.ok && !!res.project, "deserialize schlug fehl: " + res.error);
    const patch = loadProjectPatch(a, res.project as Vcl3Project);
    assert(eq(patch.bpm, a.bpm), "bpm nicht roundtripped");
    assert(eq(patch.masterVolume, a.masterVolume), "masterVolume nicht roundtripped");
    assert(eq(patch.selectedPattern, a.selectedPattern), "selectedPattern nicht roundtripped");
    assert(eq(patch.selectedPart, a.selectedPart), "selectedPart nicht roundtripped");
    assert(eq(patch.qualityProfile, a.qualityProfile), "qualityProfile nicht roundtripped");
    assert(eq(patch.psychoPreset, a.psychoPreset), "psychoPreset nicht roundtripped");
    assert(eq(patch.transport?.chain, a.transport.chain), "chain nicht roundtripped");
    assert(eq(patch.transport?.chainMode, a.transport.chainMode), "chainMode nicht roundtripped");
    // Song Mode (chainSteps) — Repeat/Skip/Marker müssen roundtrip-stabil sein.
    assert(Array.isArray(patch.transport?.chainSteps), "chainSteps nicht roundtripped");
    assert(eq(patch.transport?.chainSteps, a.transport.chainSteps), "chainSteps-Inhalt nicht roundtripped");
    assert(patch.transport?.playing === false, "Playback-Zustand dürfte nicht roundtripped werden");
    assert((patch as { activeVoices?: number }).activeVoices === 0, "activeVoices nicht zurückgesetzt");
  }));

  cases.push(run("roundtrip: serialisiertes Projekt teilt keine Live-Referenzen", () => {
    const a = makeState();
    const proj = serializeProjectState(a, "ISO");
    // Mutiere den Store-Snapshot im Projekt — darf die Quelldaten nicht ändern.
    (proj.project.parts as unknown[]).push({ id: 999 } as never);
    assert(a.parts.length === 16, "Live-Store wurde durch Serialisat mutiert (Referenz-Leak)");
  }));

  cases.push(run("roundtrip: patterns/partSteps/partNotes bleiben strukturell erhalten", () => {
    const a = makeState();
    const proj = serializeProjectState(a, "STR");
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(res.ok, "deserialize fehlgeschlagen");
    const p0 = (res.project as Vcl3Project).project.patterns[0];
    const a0 = a.patterns[0];
    assert(Array.isArray(p0.scenes), "scenes verloren");
    assert(p0.scenes.length === a0.scenes.length, "scenes-Länge geändert");
    assert(typeof p0.scenes[0].partSteps === "object", "partSteps verloren");
  }));

  // ── Versions-Handling ──────────────────────────────────────────────────────
  cases.push(run("version: gleiche Version wird akzeptiert", () => {
    const res = deserializeProject(serializeProjectState(makeState(), "V"));
    assert(res.ok, "aktuelle Version abgelehnt");
  }));

  cases.push(run("version: neuere Version wird abgelehnt", () => {
    const proj = serializeProjectState(makeState(), "V");
    proj.formatVersion = VCL3_FORMAT_VERSION + 1;
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(!res.ok, "neuere Version wurde fälschlich akzeptiert");
    assert(!!res.error && res.error.includes("neuer"), "falsche Fehlermeldung: " + res.error);
  }));

  cases.push(run("version: Migration von v1 ist Identity", () => {
    const proj = serializeProjectState(makeState(), "V");
    const migrated = migrateProject(JSON.parse(JSON.stringify(proj)), 1);
    assert(migrated !== undefined, "v1-Migration lieferte undefined");
    assert((migrated as Vcl3Project).formatVersion === VCL3_FORMAT_VERSION, "formatVersion nach Migration nicht gesetzt");
  }));

  cases.push(run("version: Migration aus nicht migrierbarer Version liefert undefined", () => {
    const proj = serializeProjectState(makeState(), "V");
    // fromVersion 0 hat keinen registrierten Migrator → undefined (aktuell ist v1 die Baseline).
    assert(migrateProject(JSON.parse(JSON.stringify(proj)), 0) === undefined, "nicht migrierbare Version wurde fälschlich migriert");
  }));

  // ── Fehlerfälle ─────────────────────────────────────────────────────────────
  cases.push(run("error: kein Objekt", () => {
    assert(!deserializeProject(null).ok, "null akzeptiert");
    assert(!deserializeProject("vcl3").ok, "String akzeptiert");
    assert(!deserializeProject(42).ok, "Zahl akzeptiert");
  }));

  cases.push(run("error: falsches Format", () => {
    const proj = serializeProjectState(makeState(), "V");
    (proj as unknown as Record<string, unknown>).format = "wav";
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(!res.ok && res.error?.includes("Falsches Format"), "falsches Format akzeptiert");
  }));

  cases.push(run("error: fehlende Pflichtfelder", () => {
    const proj = serializeProjectState(makeState(), "V");
    delete (proj.project as unknown as Record<string, unknown>).bpm;
    assert(!validateProject(proj).ok, "fehlendes bpm akzeptiert");
    const proj2 = serializeProjectState(makeState(), "V");
    delete (proj2.project as unknown as Record<string, unknown>).patterns;
    assert(!validateProject(proj2).ok, "fehlendes patterns akzeptiert");
  }));

  cases.push(run("error: patterns ohne id/Szenen", () => {
    const proj = serializeProjectState(makeState(), "V");
    (proj.project.patterns[0] as unknown as Record<string, unknown>).scenes = "x";
    assert(!validateProject(proj).ok, "kaputte scenes akzeptiert");
  }));

  cases.push(run("error: ungültige Enum-Werte", () => {
    const proj = serializeProjectState(makeState(), "V");
    proj.project.qualityProfile = "ULTRA" as never;
    assert(!validateProject(proj).ok, "ungültiges qualityProfile akzeptiert");
    const proj2 = serializeProjectState(makeState(), "V");
    proj2.project.transport.chainMode = "LOOP" as never;
    assert(!validateProject(proj2).ok, "ungültiges chainMode akzeptiert");
  }));

  cases.push(run("integrity: orphan partSteps/partNotes-Keys werden entfernt", () => {
    const a = makeState();
    // Füge einen orphan-Key (partId existiert nicht) in Scene 0 ein.
    const sc = a.patterns[0].scenes[0] as unknown as {
      partSteps: Record<string, unknown>; partNotes: Record<string, unknown>;
    };
    sc.partSteps = { ...sc.partSteps, 999: [{ on: true }] };
    sc.partNotes = { ...sc.partNotes, 999: [{ id: "x", step: 0, pitch: 60, length: 1, velocity: 100 }] };
    const proj = serializeProjectState(a, "OR");
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(res.ok, "deserialize mit orphan schlug fehl");
    const patch = loadProjectPatch(a, res.project as Vcl3Project);
    const scene0 = (patch.patterns as ProjectState["patterns"])[0].scenes[0];
    assert(!Object.prototype.hasOwnProperty.call(scene0.partSteps, 999), "orphan partSteps-Key nicht entfernt");
    assert(!Object.prototype.hasOwnProperty.call(scene0.partNotes, 999), "orphan partNotes-Key nicht entfernt");
    // Legitime Keys bleiben erhalten.
    const legitId = a.parts[0].id;
    assert(Object.prototype.hasOwnProperty.call(scene0.partSteps, legitId), "legitimer partSteps-Key verloren");
  }));

  cases.push(run("integrity: bpm außerhalb des Bereichs wird clampt", () => {
    const a = makeState({ bpm: 1 });
    const proj = serializeProjectState(a, "CL");
    // Validierung lässt bpm=1 durch (strukturrell okay), Patch clampt auf ≥40.
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(res.ok, "bpm=1 wurde strukturell abgelehnt (sollte nur clamped werden)");
    const patch = loadProjectPatch(a, res.project as Vcl3Project);
    assert(patch.bpm === 40, "bpm nicht auf 40 clampt: " + patch.bpm);
    const b = makeState({ bpm: 9999 });
    const patchB = loadProjectPatch(b, serializeProjectState(b, "CL"));
    assert(patchB.bpm === 240, "bpm nicht auf 240 clampt: " + patchB.bpm);
  }));

  cases.push(run("integrity: selectedPattern/selectedPart außerhalb Bereichs clampt", () => {
    const a = makeState({ selectedPattern: 999, selectedPart: 999 });
    const patch = loadProjectPatch(a, serializeProjectState(a, "CL"));
    assert(patch.selectedPattern === 1, "selectedPattern nicht clampt: " + patch.selectedPattern);
    assert(patch.selectedPart === a.parts.length - 1, "selectedPart nicht clampt: " + patch.selectedPart);
  }));

  cases.push(run("integrity: chainSteps mit orphan patternId werden entfernt", () => {
    const a = makeState();
    // Füge einen Chain-Step mit ungültigem patternId (999 existiert nicht) ein.
    a.transport.chainSteps = [
      { patternId: 0, repeat: 1 },
      { patternId: 999, repeat: 3, marker: "Ghost" },
      { patternId: 1, repeat: 2, skip: true },
    ];
    const proj = serializeProjectState(a, "CS");
    const res = deserializeProject(JSON.parse(JSON.stringify(proj)));
    assert(res.ok, "deserialize mit orphan chainStep schlug fehl");
    const patch = loadProjectPatch(a, res.project as Vcl3Project);
    const cs = patch.transport?.chainSteps ?? [];
    assert(cs.length === 2, "orphan chainStep nicht entfernt: " + cs.length);
    assert(cs.every((s) => s.patternId !== 999), "orphan patternId 999 durchgelassen");
    assert(cs[1].skip === true, "legitimer skip-Flag verloren");
    assert(cs[1].repeat === 2, "legitimer repeat-Wert verloren");
  }));

  cases.push(run("validation: ungültige chainSteps-Struktur wird abgelehnt", () => {
    const proj = serializeProjectState(makeState(), "VS");
    // chainSteps als Nicht-Array → Validierung fehlschlagen.
    (proj.project.transport as unknown as Record<string, unknown>).chainSteps = "not-an-array";
    assert(!validateProject(proj).ok, "chainSteps als String akzeptiert");
    const proj2 = serializeProjectState(makeState(), "VS");
    (proj2.project.transport as unknown as Record<string, unknown>).chainSteps = [{ repeat: 1 }];
    assert(!validateProject(proj2).ok, "chainStep ohne patternId akzeptiert");
  }));

  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  const report: Vcl3TestReport = {
    total: cases.length, passed, failed, pass: failed === 0, results: cases,
  };
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[Vcl3Format] ${passed}/${cases.length} passed · ${failed} failed · ${report.pass ? "PASS" : "FAIL"}`);
  for (const c of cases) {
    // eslint-disable-next-line no-console
    console[c.pass ? "log" : "error"](`${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? " — " + c.detail : ""}`);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
  return report;
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runVcl3FormatTests = runVcl3FormatTests;
}