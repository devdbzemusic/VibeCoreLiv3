# VibeCoreLiv3 — `.vcl3` Project Format Specification

**Status:** Production · **Container Format v2** (backward-compatible with v1) · **Container Layout v1**

This document is the normative specification for the VibeCoreLiv3 project file format (`.vcl3`). It is the authoritative reference for the serialiser (`src/lib/vcl3/`), the import/export UI, and any future native/external tooling that reads or writes `.vcl3` files.

---

## 1. Goals

- **Future-proof container** carrying the full musical project state plus embedded assets and future plugin data.
- **Backward compatibility** — every v1 file (flat JSON) remains readable by v2 readers without conversion.
- **Integrity** — cryptographic verification of the project body and every embedded asset (SHA-256).
- **Portability** — a single `.vcl3` file is a standard ZIP archive; any unzip tool can inspect it.
- **Extensibility** — versioned manifest, migration registry, reserved plugin slots, no schema break for the embedded project body.
- **Realtime-neutral** — the format layer never touches the audio thread; decode of embedded samples is a best-effort post-load step.

---

## 2. Two Format Generations

| Generation | Physical form | `formatVersion` | Reader |
|------------|---------------|-----------------|--------|
| **v1**     | Flat JSON object | `1`            | `deserializeProject` |
| **v2**     | ZIP container (this spec) | `2` | `parseContainer` |

A reader **detects the generation by magic bytes**:
- `50 4B 03 04` → ZIP → v2 container path.
- otherwise → JSON → v1 flat path.

A v2 container **embeds the v1 project schema unchanged** (`body.formatVersion = 1`). There is no project-schema break between v1 and v2; v2 only wraps v1 in a container and adds metadata, assets, plugins and integrity.

---

## 3. v2 Container Layout (ZIP, `containerVersion = 1`)

```
project.vcl3                          (ZIP archive, MIME application/zip)
├── manifest.json                      (header, metadata, asset directory, integrity)
├── project.json                       (v1 project body — see §4)
├── assets/<uuid>.wav                  (embedded sample assets, optional)
└── plugins/<uuid>.json                (plugin / extension data, optional)
```

### 3.1 Entry rules

- `manifest.json` is **always present, first, and stored uncompressed** so a reader can index the container without inflating anything.
- `project.json` is the v1 project body, optionally deflate-compressed.
- `assets/<uuid>.wav` — one entry per embedded sample, keyed by a UUIDv4. Sample assets are 16-bit PCM WAV (`audio/wav`).
- `plugins/<uuid>.json` — opaque plugin payload, one entry per plugin instance, keyed by UUIDv4.
- ZIP method `0` (store) or `8` (deflate-raw) per entry. CRC32 is recorded in both the local and central ZIP headers; SHA-256 is the authoritative integrity record in the manifest.

---

## 4. `manifest.json` Schema

```jsonc
{
  "format": "vcl3",
  "formatVersion": 2,                 // container format version
  "containerVersion": 1,              // ZIP layout version
  "appVersion": "1.0.0",
  "createdAt": "2026-07-31T13:35:00.000Z",
  "name": "My Groove",
  "uuid": "urn:uuid:…",               // UUIDv4 — identifies the work
  "compression": "store",             // "store" | "deflate" (default per-entry)
  "body": {
    "entry": "project.json",
    "sha256": "<hex>",
    "formatVersion": 1                // embedded project schema stays v1
  },
  "assets": [
    {
      "uuid": "<uuid>",
      "kind": "sample",               // "sample" | "binary"
      "name": "KICK 1.wav",
      "mime": "audio/wav",
      "partId": 0,                    // target Part.id for sample assets
      "sampleName": "KICK 1",         // matches Part.sampleName
      "size": 123456,                 // uncompressed bytes
      "sha256": "<hex>",
      "compression": "store",
      "entry": "assets/<uuid>.wav",
      "embedded": true
    }
  ],
  "plugins": [
    {
      "uuid": "<uuid>",
      "kind": "vcl3.remix.stemSet",   // namespaced plugin kind
      "size": 2048,
      "sha256": "<hex>",
      "compression": "store",
      "entry": "plugins/<uuid>.json"
    }
  ],
  "integrity": { "algorithm": "sha-256", "bodyHash": "<hex>" },
  "signature": {                          // optional — Ed25519 manifest signature (§17)
    "algorithm": "Ed25519",
    "publicKey": "<base64, raw 32 B>",    // issuer's public key (must be in app trusted list)
    "value": "<base64, 64 B>"             // signature over canonical manifest (minus signature)
  }
}
```

---

## 5. `project.json` (v1 Project Body)

