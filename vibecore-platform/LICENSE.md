# LICENSE — VibeCoreLiv3

> Lizenzmodell: **dual**. Der Plattform-Kern ist proprietär; das SDK ist offen, um Drittentwickler zu ermöglichen. Third-Party-Komponenten behalten ihre eigenen Lizenzen.

## 1. VibeCoreLiv3 Platform Core (`src/core`, `src/modules`, `src/platform`)
**Proprietär — Alle Rechte vorbehalten.**
Nutzung, Modifikation und Weitergabe nur mit ausdrücklicher schriftlicher Lizenz der Rechteinhaberin. Unbefugte Nutzung, Reverse-Engineering oder Weitergabe des Kernels ist untersagt. Siehe Enterprise/Commercial-Lizenzvertrag.

## 2. VibeCoreLiv3 SDK (`src/sdk`, `examples/`, `specs/sdk`)
**Apache License, Version 2.0.**
Drittentwickler dürfen SDK-Header, Wrapper und Beispiele frei nutzen, modifizieren und weitergeben — inkl. kommerzieller Module — unter Beachtung der Apache-2.0-Bedingungen und des NOTICE-Attributs.
Volltext: `src/sdk/LICENSE-APACHE-2.0.txt`.

## 3. Third-Party-Komponenten
Jede eingebundene Drittkomponente wird in `THIRD_PARTY_NOTICES.md` (nachzulagern) mit Lizenz, Version und Urheber aufgeführt. Es gelten ausschließlich die jeweiligen Drittlizenzen. Beispiele: Oboe (Apache-2.0), Catch2/GoogleTest (BSL-1.0/APACHE-2.0), JUCE (ggf. AGPLv3/Kommerziell — je nach Wahl, in `17_Build_System.md` festzulegen).

## 4. Assets & Referenz-Presets (`assets/`, `tests/reference_audio/`)
Sofern nicht anderweitig gekennzeichnet: proprietär, nur für QA/Referenz innerhalb der Plattform. Beispiel-Presets sind **nicht** garantiert fehlerfrei; Nutzung auf eigene Verantwortung (Haftungsausschluss siehe Abschnitt 6).

## 5. Export-Compliance
Die Software kann kryptografische Signatur-/Integritätsprüfungen enthalten (siehe `16_Security.md`). Für Vertrieb in Regionen mit Exportkontrolle ist die Einhaltung geltender Vorschriften durch die verteilende Partei sicherzustellen.

## 6. Haftungsausschluss
Die Software wird „wie besehen" bereitgestellt. Die Rechteinhaberin haftet nicht für Schäden aus der Nutzung, insbesondere nicht für Schäden durch beispielhafte Presets, Sounds oder Module. Die Leistungsfähigkeit in zeitkritischen Audio-Anwendungen wird gemäß `CODING_STANDARD.md` best-effort zugesichert, nicht garantiert.

## 7. DSGVO / Datenschutz
Telemetrie ist Opt-in und anonymisiert (siehe `12_AI.md`, `16_Security.md`). Eine Datenschutz-Folgeabschätzung (DSFA) ist für jede Datenerhebung erforderlich; Dokumentation in `16_Security.md`.

## Kontaktpfad für Lizenzfragen
Senior Legal & Ethics Architect (Governance) — via `CONTRIBUTING.md` Change-Request-Kanal.