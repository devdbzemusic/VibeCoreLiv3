// @ts-nocheck
// VibeCoreLiv3 — .vcl3 Manifest-Signierung (Ed25519) — Band 1 · D-05 / Format v2.
//
// SHA-256 schützt vor Beschädigung, Ed25519 schützt vor absichtlicher
// Manipulation. Einsatz: Verteilung von Presets, Soundpacks und Community-
// Projekten mit vertrauenswürdiger Herkunft.
//
// Architektur:
//   • Signiert wird der kanonische Manifest-Strom OHNE das `signature`-Feld
//     (deterministisches JSON, rekursiv sortierte Keys → byte-identisch auf
//     Signer & Verifier).
//   • Die Signatur referenziert den öffentlichen Schlüssel (Base64, raw 32 B).
//   • Die App führt eine Trusted-Key-Liste (`TRUSTED_PUBLIC_KEYS`); nur darin
//     enthaltene Public-Keys werden akzeptiert (Herkunftsbindung).
//   • Verifikation ist optional — Policy `off` / `warn` / `require`.
//
// Realtime-neutral — reine kryptografische Haupt-Thread-Operationen via Web
// Crypto (`crypto.subtle`), kein Kontakt zum Audiopfad. Ed25519 ist in
// modernen Chromium-/Android-Chrome-Versionen nativ in WebCrypto verfügbar.

/** Trusted Public-Keys (Base64, raw 32-Byte Ed25519). Hier vertraute
 *  Herausgeber-Keys eintragen (Presets / Soundpacks / Community-Projekte). */
export const TRUSTED_PUBLIC_KEYS: string[] = [];

export function setTrustedPublicKeys(keys: string[]): void {
  TRUSTED_PUBLIC_KEYS.length = 0;
  TRUSTED_PUBLIC_KEYS.push(...keys);
}

export function hasEd25519(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

export interface ManifestSignature {
  algorithm: "Ed25519";
  /** Base64, raw 32-Byte Ed25519-Public-Key. */
  publicKey: string;
  /** Base64, 64-Byte Ed25519-Signatur über den kanonischen Manifest-Strom. */
  value: string;
}

export interface ManifestLike {
  signature?: ManifestSignature | null;
  [k: string]: unknown;
}

export type VerifyPolicy = "off" | "warn" | "require";

export type SignatureState =
  | "unsigned"
  | "verified"
  | "untrusted-key"
  | "invalid-signature"
  | "unsupported";

export interface SignatureVerification {
  state: SignatureState;
  reason: string;
  publicKey?: string;
}

// ── Base64 ────────────────────────────────────────────────────────────────────

export function bytesToB64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

export function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

// ── Kanonischer Manifest-Strom ────────────────────────────────────────────────

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/** Deterministischer UTF-8-Strom des Manifests OHNE das `signature`-Feld.
 *  Sortiert alle Objekt-Keys rekursiv → byte-identisch auf Signer & Verifier. */
export function canonicalManifestBytes(manifest: ManifestLike): Uint8Array {
  const { signature, ...rest } = manifest;
  void signature;
  return new TextEncoder().encode(JSON.stringify(sortKeys(rest)));
}

// ── Key-Erzeugung (Dev-Werkzeug — im Produktivbetrieb nicht in der App) ───────

export async function generateSigningKeyPair(): Promise<{
  publicKeyB64: string;
  privateKeyPkcs8B64: string;
}> {
  if (!hasEd25519()) throw new Error("Ed25519 in Web Crypto nicht verfügbar.");
  const kp = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const priv = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  return { publicKeyB64: bytesToB64(pub), privateKeyPkcs8B64: bytesToB64(priv) };
}

// ── Signieren ──────────────────────────────────────────────────────────────────

export async function signManifest(
  manifest: ManifestLike,
  privateKeyPkcs8B64: string,
  publicKeyB64: string,
): Promise<ManifestSignature> {
  if (!hasEd25519()) throw new Error("Ed25519 in Web Crypto nicht verfügbar.");
  const priv = await crypto.subtle.importKey("pkcs8", b64ToBytes(privateKeyPkcs8B64), "Ed25519", false, ["sign"]);
  const data = canonicalManifestBytes(manifest);
  const sig = await crypto.subtle.sign("Ed25519", priv, data);
  return { algorithm: "Ed25519", publicKey: publicKeyB64, value: bytesToB64(new Uint8Array(sig)) };
}

// ── Verifizieren ───────────────────────────────────────────────────────────────

export async function verifyManifest(
  manifest: ManifestLike,
  trustedKeys: string[] = TRUSTED_PUBLIC_KEYS,
): Promise<SignatureVerification> {
  if (!manifest.signature) return { state: "unsigned", reason: "keine Signatur vorhanden" };
  const sig = manifest.signature;
  if (sig.algorithm !== "Ed25519") return { state: "unsupported", reason: `Algorithmus ${String(sig.algorithm)} nicht unterstützt` };
  if (!hasEd25519()) return { state: "unsupported", reason: "Ed25519 in Web Crypto nicht verfügbar" };
  if (!trustedKeys.includes(sig.publicKey)) {
    return { state: "untrusted-key", reason: "öffentlicher Schlüssel nicht in der Trusted-Key-Liste", publicKey: sig.publicKey };
  }
  try {
    const pubKey = await crypto.subtle.importKey("raw", b64ToBytes(sig.publicKey), "Ed25519", false, ["verify"]);
    const data = canonicalManifestBytes(manifest);
    const ok = await crypto.subtle.verify("Ed25519", pubKey, b64ToBytes(sig.value), data);
    return ok
      ? { state: "verified", reason: "Signatur gültig", publicKey: sig.publicKey }
      : { state: "invalid-signature", reason: "Signatur ungültig — Manifest manipuliert", publicKey: sig.publicKey };
  } catch (e) {
    return { state: "invalid-signature", reason: "Verifikation fehlgeschlagen: " + (e as Error).message };
  }
}