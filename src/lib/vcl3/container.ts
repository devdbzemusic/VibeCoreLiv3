// VibeCoreLiv3 — `.vcl3` Container-Architektur (Band 1 · D-05 / Format v2).
//
// Container-Layout (ZIP-Archiv, containerVersion 1):
//   project.vcl3
//   ├── manifest.json     — Header, Metadaten, Asset-Verzeichnis, Integrität
//   ├── project.json      — v1-Projektbody (Schema unverändert → Abwärtskompat.)
//   ├── assets/<uuid>.wav — eingebettete Samples (optional)
//   └── plugins/<uuid>.json — Plugin-/Erweiterungsdaten (optional)
//
// Backward-Kompatibilität: v1-Dateien (flaches JSON) bleiben über den bestehenden
// `deserializeProject`-Pfad lesbar. Der Loader erkennt das ZIP-Magic
// (0x50 0x4B 0x03 0x04) und routet automatisch. v2-Writer bettet das v1-Schema
// unverändert ein (body.formatVersion=1) — kein Schema-Bruch.
//
// Integrität: SHA-256 über den Projekt-Body und jedes Asset (crypto.subtle).
// Kompression: pro Eintrag "store" (default) oder "deflate-raw" (browser-native
// CompressionStream/DecompressionStream — kein npm-Dependency). Reader verifiziert
// Hashes nach Decompression.
//
// Realtime-Sicherheit (Band 1 §7.2): Container-Build/Parse berühren niemals den
// Audiopfad; einzige Audio-Interaktion ist das optionale Decodieren eingebetteter
// Samples via decodeAudioData im Nachgang (best-effort, gekapselt).

import {
  projectStateFromStore, loadProject, validateProject,
  VCL3_APP_VERSION,
  type ProjectState, type Vcl3Project,
} from "./projectFormat";
import { useGroove } from "@/lib/store";
import { ensureAudio, getBuffer, assignBufferToPart, isValidAudioBuffer } from "@/lib/audio/engine";
import { signManifest, verifyManifest, hasEd25519, type ManifestSignature, type SignatureVerification, type VerifyPolicy } from "./signing";

// ── Format-Konstanten ─────────────────────────────────────────────────────────
export const CONTAINER_FORMAT = "vcl3" as const;
/** Container-Format-Version (Manifest-Ebene). */
export const CONTAINER_FORMAT_VERSION = 2;
/** Container-Layout-Version (ZIP-Eintragsstruktur). */
export const CONTAINER_LAYOUT_VERSION = 1;
/** Eingebetteter Projekt-Body bleibt v1 (Abwärtskompatibilität). */
export const BODY_FORMAT_VERSION = 1;
export const VCL3_EXTENSION = "vcl3";
export const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

export type Compression = "store" | "deflate";

// ── Typen ────────────────────────────────────────────────────────────────────

export interface AssetInput {
  uuid?: string;
  name: string;
  mime: string;
  /** Zielpart für Sample-Assets — Part, dem das Sample zugewiesen wird. */
  partId?: number;
  /** Passender Part.sampleName-Wert für die Zuordnung. */
  sampleName?: string;
  data: Uint8Array;
}

export interface PluginInput {
  uuid?: string;
  kind: string;
  data: Uint8Array;
}

export interface AssetEntry {
  uuid: string;
  kind: "sample" | "binary";
  name: string;
  mime: string;
  partId?: number;
  sampleName?: string;
  size: number;
  sha256: string;
  compression: Compression;
  entry: string;
  embedded: boolean;
}

export interface PluginEntry {
  uuid: string;
  kind: string;
  size: number;
  sha256: string;
  compression: Compression;
  entry: string;
}

export interface Vcl3Manifest {
  format: typeof CONTAINER_FORMAT;
  formatVersion: typeof CONTAINER_FORMAT_VERSION;
  containerVersion: typeof CONTAINER_LAYOUT_VERSION;
  appVersion: string;
  createdAt: string;
  name: string;
  /** Projekt-UUID (UUIDv4). Identifiziert das Werk eindeutig. */
  uuid: string;
  compression: Compression;
  body: { entry: string; sha256: string; formatVersion: typeof BODY_FORMAT_VERSION };
  assets: AssetEntry[];
  plugins: PluginEntry[];
  integrity: { algorithm: "sha-256"; bodyHash: string };
  /** Optionale Ed25519-Manifest-Signatur (Band 1 · D-05). */
  signature?: ManifestSignature;
}