Identical to the v1 flat-JSON `project` block (see `src/lib/vcl3/projectFormat.ts` → `ProjectState`):

```
bpm, masterVolume, master, parts, patterns, fx, fxRouting,
fxSharedFloor, mod, arp, selectedPattern, selectedSceneIdx,
selectedPart, qualityProfile, psychoPreset,
transport: { chain, chainMode, currentPattern, playing, queuedPattern,
             currentStep, currentSceneIdx, sceneLoopCount }
```

Field semantics are unchanged from v1. The container does **not** redefine the project schema; it only wraps it.

---

## 6. UUID System

- **Project UUID** (`manifest.uuid`): UUIDv4 generated at container build. Identifies the work across exports/imports. Two exports of the same in-progress session get different UUIDs (each export is a snapshot).
- **Asset UUID** (`assets[].uuid`): UUIDv4 per embedded asset. Stable identity for a sample blob; survives round-trips.
- **Plugin UUID** (`plugins[].uuid`): UUIDv4 per plugin instance.

Implementation: `crypto.randomUUID()` with a deterministic RFC-4122 v4 fallback when `crypto.randomUUID` is unavailable.

---

## 7. Integrity

| Scope | Algorithm | Field | Verified on |
|-------|----------|-------|-------------|
| Project body | SHA-256 | `body.sha256` and `integrity.bodyHash` | `parseContainer` |
| Each asset | SHA-256 | `assets[].sha256` | `parseContainer` (per entry) |
| ZIP entry | CRC32 | ZIP local + central headers | (informational) |
| Manifest authenticity | Ed25519 | `signature.value` over canonical manifest (§17) | `verifyManifest` (optional) |

**Load policy (`detectAndLoad`):**
- Body SHA-256 mismatch → **reject** the file (integrity violation).
- Asset SHA-256 mismatch → the asset is dropped from the in-memory asset map (`assetIntegrity[uuid] = false`) but the project still loads; the affected sample is simply unavailable.

SHA-256 is computed via `crypto.subtle.digest("SHA-256")` (requires a secure context — production is HTTPS). If `crypto.subtle` is unavailable, hashes return `""` and integrity checks are treated as **not passing** (fail-closed).

---

## 8. Compression

- Default: **store** (no compression).
- Optional: **deflate-raw** (ZIP method 8) via the browser-native `CompressionStream("deflate-raw")` / `DecompressionStream("deflate-raw")`. No npm dependency.
- Per-entry decision: an entry is stored deflated **only if** deflate is available **and** the deflated payload is smaller than the original; otherwise it falls back to store.
- `manifest.json` is always stored uncompressed (indexability).
- If a reader encounters a deflate entry but `DecompressionStream` is unavailable, it throws a precise error rather than returning corrupt data.

---

## 9. Embedded Samples

A part carries an embedded sample when its `AssetEntry` has `kind: "sample"` and a `partId`. On import:

1. The asset bytes are decomp8ressed (if needed) and decoded via `AudioContext.decodeAudioData`.
2. The decoded `AudioBuffer` is assigned to the part via `assignBufferToPart(partId, buf)`.
3. `Part.sampleName` is set to the manifest `sampleName` so the UI reflects the embedded sample.

On export (`collectLoadedSampleAssets`), parts that currently have a loaded, valid buffer in the audio engine are encoded to 16-bit PCM WAV and embedded. Procedural/synth parts without a loaded sample produce no asset entry. This is a **preparation** layer: the container fully supports embedded samples; wiring arbitrary external sample sources is future work.

---

## 10. Plugin / Extension Data

`plugins/<uuid>.json` entries carry opaque plugin payloads. The manifest records `kind` (a namespaced string, e.g. `vcl3.remix.stemSet`), size, SHA-256 and compression. The container reader exposes the raw bytes (`ParsedContainer.plugins`) but **does not interpret** plugin data — interpretation is the responsibility of the owning module. This reserves a clean slot for future Remix / AI / extension data without touching the project schema.

---

## 11. Versioning & Migration

### 11.1 Version fields

- `formatVersion` — the container format version (currently `2`). Bumped on **breaking** manifest changes.
- `containerVersion` — the ZIP layout version (currently `1`). Bumped on structural ZIP changes.
- `body.formatVersion` — the embedded project schema version (currently `1`).

### 11.2 Migration registry

Project-schema migrations are governed by the registry in `projectFormat.ts` → `MIGRATIONS` (a `fromVersion → transform` map). Today only `v1` (identity) is registered. Future schema bumps register their up-grader there and bump `VCL3_FORMAT_VERSION`; the migrator walks `fromVersion → current` applying each step.

