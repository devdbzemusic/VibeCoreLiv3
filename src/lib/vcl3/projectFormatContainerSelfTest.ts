// @ts-nocheck
// VibeCoreLiv3 — .vcl3 Container Self-Tests (Band 1 · D-05 QA · Format v2).
//
// Reine Tests für die v2-Container-Architektur (ohne Store-Mutation):
//   • Roundtrip: buildContainer → parseContainer → Integrität + Projektgleichheit
//   • Eingebettete Samples: Asset-Bytes + Asset-Integrität
//   • Integritäts-Verletzung: tampered Body → integrityOk false
//   • Kompressions-Toggle: store ⇄ deflate beide parsebar
//   • v1-Erkennung: flaches JSON ist kein ZIP (wird zum v1-Pfad geroutet)
//   • Fehlerfälle: fehlendes Manifest, leere Datei
//
// Ausführung: `window.runVcl3ContainerTests()` im Browser/Android-Konsole.
// Folgt dem `window.run*`-Muster des Projekts. crypto.subtle (SHA-256) benötigt
// Secure Context (HTTPS/localhost) — sonst schlagen Integritäts-Tests fehl.

import {
  buildContainer, parseContainer, zipBuildEntries, readZip,
  type Vcl3Manifest, type AssetInput,
} from "@/lib/vcl3/container";
import { serializeProjectState, validateProject, type ProjectState, type Vcl3Project } from "@/lib/vcl3/projectFormat";
import { generateSigningKeyPair, verifyManifest, hasEd25519, setTrustedPublicKeys } from "@/lib/vcl3/signing";
import {
  buildDefaultParts, buildDefaultPattern, buildDefaultFx, buildDefaultMod, defaultMaster,
  type FxRouting,
} from "@/lib/model";
import { defaultArpConfig } from "@/lib/audio/arpEngine";

interface CaseResult { name: string; pass: boolean; detail?: string; }
function run(name: string, fn: () => Promise<void> | void): Promise<CaseResult> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => ({ name, pass: true } as CaseResult))
    .catch((e: Error) => ({ name, pass: false, detail: e.message } as CaseResult));
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
function eq<T>(a: T, b: T): boolean { return JSON.stringify(a) === JSON.stringify(b); }

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  const parts = buildDefaultParts();
  const patterns = [buildDefaultPattern(0, parts), buildDefaultPattern(1, parts)];
  return {
    bpm: 124, masterVolume: 82, master: defaultMaster(),
    parts, patterns, fx: buildDefaultFx(), fxRouting: "hybrid" as FxRouting,
    fxSharedFloor: false, mod: buildDefaultMod(), arp: defaultArpConfig(),
    selectedPattern: 1, selectedSceneIdx: 0, selectedPart: 2,
    qualityProfile: "HIGH", psychoPreset: "WARM",
    transport: {
      playing: false, currentPattern: 1, chain: [0, 1], queuedPattern: null,
      chainMode: "BOUNDARY", currentStep: 0, currentSceneIdx: 0, sceneLoopCount: 0,
    },
    ...overrides,
  };
}

export interface Vcl3ContainerTestReport {
  total: number; passed: number; failed: number; pass: boolean;
  results: CaseResult[];
}

