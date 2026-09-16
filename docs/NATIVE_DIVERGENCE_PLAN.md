# Native Divergenz-Plan — WebAudio ↔ Native Oboe

**Status:** verbindlicher P1-Plan für das Integration Gate „One Engine“
**Stand:** 2026-09-16
**Bezug:** `docs/INTEGRATION_GATE_ONE_ENGINE.md`, ADR-005 Decision C

## Ziel

Android darf im Runtime-Pfad keine zweite Audio-Clock betreiben. Die Web-App
bleibt UI-, Pattern- und Projekt-Source-of-Truth, aber Transport und hörbare
Instrumentenpfade werden im Android-WebView über `window.VibeCoreNative` an die
native Oboe-Engine delegiert. Im Browser bleibt WebAudio der produktive Pfad.

## Verbindliche Trennung

| Bereich | Browser | Android-WebView | Begründung |
|---|---|---|---|
| Transport Play/Stop/Tempo/Seek | WebAudio/MasterClock | Native Oboe/VibeCoreSync über `NativeOboeBackend` | Android braucht eine einzige Sample-Clock. |
| Master Gain | WebAudio Master | Native Engine Gain | Gleicher UI-Parameter, anderer Render-Pfad. |
| Voice Sample/Note-On/Off | WebAudio Voice | Native Voice über Slot 0..7 | P1-Instrumentenpfad für Gate-Nachweis. |
| Pattern-/Projektzustand | Zustand Store | Zustand Store | UI-State bleibt identisch und serialisierbar. |
| FX Mix Lab | WebAudio | Hybrid gesperrt für Audio-Ausgabe, bis native FX-Parität existiert | Verhindert zweite Clock und Dopplung des Output-Pfads. |
| 3D Bass/Synth Spezial-DSP | WebAudio-Module | Native Nachzug pro Modul-Gate | Keine stille Teilmigration ohne Gate. |
| Diagnostics | Web-Diagnostics | Native Diagnostics plus Probe-Report | Android-Gate braucht Bridge-/Latenz-/Transport-Evidenz. |

## Migrationsregeln

1. Native Android aktiviert sich ausschließlich über `window.VibeCoreNative`.
2. Der App-Code spricht Native nicht direkt an, sondern über `AudioBackend`,
   `NativeOboeBackend` und `nativeAudioRuntime`.
3. Bei aktivem nativen Pfad darf der WebAudio-Scheduler nicht parallel starten.
4. Ein nativer Startfehler setzt `audioReady=false` und bleibt sichtbar; es gibt
   keinen stillen Android-Fallback auf WebAudio.
5. Neue native Audiofunktionen brauchen zuerst einen Bridge-Vertrag, dann einen
   Web-Adapter, dann einen Device-Probe-Schritt.
6. WebAudio-only Funktionen bleiben im Android-WebView UI-seitig sichtbar nur,
   wenn sie keinen zweiten hörbaren Output-Pfad starten.

## Gate-Evidenz

Der P1-Nachweis wird über `window.runNativeIntegrationGateProbe()` erzeugt. Die
Probe nutzt absichtlich den TS-Adapter und nicht direkte
`window.VibeCoreNative.*`-Aufrufe:

```js
await window.runNativeIntegrationGateProbe()
```

Ein gültiger Report muss alle Schritte mit `pass: true` enthalten:

- `native bridge available`
- `activate native backend`
- `tempo roundtrip`
- `transport play`
- `voice sample and note path`
- `transport stop`
- `native diagnostics`

Der Report ist zusammen mit `adb logcat` als Hardware-Evidenz abzulegen.

## Offene Folgearbeiten nach P1

- Native FX-Mix-Parität oder explizites Modul-Gate für jeden hybrid bleibenden
  FX-Pfad.
- Native Mapping für größere Pattern-/Part-/Sample-Forge-Funktionen jenseits
  des P1-Voice-Slots.
- UI-Kennzeichnung für WebAudio-only Funktionen im Android-WebView, falls ein
  Modul vor vollständiger Native-Parität bedienbar bleibt.