Container-format migrations follow the same pattern at the container layer: a reader rejects `formatVersion > CONTAINER_FORMAT_VERSION` with a precise error; future migrators are registered alongside `parseContainer`.

### 11.3 Backward compatibility guarantee

- **v1 → v2 reader:** always supported (magic-byte detection → v1 path).
- **v2 reader → v1 file:** always supported (v1 path unchanged).
- **v2 writer → v1 reader:** not guaranteed (a v1 reader cannot open a ZIP). To interoperate with v1-only tooling, export the v1 flat JSON via the legacy export path.

---

## 12. Realtime Safety

The format layer (`projectFormat.ts`, `container.ts`) is **pure / non-audible**:
- Build, validate, migrate, parse, hash and ZIP operations run on the main thread, never on the audio thread.
- The only audio interaction is `assignEmbeddedAssets`, which decodes embedded samples via `AudioContext.decodeAudioData` **after** the store has been updated, and is fully wrapped in try/catch — a decode failure leaves the project loaded and the audio engine untouched.
- Import stops the transport deterministically before applying the project state (see `loadProject`).

---

## 13. Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Not a ZIP and not valid JSON | `detectAndLoad` returns `{ ok: false, error }` |
| ZIP without `manifest.json` | `parseContainer` throws `manifest.json fehlt…` |
| `manifest.format !== "vcl3"` | throw `Kein vcl3-Container` |
| `formatVersion > 2` | throw `Container-Format-Version … nicht unterstützt` |
| Body SHA-256 mismatch | `detectAndLoad` rejects (integrity violation) |
| Asset SHA-256 mismatch | asset dropped, `assetIntegrity[uuid]=false`, project loads |
| File > 64 MB | `detectAndLoad` rejects |
| Deflate entry, no `DecompressionStream` | `readZip` throws precise error |
| `crypto.subtle` unavailable | hashes `""`, integrity fails closed |
| Signature present, Ed25519 unsupported | `verifyManifest` → `unsupported` |
| Signature present, public key not trusted | `verifyManifest` → `untrusted-key` |
| Signature present, invalid (tampered manifest) | `verifyManifest` → `invalid-signature` |
| Policy `require`, not verified | `detectAndLoad` rejects |

---

## 14. File Extension & MIME

- Extension: `.vcl3`
- MIME (recommended): `application/zip`
- Legacy v1 flat JSON uses `.vcl3.json` (MIME `application/json`).

---

## 15. Reference Implementation

- `src/lib/vcl3/projectFormat.ts` — v1 serialiser, validator, migrator, pure state patch, store wrappers.
- `src/lib/vcl3/container.ts` — v2 container (ZIP, SHA-256, CRC32, deflate, UUID, WAV, embedded samples, detection).
- `src/lib/vcl3/projectFormatSelfTest.ts` — v1 roundtrip / version / error self-tests.
- `src/lib/vcl3/projectFormatContainerSelfTest.ts` — v2 container roundtrip / integrity / compression / embedded-sample / signing self-tests.
- `src/lib/vcl3/signing.ts` — Ed25519 manifest signing/verification, trusted-key list, canonical manifest stream.
- UI: `src/components/groovebox/ProjectActions.tsx` (export container / import container-or-v1 / signature policy).

---

## 16. Test Vectors (self-test entry points)

Run in the browser/Android console:
- `window.runVcl3FormatTests()` — v1 layer.
- `window.runVcl3ContainerTests()` — v2 container layer.

Both return `{ total, passed, failed, pass, results }`.

---

## 17. Manifest Signature (Ed25519)

SHA-256 protects against **corruption**; Ed25519 protects against **intentional tampering**. Signing is **optional** and relevant when distributing Presets, Soundpacks or Community projects where provenance matters.

### 17.1 Model

- The signer signs the **canonical manifest stream** — the manifest serialized as deterministic JSON (all object keys sorted recursively) **with the `signature` field removed**. Both signer and verifier use the identical `canonicalManifestBytes` function, so the signed bytes are byte-identical regardless of key insertion order in the file.
- Because the canonical stream includes `body.sha256`, every `assets[].sha256` and every `plugins[].sha256`, a valid signature transitively guarantees the integrity of the **entire container** — body, assets and plugins — not just the manifest header.
- The signature carries the issuer's **public key** (Base64, raw 32 bytes). The app keeps a **trusted-key list** (`TRUSTED_PUBLIC_KEYS`); only manifests signed by a key in that list can reach state `verified`.

### 17.2 Manifest field

```jsonc
"signature": {
  "algorithm": "Ed25519",
  "publicKey": "<base64, raw 32 B>",
  "value":     "<base64, 64 B>"
}
```

`signature` is **optional**. Its absence is the common case (unsigned container). A present-but-unsupported `algorithm` yields state `unsupported`.