export interface ContainerBuildOptions {
  name?: string;
  compression?: Compression;
  assets?: AssetInput[];
  plugins?: PluginInput[];
  /** Optionale Ed25519-Manifest-Signatur (Privat-Key PKCS8 + zugehöriger Public-Key, je Base64). */
  signing?: { privateKeyPkcs8B64: string; publicKeyB64: string };
}

export interface ParsedContainer {
  manifest: Vcl3Manifest;
  project: Vcl3Project;
  /** uuid → dekomprimierte Bytes. */
  assets: Map<string, Uint8Array>;
  /** uuid → Plugin-Bytes. */
  plugins: Map<string, Uint8Array>;
  integrityOk: boolean;
  assetIntegrity: Record<string, boolean>;
  /** Ergebnis der optionalen Ed25519-Manifest-Signaturverifikation. */
  signature?: SignatureVerification;
}

export interface ContainerLoadResult {
  ok: boolean;
  error?: string;
  project?: Vcl3Project;
  manifest?: Vcl3Manifest;
  integrityOk?: boolean;
  assetIntegrity?: Record<string, boolean>;
  signature?: SignatureVerification;
}

// ── UUID (v4) ────────────────────────────────────────────────────────────────

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Hashes ────────────────────────────────────────────────────────────────────

export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  try {
    const h = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

let CRC_TABLE: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP (Store + Deflate-raw, browser-native) ────────────────────────────────

interface ZipEntry { name: string; data: Uint8Array; compress: boolean; }

const hasDeflate = typeof CompressionStream !== "undefined";
const hasInflate = typeof DecompressionStream !== "undefined";

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (!hasDeflate) return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (!hasInflate) return null;
  try {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function dosDateTime(): number {
  const d = new Date();
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return (date << 16) | time;
}

/** Erzeugt ein ZIP-Archiv aus Einträgen. Pro Eintrag Store oder Deflate-raw
 *  (nur wenn kleiner). CRC32 wird im Local- und Central-Header geführt. */
export async function zipBuildEntries(entries: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder();
  const dt = dosDateTime();
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    let method = 0;
    let stored = e.data;
    if (e.compress) {
      const def = await deflateRaw(e.data);
      if (def && def.length < e.data.length) { method = 8; stored = def; }
    }
    const crc = crc32(e.data);

    const lh = new Uint8Array(30);
    const ldv = new DataView(lh.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(6, 0, true);
    ldv.setUint16(8, method, true);
    ldv.setUint16(10, dt & 0xffff, true);
    ldv.setUint16(12, (dt >>> 16) & 0xffff, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, stored.length, true);
    ldv.setUint32(22, e.data.length, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    chunks.push(lh, nameBytes, stored);

    const cd = new Uint8Array(46);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, method, true);
    cdv.setUint16(12, dt & 0xffff, true);
    cdv.setUint16(14, (dt >>> 16) & 0xffff, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, stored.length, true);
    cdv.setUint32(24, e.data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    central.push(cd, nameBytes);

    offset += lh.byteLength + nameBytes.byteLength + stored.byteLength;
  }

  let centralSize = 0;
  for (const c of central) centralSize += c instanceof Uint8Array ? c.byteLength : (c as Blob).size;
  const centralOffset = offset;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  chunks.push(...central, eocd);
  return new Blob(chunks, { type: "application/zip" });
}

/** Liest ein ZIP-Archiv in eine Map<entryName, bytes>. Dekomprimiert deflate-raw. */
export async function readZip(blob: Blob): Promise<Map<string, Uint8Array>> {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const dv = new DataView(ab);

  // EOCD finden (scanne die letzten ~64 KB).
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Kein ZIP-EOCD gefunden — Datei ist kein gültiger Container.");

  const total = dv.getUint16(eocd + 10, true);
  let cdOff = dv.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();

  for (let i = 0; i < total; i++) {
    if (dv.getUint32(cdOff, true) !== 0x02014b50) throw new Error("Central-Directory-Eintrag ungültig.");
    const method = dv.getUint16(cdOff + 10, true);
    const compSize = dv.getUint32(cdOff + 20, true);
    const nameLen = dv.getUint16(cdOff + 28, true);
    const extraLen = dv.getUint16(cdOff + 30, true);
    const commentLen = dv.getUint16(cdOff + 32, true);
    const localOff = dv.getUint32(cdOff + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cdOff + 46, cdOff + 46 + nameLen));

    const lhNameLen = dv.getUint16(localOff + 26, true);
    const lhExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    let data = bytes.subarray(dataStart, dataStart + compSize);
    if (method === 8) {
      const inf = await inflateRaw(data);
      if (inf) data = inf;
      else throw new Error(`Dekompression fehlgeschlagen für „${name}" (Deflate nicht verfügbar).`);
    }
    files.set(name, data.slice());
    cdOff += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ── WAV-Encoder (eingebettete Samples) ────────────────────────────────────────

/** Encodet einen AudioBuffer als 16-bit-PCM-WAV (Standard, verlustfrei). */
export function audioBufferToWav(buf: AudioBuffer): Uint8Array {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  let p = 0;
  const ws = (s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  const w32 = (v: number) => { dv.setUint32(p, v, true); p += 4; };
  const w16 = (v: number) => { dv.setUint16(p, v, true); p += 2; };
  ws("RIFF"); w32(36 + dataSize); ws("WAVE"); ws("fmt "); w32(16); w16(1); w16(numCh);
  w32(sr); w32(sr * blockAlign); w16(blockAlign); w16(16); ws("data"); w32(dataSize);
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      dv.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2;
    }
  }
  return new Uint8Array(ab);
}

// ── Container-Build ──────────────────────────────────────────────────────────

/** Sammelt aktuell geladene Sample-Buffer aus der Audio-Engine als Asset-Inputs
 *  (Parts mit gültigem Puffer → WAV). Nur Parts mit geladenem Sample werden
 *  eingebettet; prozedurale/synth-Parts bleiben ohne Asset. */
export async function collectLoadedSampleAssets(): Promise<AssetInput[]> {
  const out: AssetInput[] = [];
  const parts = useGroove.getState().parts;
  for (const p of parts) {
    const buf = getBuffer(p.id);
    if (!isValidAudioBuffer(buf)) continue;
    try {
      const wav = audioBufferToWav(buf);
      out.push({
        name: p.sampleName || `part_${p.id}.wav`,
        mime: "audio/wav",
        partId: p.id,
        sampleName: p.sampleName || `part_${p.id}`,
        data: wav,
      });
    } catch { /* Buffer nicht encodierbar — überspringen */ }
  }
  return out;
}

export async function buildContainer(state: ProjectState, opts: ContainerBuildOptions = {}): Promise<Blob> {
  const name = (opts.name || "Untitled").slice(0, 128);
  const compression: Compression = opts.compression ?? "store";
  const projectUuid = uuid();

  const proj = serializeProjectState(state, name);
  const projectJson = new TextEncoder().encode(JSON.stringify(proj.project, null, 2));
  const bodyHash = await sha256Hex(projectJson);

  const entries: ZipEntry[] = [
    { name: "manifest.json", data: new Uint8Array(0), compress: false }, // Platzhalter, unten ersetzt
    { name: "project.json", data: projectJson, compress: compression === "deflate" },
  ];

  const assetEntries: AssetEntry[] = [];
  for (const a of opts.assets ?? []) {
    const id = a.uuid || uuid();
    const entry = `assets/${id}.wav`;
    const sha = await sha256Hex(a.data);
    assetEntries.push({
      uuid: id, kind: a.partId != null ? "sample" : "binary",
      name: a.name, mime: a.mime, partId: a.partId, sampleName: a.sampleName,
      size: a.data.byteLength, sha256: sha, compression, entry, embedded: true,
    });
    entries.push({ name: entry, data: a.data, compress: compression === "deflate" });
  }

  const pluginEntries: PluginEntry[] = [];
  for (const pl of opts.plugins ?? []) {
    const id = pl.uuid || uuid();
    const entry = `plugins/${id}.json`;
    const sha = await sha256Hex(pl.data);
    pluginEntries.push({
      uuid: id, kind: pl.kind, size: pl.data.byteLength, sha256: sha, compression, entry,
    });
    entries.push({ name: entry, data: pl.data, compress: compression === "deflate" });
  }

  let manifest: Vcl3Manifest = {
    format: CONTAINER_FORMAT,
    formatVersion: CONTAINER_FORMAT_VERSION,
    containerVersion: CONTAINER_LAYOUT_VERSION,
    appVersion: VCL3_APP_VERSION,
    createdAt: new Date().toISOString(),
    name,
    uuid: projectUuid,
    compression,
    body: { entry: "project.json", sha256: bodyHash, formatVersion: BODY_FORMAT_VERSION },
    assets: assetEntries,
    plugins: pluginEntries,
    integrity: { algorithm: "sha-256", bodyHash },
  };
  // Optionale Ed25519-Manifest-Signatur (Band 1 · D-05). Signiert wird der
  // kanonische Manifest-Strom OHNE das `signature`-Feld — das nachträgliche
  // Einfügen der Signatur verändert die signierten Bytes nicht.
  if (opts.signing) {
    if (!hasEd25519()) throw new Error("Ed25519-Signierung angefordert, aber Web Crypto unterstützt Ed25519 nicht.");
    const sig = await signManifest(manifest, opts.signing.privateKeyPkcs8B64, opts.signing.publicKeyB64);
    manifest = { ...manifest, signature: sig };
  }
  // Manifest unkomprimiert voranstellen (Indexierbarkeit ohne Inflate).
  entries[0] = { name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)), compress: false };

  return zipBuildEntries(entries);
}

// ── Container-Parse ──────────────────────────────────────────────────────────

export async function parseContainer(blob: Blob): Promise<ParsedContainer> {
  const files = await readZip(blob);
  const manBytes = files.get("manifest.json");
  if (!manBytes) throw new Error("manifest.json fehlt im Container.");
  let manifest: Vcl3Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manBytes)) as Vcl3Manifest;
  } catch (e) {
    throw new Error("manifest.json nicht parsebar: " + (e as Error).message);
  }
  if (manifest.format !== CONTAINER_FORMAT) throw new Error(`Kein vcl3-Container (format=${String(manifest.format)}).`);
  if (manifest.formatVersion > CONTAINER_FORMAT_VERSION) {
    throw new Error(`Container-Format-Version ${manifest.formatVersion} wird nicht unterstützt (max. ${CONTAINER_FORMAT_VERSION}).`);
  }

  const bodyBytes = files.get(manifest.body.entry);
  if (!bodyBytes) throw new Error(`Projekt-Body „${manifest.body.entry}" fehlt im Container.`);
  const bodyHash = await sha256Hex(bodyBytes);
  const integrityOk = bodyHash !== "" && bodyHash === manifest.body.sha256;

  let project: Vcl3Project;
  try {
    const projectData = JSON.parse(new TextDecoder().decode(bodyBytes));
    project = {
      format: "vcl3", formatVersion: manifest.body.formatVersion,
      appVersion: manifest.appVersion, createdAt: manifest.createdAt,
      name: manifest.name, project: projectData,
    } as Vcl3Project;
  } catch (e) {
    throw new Error("project.json nicht parsebar: " + (e as Error).message);
  }
  const v = validateProject(project);
  if (!v.ok || !v.project) throw new Error("Eingebettetes Projekt invalid: " + (v.error ?? "unbekannt"));

  const assets = new Map<string, Uint8Array>();
  const assetIntegrity: Record<string, boolean> = {};
  for (const a of manifest.assets) {
    const d = files.get(a.entry);
    if (!d) { assetIntegrity[a.uuid] = false; continue; }
    const sha = await sha256Hex(d);
    assetIntegrity[a.uuid] = sha !== "" && sha === a.sha256;
    if (assetIntegrity[a.uuid]) assets.set(a.uuid, d);
  }

  const plugins = new Map<string, Uint8Array>();
  for (const p of manifest.plugins) {
    const d = files.get(p.entry);
    if (d) plugins.set(p.uuid, d);
  }

  const signature = await verifyManifest(manifest);
  return { manifest, project: v.project, assets, plugins, integrityOk, assetIntegrity, signature };
}