export async function runVcl3ContainerTests(): Promise<Vcl3ContainerTestReport> {
  const cases: CaseResult[] = [];
  const hasSubtle = typeof crypto !== "undefined" && !!crypto.subtle;
  const hasInflate = typeof DecompressionStream !== "undefined";

  // ── Roundtrip (store) ───────────────────────────────────────────────────────
  cases.push(await run("roundtrip: build(store) → parse → Integrität + Projektgleichheit", async () => {
    const a = makeState();
    const blob = await buildContainer(a, { name: "RT", compression: "store" });
    const parsed = await parseContainer(blob);
    assert(parsed.integrityOk === true, "Body-Integrität nicht ok (SHA-256 mismatch)");
    assert(parsed.manifest.format === "vcl3", "format nicht gesetzt");
    assert(parsed.manifest.formatVersion === 2, "formatVersion nicht 2");
    assert(parsed.manifest.body.formatVersion === 1, "body.formatVersion nicht 1 (Abwärtskompat gebrochen)");
    assert(parsed.manifest.name === "RT", "name nicht übernommen");
    assert(eq(parsed.project.project.bpm, a.bpm), "bpm nicht roundtripped");
    assert(eq(parsed.project.project.selectedPattern, a.selectedPattern), "selectedPattern nicht roundtripped");
    assert(eq(parsed.project.project.transport.chain, a.transport.chain), "chain nicht roundtripped");
    assert(parsed.project.project.transport.playing === false, "Playback-Zustand roundtripped");
    assert(parsed.assets.size === 0, "unerwartete Assets im Empty-Projekt");
  }));

  // ── Eingebettete Samples ────────────────────────────────────────────────────
  cases.push(await run("roundtrip: eingebettetes Sample-Asset + Integrität", async () => {
    const a = makeState();
    const sample = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00]); // Dummy-Bytes
    const asset: AssetInput = {
      name: "KICK.wav", mime: "audio/wav", partId: 0, sampleName: "KICK",
      data: sample,
    };
    const blob = await buildContainer(a, { name: "SMP", assets: [asset] });
    const parsed = await parseContainer(blob);
    assert(parsed.manifest.assets.length === 1, "Asset nicht im Manifest");
    const ae = parsed.manifest.assets[0];
    assert(ae.kind === "sample", "Asset-Kind nicht 'sample'");
    assert(ae.partId === 0, "partId nicht übernommen");
    assert(parsed.assets.has(ae.uuid), "Asset-Bytes nicht geladen");
    assert(parsed.assetIntegrity[ae.uuid] === true, "Asset-SHA-256 stimmt nicht überein");
    assert(eq(Array.from(parsed.assets.get(ae.uuid)!), Array.from(sample)), "Asset-Bytes verändert");
  }));

  // ── Integritäts-Verletzung (tampered Body) ──────────────────────────────────
  cases.push(await run("integrity: tampered project.json → integrityOk false", async () => {
    const a = makeState();
    const blob = await buildContainer(a, { name: "TAMPER" });
    const parsed = await parseContainer(blob);
    assert(parsed.integrityOk === true, "original sollte intakt sein");
    const files = await readZip(blob);
    const manBytes = files.get("manifest.json")!;
    const manifest = JSON.parse(new TextDecoder().decode(manBytes)) as Vcl3Manifest;
    // Ersetze project.json durch manipulierte Bytes, behalte altes Manifest (staler sha).
    const tampered = new TextEncoder().encode(JSON.stringify({ ...a, bpm: 200 }));
    const rebuilt = await zipBuildEntries([
      { name: "manifest.json", data: manBytes, compress: false },
      { name: "project.json", data: tampered, compress: false },
    ]);
    const reparsed = await parseContainer(rebuilt);
    assert(reparsed.integrityOk === false, "tampered Body wurde als intakt akzeptiert");
    void manifest;
  }));

  // ── Kompressions-Toggle ────────────────────────────────────────────────────
  if (hasInflate) {
    cases.push(await run("compression: deflate-Container ist parsebar + intakt", async () => {
      const a = makeState();
      const blob = await buildContainer(a, { name: "ZIP", compression: "deflate" });
      const parsed = await parseContainer(blob);
      assert(parsed.integrityOk === true, "deflate-Integrität nicht ok");
      assert(eq(parsed.project.project.bpm, a.bpm), "bpm nach Deflate-Roundtrip geändert");
    }));
  }

  // ── Ed25519-Manifest-Signatur ──────────────────────────────────────────────────
  if (hasEd25519()) {
    cases.push(await run("signing: Ed25519-signierter Container wird verifiziert", async () => {
      const kp = await generateSigningKeyPair();
      setTrustedPublicKeys([kp.publicKeyB64]);
      try {
        const blob = await buildContainer(makeState(), {
          name: "SIG", compression: "store",
          signing: { privateKeyPkcs8B64: kp.privateKeyPkcs8B64, publicKeyB64: kp.publicKeyB64 },
        });
        const parsed = await parseContainer(blob);
        assert(parsed.integrityOk === true, "Integrität trotz gültiger Signatur nicht ok");
        assert(!!parsed.manifest.signature, "Signatur nicht im Manifest");
        assert(parsed.manifest.signature?.algorithm === "Ed25519", "Signatur-Algorithmus nicht Ed25519");
        assert(parsed.signature?.state === "verified", `Signatur nicht verifiziert (state=${parsed.signature?.state})`);
      } finally {
        setTrustedPublicKeys([]);
      }
    }));

    cases.push(await run("signing: untrusted Key → state 'untrusted-key'", async () => {
      const kp = await generateSigningKeyPair();
      setTrustedPublicKeys([]);
      try {
        const blob = await buildContainer(makeState(), {
          name: "UNTR", compression: "store",
          signing: { privateKeyPkcs8B64: kp.privateKeyPkcs8B64, publicKeyB64: kp.publicKeyB64 },
        });
        const parsed = await parseContainer(blob);
        assert(parsed.signature?.state === "untrusted-key", `falscher State: ${parsed.signature?.state}`);
        const v = await verifyManifest(parsed.manifest, []);
        assert(v.state === "untrusted-key", `verifyManifest(∅) State falsch: ${v.state}`);
      } finally {
        setTrustedPublicKeys([]);
      }
    }));
  } else {
    cases.push({ name: "SKIP: Ed25519 nicht verfügbar — Signatur-Tests übersprungen", pass: true });
  }

  // ── v1-Erkennung ────────────────────────────────────────────────────────────
  cases.push(await run("detection: flaches v1-JSON ist KEIN ZIP (Container-Pfad lehnt ab)", async () => {
    const v1 = serializeProjectState(makeState(), "V1");
    const json = new Blob([JSON.stringify(v1)], { type: "application/json" });
    let threw = false;
    try { await readZip(json); } catch { threw = true; }
    assert(threw, "v1-JSON wurde fälschlich als ZIP gelesen (würde v1-Pfad umgehen)");
  }));

  cases.push(await run("detection: v1-JSON ist als Projekt validierbar", async () => {
    const v1 = serializeProjectState(makeState(), "V1");
    const wrapped: Vcl3Project = {
      format: "vcl3", formatVersion: 1, appVersion: v1.appVersion,
      createdAt: v1.createdAt, name: v1.name, project: v1.project,
    };
    const res = validateProject(wrapped);
    assert(res.ok, "v1-Projekt nicht validierbar: " + res.error);
  }));

  // ── Fehlerfälle ────────────────────────────────────────────────────────────
  cases.push(await run("error: leere ZIP-Datei → parseContainer schlägt fehl", async () => {
    let threw = false;
    try { await parseContainer(new Blob([new Uint8Array(0)])); } catch { threw = true; }
    assert(threw, "leere Datei wurde akzeptiert");
  }));

  cases.push(await run("error: ZIP ohne manifest.json → Fehler", async () => {
    const blob = await zipBuildEntries([
      { name: "project.json", data: new TextEncoder().encode("{}"), compress: false },
    ]);
    let threw = false; let msg = "";
    try { await parseContainer(blob); } catch (e) { threw = true; msg = (e as Error).message; }
    assert(threw, "ZIP ohne Manifest wurde akzeptiert");
    assert(msg.includes("manifest"), "falsche Fehlermeldung: " + msg);
  }));

  // ── Secure-Context-Hinweis ──────────────────────────────────────────────────
  if (!hasSubtle) {
    cases.push({ name: "SKIP: crypto.subtle fehlt (kein Secure Context) — Integritäts-Tests übersprungen", pass: true });
  }

  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  const report: Vcl3ContainerTestReport = {
    total: cases.length, passed, failed, pass: failed === 0, results: cases,
  };
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[Vcl3Container] ${passed}/${cases.length} passed · ${failed} failed · ${report.pass ? "PASS" : "FAIL"}`);
  for (const c of cases) {
    // eslint-disable-next-line no-console
    console[c.pass ? "log" : "error"](`${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? " — " + c.detail : ""}`);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
  return report;
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).runVcl3ContainerTests = runVcl3ContainerTests;
}