### 17.3 Verification states

| State | Meaning |
|-------|---------|
| `unsigned` | no `signature` field |
| `verified` | Ed25519 signature valid AND public key is in the trusted list |
| `untrusted-key` | signature well-formed but public key not trusted |
| `invalid-signature` | cryptographic verification failed (manifest tampered) |
| `unsupported` | Ed25519 not available in this browser, or unknown algorithm |

### 17.4 Policy

`detectAndLoad(file, policy)` accepts a policy:

- **`off`** — skip verification entirely (load unsigned and signed alike, no state reported).
- **`warn`** (default) — verify, expose the state, **load regardless**. The UI surfaces `SIGNATUR ✓` / `KEY NICHT VERTRAUT` / `SIGNATUR UNGÜLTIG`.
- **`require`** — reject unless `state === "verified"`. Use for trusted Preset/Soundpack channels.

### 17.5 Key management

- `generateSigningKeyPair()` (Ed25519 via Web Crypto) returns `{ publicKeyB64, privateKeyPkcs8B64 }`. Run **once per issuer**, out of band. Keep the PKCS#8 private key secret; publish the Base64 raw public key into the app's `TRUSTED_PUBLIC_KEYS` (or inject at runtime via `setTrustedPublicKeys`).
- The private key is **never** embedded in the app or the container — the app only verifies. Signing happens in the issuer's tooling.
- Ed25519 is native to Web Crypto in modern Chromium / Android Chrome. On browsers without it, signing/verification report `unsupported` and unsigned containers load normally.

### 17.6 Realtime safety

Signing/verification are pure main-thread `crypto.subtle` operations; they never touch the audio thread and never block transport start (verification runs after the body integrity check, before `loadProject`).

---

## 18. Chunking Roadmap (future — `containerVersion` 2)

The current layout (`containerVersion = 1`) embeds each asset as a single ZIP entry (`assets/<uuid>.wav`). This is fine for typical projects. For future **large Soundpacks** (many / large WAV samples), a chunked asset model is designed but **not yet implemented**:

### 18.1 Designed manifest extension

```jsonc
"assets": [
  {
    "uuid": "<uuid>",
    "kind": "sample",
    "name": "BIG.wav",
    "mime": "audio/wav",
    "partId": 3,
    "size": 8388608,                 // total uncompressed bytes
    "sha256": "<hex>",               // hash over the FULL asset
    "compression": "store",
    "entry": "assets/<uuid>/part",   // entry prefix (chunked)
    "embedded": true,
    "chunks": {
      "count": 16,                   // 16 × 512 KB parts
      "chunkSize": 524288,
      "lastChunkSize": 131072,
      "sha256": ["<hex>", "…×16"]    // per-chunk SHA-256
    }
  }
]
```

### 18.2 ZIP layout

```
assets/<uuid>/part-0000.bin
assets/<uuid>/part-0001.bin
…
assets/<uuid>/part-NNNN.bin
```

Each chunk is an independent, individually-seekable ZIP entry. The ZIP central directory already records every entry's offset and size, so a streaming reader can:

1. read only the central directory (already done for `manifest.json` indexing);
2. seek to a single chunk's local header by offset;
3. inflate/decompress just that chunk;
4. verify the chunk's per-chunk SHA-256.

### 18.3 Import strategy (designed)

- **Chunk-based import** — decode one chunk at a time, append to a `AudioBuffer` (or a `ReadableStream` piped into a decode worker) without holding the full asset in memory twice.
- **Lazy sample loading** — decode an embedded sample **when its part is first activated** (audition/trigger), not at container load. The manifest's `assets[].partId` already enables this mapping; the import path would register the asset UUID + entry prefix as a *deferred* sample and only call `decodeAudioData` on demand.
- **Streaming large WAVs** — for assets larger than a threshold (e.g. 4 MB), the reader streams chunks through a Web-Audio `AudioBuffer` built incrementally, or routes through the existing granular `AudioWorklet` (`granular-processor.worklet.ts`) for on-the-fly playback from disk-backed chunks.

### 18.4 Versioning

Chunking is gated behind `containerVersion = 2` (not the current `1`). A `containerVersion = 1` reader will simply ignore the `chunks` field and read `entry` as a single file — so **chunked assets remain forward-compatible** with the current reader only when `entry` also points to a reassembled single file. The clean approach for v2-only assets: bump `containerVersion`, register a layout migrator, and keep `formatVersion` at `2` (no manifest-schema break — `chunks` is an additive optional field).

This section is a **design reservation**, not a stub — the manifest shape, ZIP layout and reader algorithm are specified so a future implementation lands without redesigning the container.