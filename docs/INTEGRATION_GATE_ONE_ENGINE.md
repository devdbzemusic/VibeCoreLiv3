# INTEGRATION GATE — ONE ENGINE (Web ↔ Native) — OFFEN (P1)

**Status:** 🔴 OFFEN — Gate nicht bestanden (Bedingung 1 von 4 erfüllt, Stand 2026-08-18)
**Ebene:** Plattform-Konstitution (VibeCore Univers SUPREMÉ, „One Engine, One Clock, Zero Legacy")
**Bezug:** ADR-005 (ENTSCHIEDEN 2026-08-18: WebView-`JavascriptInterface`, Interface-Name `VibeCoreNative` — Decision C), Task #38

---

## 1. Festgestellter Ist-Zustand (evidenzbasiert, Stand 2026-08-18)

Es existieren derzeit **zwei getrennte Ausführungspfade** für Audio:

| Pfad | Ort | Zustand |
|---|---|---|
| **Native Oboe Engine** | `native-android/app/src/main/cpp/` | Intern konstitutionskonform: EIN Oboe-Callback (`VibeCoreAudioEngine::onAudioReady`), EINE Clock (`VibeCoreSync`, PPQ 1920, sample-genaue Tick-Events), ein AudioNode-Graph (Groove = 1, Bass = 2, Voice = 3). Kein zweiter Thread/Scheduler im C++-Baum (grep-verifiziert). |
| **WebAudio Engine** | `src/lib/audio/engine.ts` (v1.2) | Vollständige parallele Architektur: Per-Part-Channel-Strips, 6 FX-Busse, Master-Kette, Voice-Allocator. Genutzt von 15+ Groovebox-Komponenten (SoundTab, ForgeTab, Bass3DSubtab, Synth3DSubtab, PerformanceTab, SyncTab, …). |

**Kernbefund (präzisiert 2026-08-18):** Die Web-App ruft die native Engine
nirgends auf. Es existiert jedoch ein **vorbereiteter, derzeit unverdrahteter**
Adapter-Seam: `src/lib/audio/AudioBackend.ts` + `NativeOboeBackend.ts` prüfen
auf `window.VibeCoreNative` und werden von keinem anderen App-Code importiert.
Darüber hinaus gibt es keine Referenzen auf die native Bridge in `src/`
(grep-verifiziert). Zusatzbefund: Das TS-Interface `VibeCoreNativeBridge`
(9 Methoden) ist ein Minimal-Subset und namentlich noch nicht mit den
Kotlin-Bridge-Methoden abgeglichen — Teil von Gate-Bedingung 2.

## 2. Konsequenz für die One-Rule

Die native Plattform erfüllt „ONE Engine / ONE Clock" **intern**. Die
**plattformweite** One-Engine-Regel ist jedoch **NICHT erfüllt**, solange die
Web-App eine eigene WebAudio-Engine betreibt und die native Engine ein
unverbundener Parallelstrang bleibt. Funktionale Divergenz bereits sichtbar:
FX Mix Lab existiert nur web-seitig; 3D Bass/Voice-DSP nur nativ.

## 3. Gate-Bedingungen (müssen ALLE erfüllt sein, bevor das Gate auf GO geht)

1. ✅ **ERFÜLLT (2026-08-18) — Entscheidung dokumentiert (ADR-005, Decision C):**
   WebView-`JavascriptInterface` ist final; JSI verworfen (Re-Evaluation nur via
   Review-Trigger). Verbindlicher Interface-Name: `window.VibeCoreNative`.
2. **Adapter implementiert:** Eine dünne TS-Schicht, die auf Android zur
   nativen Bridge routet und im Browser auf die WebAudio-Engine zurückfällt —
   ohne Doppel-Ausführung beider Engines.
3. **End-to-End verifiziert:** Mindestens Transport (Play/Stop/Tempo) und ein
   Instrumentenpfad (Note-On/Off) laufen nachweislich über die native Engine
   aus der WebView; Timing-Quelle ist ausschließlich VibeCoreSync.
4. **Divergenz-Plan:** Festgelegt, welche web-seitigen DSP-Funktionen (FX Mix
   Lab) nativ nachgezogen oder übergangsweise hybrid betrieben werden — ohne
   zweite Clock.

## 4. Ausdrücklicher Nicht-Beschluss

Dieses Dokument ändert **keinen** Code der beiden Engines. Die ADR-005-
Entscheidung selbst ist in `native-android/docs/adr/ADR-005-module-boundaries.md`
(Decision C) dokumentiert, nicht hier. Dieses Dokument fixiert den Gate-Zustand und die
Abnahmebedingungen im Sinne des Workflow-Gate-Verfahrens (SUPREMÉ APPROVED
erforderlich, bevor Implementierungsarbeit am Gate beginnt).
