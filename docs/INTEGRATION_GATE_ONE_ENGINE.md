# INTEGRATION GATE — ONE ENGINE (Web ↔ Native) — P1 GATE-READY

**Status:** 🟡 P1 GATE-READY — Adapter umgesetzt, Probe vorhanden, Divergenz-Plan festgelegt; echte Device-Evidenz muss auf Android noch erzeugt werden (Stand 2026-09-16)
**Ebene:** Plattform-Konstitution (VibeCore Univers SUPREMÉ, „One Engine, One Clock, Zero Legacy")
**Bezug:** ADR-005 (ENTSCHIEDEN 2026-08-18: WebView-`JavascriptInterface`, Interface-Name `VibeCoreNative` — Decision C), Task #38

---

## 1. Festgestellter Ist-Zustand (evidenzbasiert, Stand 2026-08-22)

Es existieren derzeit **zwei getrennte Ausführungspfade** für Audio:

| Pfad | Ort | Zustand |
|---|---|---|
| **Native Oboe Engine** | `native-android/app/src/main/cpp/` | Intern konstitutionskonform: EIN Oboe-Callback (`VibeCoreAudioEngine::onAudioReady`), EINE Clock (`VibeCoreSync`, PPQ 1920, sample-genaue Tick-Events), ein AudioNode-Graph (Groove = 1, Bass = 2, Voice = 3). Kein zweiter Thread/Scheduler im C++-Baum (grep-verifiziert). |
| **WebAudio Engine** | `src/lib/audio/engine.ts` (v1.2) | Vollständige parallele Architektur: Per-Part-Channel-Strips, 6 FX-Busse, Master-Kette, Voice-Allocator. Genutzt von 15+ Groovebox-Komponenten (SoundTab, ForgeTab, Bass3DSubtab, Synth3DSubtab, PerformanceTab, SyncTab, …). |

**Kernbefund (aktualisiert 2026-09-16):** Die Android-Erkennung und der
Transport-Seam sind aktiv. `AudioBackend.ts`, `NativeOboeBackend.ts` und
`nativeAudioRuntime.ts` sprechen ausschließlich reale
`window.VibeCoreNative`-Methoden. Auf Android wird der WebAudio-Scheduler beim
Transportstart nicht mitgestartet; im Browser bleibt der bestehende WebAudio-Pfad
aktiv. Ein nativer Startfehler setzt `audioReady` zurück und wird in der
Diagnose angezeigt, statt still auf WebAudio zurückzufallen.

Die Voice-Schnittstelle stellt acht Slot-basierte Mono-Float-Samples bereit.
Der TS-Adapter verwendet diese `voiceLoadSample`-, `voiceNoteOn`- und
`voiceNoteOff`-Methoden direkt. Eine vollständige Zuordnung der größeren
Web-Part-, Pattern- und FX-Welt ist ausdrücklich Teil des offenen
Divergenz-Plans. Dieser Plan ist jetzt in
`docs/NATIVE_DIVERGENCE_PLAN.md` verbindlich festgelegt.

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
2. ✅ **Adapter implementiert (Code-verifiziert, 2026-08-22):** Die dünne
   TS-Schicht mappt Lifecycle, Transport, Position, Tempo, Master-Gain,
   Latenz/Diagnose sowie Voice-Sample/Note-On/Off 1:1 auf die Kotlin-Bridge.
   Der Android-Transport startet nicht zusätzlich den WebAudio-Scheduler; im
   Browser bleibt der bisherige Fallback aktiv.
3. 🟡 **Probe implementiert, Device-Lauf offen:** `window.runNativeIntegrationGateProbe()`
   läuft über den TS-Adapter (`activateNativeAudio` → `NativeOboeBackend`) und
   prüft Transport Play/Stop/Tempo, Voice-Sample/Note-On/Off und Native
   Diagnostics. Der tatsächliche Hardware-Report muss auf Android erzeugt und
   zusammen mit `adb logcat` abgelegt werden.
4. ✅ **Divergenz-Plan festgelegt:** `docs/NATIVE_DIVERGENCE_PLAN.md` definiert,
   welche web-seitigen DSP-Funktionen nativ nachgezogen werden und welche
   Android-seitig bis zur Native-Parität keinen zweiten hörbaren Output-Pfad
   starten dürfen.

## 4. P1-Probe

Ausführung in Chrome DevTools für die Android-WebView:

```js
await window.runNativeIntegrationGateProbe()
```

Ein Gate-fähiger Report muss `pass: true`, `backendKind: "oboe-native"`, eine
positive `latencyMs` und bestandene Schritte für Bridge, Aktivierung, Tempo,
Transport, Voice-Sample/Note-Pfad, Stop und Diagnostics enthalten.

## 5. Ausdrücklicher Nicht-Beschluss

Dieses Dokument ändert **keinen** Code der beiden Engines. Die ADR-005-
Entscheidung selbst ist in `native-android/docs/adr/ADR-005-module-boundaries.md`
(Decision C) dokumentiert, nicht hier. Dieses Dokument fixiert den Gate-Zustand und die
Abnahmebedingungen im Sinne des Workflow-Gate-Verfahrens (SUPREMÉ APPROVED
erforderlich, bevor Implementierungsarbeit am Gate beginnt).
