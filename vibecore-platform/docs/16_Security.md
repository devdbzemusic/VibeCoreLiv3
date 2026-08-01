# 16 — Security

> Phase/Doc 16 · Status: Draft v1.0 · Owner: Senior Legal & Ethics Architect + Senior Software System Architect · Review: 15-Rollen, 2/3-Mehrheit

## 1. Signierung & Manifest
- **Modul-Manifest** (`schemas/module.schema.json`): `api_version`, Pins, CPU-Schätzung, **Signatur** (Ed25519/SHA-256).
- **Asset-Integrität:** SHA-256-Hash pro Asset; verifiziert vor Laden.
- **Trust-Chain:** Plattform-Schlüssel signiert vertrauenswürdige Module; Drittmodule in Sandbox.

## 2. Deserialisierung
- Nur aus vertrauenswürdigen Quellen (verifizierte Signatur/Hash).
- Schema-Validierung vor Interpretation; Größen-Limits (keine großen Blobs in Feldern).
- Korrupte Daten ⇒ kontrollierte Ablehnung, kein Crash (`05_Project_Runtime.md`).

## 3. Berechtigungsmodell
- Modul deklariert Ressourcenbedarf (File/Netz/Asset); Host gewährt/verweigert.
- Drittmodule: **kein** direkter Netz-/Dateizugriff ohne Erlaubnis; Kommunikation über Host-API.

## 4. Telemetrie & Datenschutz
- **Opt-in**, anonymisiert; DSFA pro Datenerhebung (siehe `12_AI.md`, `LICENSE.md`).
- Keine PII; kein Projektnamen-Leak; On-Device-First.

## 5. Export-Compliance
- Kryptografie (Signatur) unterliegt Exportkontrollen; verteilende Partei verantwortlich (siehe `LICENSE.md`).

## 6. Fehler-/Sicherheits-Incident
- Recovery-First; Safe-Mode (Bypass, kein Host-Crash).
- Sicherheitsrelevante Fehler ⇒ separater Disclosure-Kanal (vertraulich), Fix + Disclosure-Zeitfenster.

## 7. Tests
- `tests/integration`: Modul-Lade-Signaturprüfung (gültig/ungültig/fälschlich).
- `tests/regression`: Deserialisierungs-Fuzzing (korrupte Dateien → kontrolliert).
- Sandbox-Test: Drittmodul versucht unautorisierten Zugriff → Blockade.