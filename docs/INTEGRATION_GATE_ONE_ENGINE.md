# INTEGRATION GATE — ONE ENGINE (Web ↔ Native) — OFFEN (P1)

**Status:** 🔴 OFFEN — Gate nicht bestanden
**Ebene:** Plattform-Konstitution (VibeCore Univers SUPREMÉ, „One Engine, One Clock, Zero Legacy")
**Bezug:** ADR-005 (JSI vs. WebView-Bridge — Entscheidung offen), Task #38

---

## 1. Festgestellter Ist-Zustand (evidenzbasiert, Stand 2026-08-18)

Es existieren derzeit **zwei getrennte Ausführungspfade** für Audio:

| Pfad | Ort | Zustand |
|---|---|---|
| **Native Oboe Engine** | `native-android/app/src/main/cpp/` | Intern konstitutionskonform: EIN Oboe-Callback (`VibeCoreAudioEngine::onAudioReady`), EINE Clock (`VibeCoreSync`, PPQ 1920, sample-genaue Tick-Events), ein AudioNode-Graph (Groove = 1, Bass = 2, Voice = 3). Kein zweiter Thread/Scheduler im C++-Baum (grep-verifiziert). |
| **WebAudio Engine** | `src/lib/audio/engine.ts` (v1.2) | Vollständige parallele Architektur: Per-Part-Channel-Strips, 6 FX-Busse, Master-Kette, Voice-Allocator. Genutzt von 15+ Groovebox-Komponenten (SoundTab, ForgeTab, Bass3DSubtab, Synth3DSubtab, PerformanceTab, SyncTab, …). |

**Kernbefund:** In `src/` existiert **keine einzige Referenz** auf
`NativeAudioBridge`/`AudioBridge` (grep-verifiziert). Die Web-App ruft die
native Engine nirgends auf.

## 2. Konsequenz für die One-Rule

Die native Plattform erfüllt „ONE Engine / ONE Clock" **intern**. Die
**plattformweite** One-Engine-Regel ist jedoch **NICHT erfüllt**, solange die
Web-App eine eigene WebAudio-Engine betreibt und die native Engine ein
unverbundener Parallelstrang bleibt. Funktionale Divergenz bereits sichtbar:
FX Mix Lab existiert nur web-seitig; 3D Bass/Voice-DSP nur nativ.

## 3. Gate-Bedingungen (müssen ALLE erfüllt sein, bevor das Gate auf GO geht)

1. **Entscheidung dokumentiert (ADR-005):** WebView-`JavascriptInterface` vs.
   JSI/Alternative — inkl. Latenzbegründung und Messkriterien.
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

Dieses Dokument trifft **keine** Entscheidung zu ADR-005 und ändert **keinen**
Code der beiden Engines. Es fixiert nur den Gate-Zustand und die
Abnahmebedingungen im Sinne des Workflow-Gate-Verfahrens (SUPREMÉ APPROVED
erforderlich, bevor Implementierungsarbeit am Gate beginnt).