// ── Eingebettete Samples in die Audio-Engine laden (best-effort) ──────────────

async function assignEmbeddedAssets(parsed: ParsedContainer): Promise<void> {
  const samples = parsed.manifest.assets.filter((a) => a.kind === "sample" && a.partId != null && parsed.assets.has(a.uuid));
  if (!samples.length) return;
  try {
    const ctx = await ensureAudio();
    for (const a of samples) {
      const bytes = parsed.assets.get(a.uuid)!;
      let buf: AudioBuffer;
      try {
        buf = await ctx.decodeAudioData(bytes.slice().buffer);
      } catch { continue; }
      assignBufferToPart(a.partId!, buf);
      if (a.sampleName) useGroove.getState().setPartSampleName(a.partId!, a.sampleName);
    }
  } catch { /* Audio nicht bereit — Projekt trotzdem geladen, Samples entfallen */ }
}

// ── Detection + Load (v1 JSON ⇄ v2 Container) ────────────────────────────────

function isZip(header: Uint8Array): boolean {
  return header.length >= 4 && header[0] === ZIP_MAGIC[0] && header[1] === ZIP_MAGIC[1] && header[2] === ZIP_MAGIC[2] && header[3] === ZIP_MAGIC[3];
}

/** Erkennt anhand des Magic, ob eine v1-JSON- oder v2-Container-Datei vorliegt,
 *  und lädt sie in den Store. v1 → bestehender `deserializeProject`-Pfad;
 *  v2 → Container-Parse + Integritätsprüfung + eingebettete Samples. */
export async function detectAndLoad(file: File, policy: VerifyPolicy = "warn"): Promise<ContainerLoadResult> {
  if (file.size > 64 * 1024 * 1024) return { ok: false, error: "Datei zu groß (>64 MB)." };
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (isZip(header)) {
    try {
      const parsed = await parseContainer(file);
      if (!parsed.integrityOk) {
        // Integritätsverletzungen sind schwerwiegend — ablehnen.
        throw new Error("Integritätsprüfung fehlgeschlagen (Body-SHA-256 stimmt nicht überein).");
      }
      const sig: SignatureVerification = parsed.signature ?? { state: "unsigned", reason: "keine Signatur" };
      const deny = enforcePolicy(sig, policy);
      if (deny) return deny;
      loadProject(parsed.project);
      await assignEmbeddedAssets(parsed);
      return { ok: true, project: parsed.project, manifest: parsed.manifest, integrityOk: parsed.integrityOk, assetIntegrity: parsed.assetIntegrity, signature: sig };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  // v1 flaches JSON — keine Container-Signatur möglich.
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); }
  catch (e) { return { ok: false, error: "Datei konnte nicht gelesen werden: " + (e as Error).message }; }
  const { deserializeProject } = await import("./projectFormat");
  const res = deserializeProject(raw);
  if (!res.ok || !res.project) return { ok: false, error: res.error };
  const sig: SignatureVerification = { state: "unsigned", reason: "v1-Datei ohne Container-Signatur" };
  const deny = enforcePolicy(sig, policy);
  if (deny) return deny;
  loadProject(res.project);
  return { ok: true, project: res.project, integrityOk: true, signature: sig };
}

/** Setzt die Signatur-Policy durch. `require` lehnt ab, wenn die Signatur nicht
 *  von einem vertrauten Key gültig verifiziert wurde (state !== "verified"). */
function enforcePolicy(sig: SignatureVerification, policy: VerifyPolicy): ContainerLoadResult | null {
  if (policy === "require" && sig.state !== "verified") {
    return { ok: false, error: `Signatur erforderlich, aber nicht gültig (${sig.state}): ${sig.reason}` };
  }
  return null;
}

// ── Export (Download) ────────────────────────────────────────────────────────

/** Schreibt den aktuellen Projektstand als v2-Container und löst einen Download
 *  aus. Eingebettet werden aktuell geladene Sample-Buffer (collectLoadedSampleAssets). */
export async function downloadVcl3Container(
  name = "Untitled",
  compression: Compression = "store",
  extra?: { plugins?: PluginInput[] },
): Promise<{ files: number; bytes: number }> {
  const state = projectStateFromStore();
  const assets = await collectLoadedSampleAssets();
  const blob = await buildContainer(state, { name, compression, assets, plugins: extra?.plugins });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (name || "untitled").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 48) || "untitled";
  a.href = url;
  a.download = `${safe}.${VCL3_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { files: 1, bytes: blob.size };
}