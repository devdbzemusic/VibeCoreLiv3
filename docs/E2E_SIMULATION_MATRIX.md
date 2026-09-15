# E2E-Simulationsmatrix — VibeCoreLiv3

Stand: 2026-09-15

Zweck dieses Dokuments: eine verbindliche Matrix, mit der Use Cases, Funktionen,
Workflows, Bedienelemente, Fader, Drehregler und deren erwartete Auswirkungen
live in der App getestet und nachgewiesen werden können.

Diese Matrix ist kein Ersatz für Unit-Tests. Sie ist das Raster für Live-E2E:
Android-Gerät oder Browser starten, Bedienhandlung ausführen, sichtbare Wirkung,
Store-/Audio-Wirkung und Evidenz sichern.

## Testprinzip

Jeder Testfall muss mindestens diese Nachweise erzeugen:

| Evidenz | Mindestinhalt |
|---|---|
| Screenshot oder Video | Sichtbarer Zustand vor/nach der Aktion |
| Log | `adb logcat` oder Browser-Konsole ohne `FATAL`, `SIGSEGV`, `Uncaught`, `TypeError`, `ReferenceError` |
| State-Nachweis | sichtbarer Wert, UI-Label, Meter, selektierter Tab/Part oder exportierter Projektzustand |
| Audio-Nachweis | nur bei Audio-Fällen: hörbare Beobachtung, Meter-Ausschlag oder Bridge-/Engine-Status |
| Reproduktionspfad | Modul, Subtab, Part, Control, Eingabegeste, erwarteter Zielwert |

Live-Test-Baseline:

```powershell
npm run typecheck
npm run lint
npm run build:android

$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME='G:\Android\Sdk'
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
Push-Location native-android
.\gradlew.bat --no-daemon :app:installDebug '-Pandroid.injected.build.abi=arm64-v8a'
Pop-Location

adb logcat -c
adb shell am start -n com.vibecore.app/.MainActivity
```

Abbruchkriterien:

| Kriterium | Reaktion |
|---|---|
| Weißer Bildschirm > 15 s | Screenshot + Logcat sichern, Testlauf abbrechen |
| `AndroidRuntime`, `FATAL`, `SIGSEGV` | Full logcat sichern, Testlauf abbrechen |
| Audio hängt laut oder unkontrolliert | sofort Stop/Force-Stop, keinen weiteren hörbaren Test ohne Freigabe |
| UI nicht bedienbar durch Overlay/Bottomnav | Screenshot + betroffene Koordinaten/Control dokumentieren |

## Simulationsachsen

| Achse | Werte |
|---|---|
| Runtime | Android WebView, Browser Dev Server |
| Eingabe | Tap, Long-Press, Horizontal-Swipe, Vertikal-Swipe, Drag, Wheel, Dateiimport |
| Nachweis | Screenshot, Video, Logcat, Console, Store-Snapshot, Audio-Meter, Exportdatei |
| Risiko | Navigation, Touch-Handling, Audio-Engine, Persistenz, Datei-I/O, KI/Fallback, Native Bridge |
| Ergebnis | PASS, FAIL, BLOCKED, NOT APPLICABLE |

## Globale App- und Navigationsmatrix

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| NAV-001 | App Launch | App frisch starten | HOME wird nach Ladephase sichtbar, kein weißer Bildschirm | Screenshot HOME, Logcat ohne Fatal |
| NAV-002 | TopBar | BPM-Anzeige ansehen | BPM-Wert bleibt lesbar, TopBar überdeckt Content nicht | Screenshot |
| NAV-003 | TopBar | TAP-Button mehrfach tippen | BPM ändert sich plausibel nach Tap-Abstand | Vorher/Nachher-Screenshot oder Video |
| NAV-004 | TopBar | Play tippen | Transport startet, Play/Stop-Zustand ändert sich, Playhead/Meter reagieren falls Pattern aktiv | Video + Log |
| NAV-005 | TopBar | Stop tippen | Transport stoppt, Audio wird still | Video + Audio-Beobachtung |
| NAV-006 | TopBar | Quality/Audio-Indikator wechseln | Profil/Status bleibt bedienbar, kein Crash | Screenshot + Log |
| NAV-007 | Bottomnav | HOME -> GROOVE -> SYN -> BAS -> FRG -> FX -> VOC horizontal erreichen | Horizontaler Nav-Strip scrollt frei und wählt Module | Video oder Screenshot-Serie |
| NAV-008 | Bottomnav | In Modul mit Subtabs wechseln | Subtab-Leiste erscheint oberhalb Bottomnav | Screenshot |
| NAV-009 | Subtabs | GROOVE: ROLL/PTN/SND/ARP horizontal scrollen und wählen | Aktiver Subtab wechselt, Modulheader bleibt konsistent | Screenshot-Serie |
| NAV-010 | Layout | In langem Modul vertikal scrollen | Content scrollt zwischen TopBar und Bottomnav, letzte Controls bleiben erreichbar | Video |
| NAV-011 | Touch | Horizontaler Swipe auf Strip | Nur horizontaler Strip bewegt sich, App vertikal bleibt stabil | Video |
| NAV-012 | Touch | Vertikaler Swipe über normalem Content | Main-Content scrollt, Bottomnav bleibt sticky | Video |
| NAV-013 | Touch | Vertikaler Swipe über horizontalem Keyboard/Strip | Kein kompletter UI-Block; Nutzer kann außerhalb des Strips weiter vertikal scrollen | Video |
| NAV-014 | Safe Area | Gerät drehen oder Systemnav sichtbar lassen | Bottomnav kollidiert nicht dauerhaft mit Home-Indikator | Screenshot |

## HOME

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| HOME-001 | Startkarte | PLAY tippen | Transport startet und UI zeigt aktiven Zustand | Video |
| HOME-002 | BPM-Kachel | TAP tippen | BPM-Wert aktualisiert sich konsistent zur TopBar | Screenshot |
| HOME-003 | Modulkarte | GROOVE-Karte tippen | App navigiert zu GROOVE/ROLL | Screenshot Modulheader |
| HOME-004 | Modulkarte | 3D SYNTH-Karte tippen | App navigiert zu 3D SYNTH | Screenshot Modulheader |
| HOME-005 | Modulkarte | 3D BASS-Karte tippen | App navigiert zu 3D BASS | Screenshot Modulheader |
| HOME-006 | Modulkarte | FX MIX LAB-Karte tippen | App navigiert in FX-Lab | Screenshot |
| HOME-007 | Responsivität | HOME vertikal/horizontal prüfen | Kein unbeabsichtigter Horizontal-Overflow, Karten bleiben touchbar | Screenshot/Video |

## GROOVE / ROLL / Pattern / Piano Roll

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| GRV-001 | ROLL | GROOVE öffnen | Universal Piano Roll wird sichtbar | Screenshot |
| GRV-002 | Partwahl | Part auswählen | Selektierter Part wird markiert, Header/Editor beziehen sich auf diesen Part | Screenshot |
| GRV-003 | Drum Lane | Step tap toggeln | Step aktiviert/deaktiviert sich visuell und im Pattern | Screenshot vorher/nachher |
| GRV-004 | Piano Roll | Note setzen | Note-Rechteck erscheint an korrektem Pitch/Time-Raster | Screenshot |
| GRV-005 | Piano Roll | Note ziehen | Note verschiebt sich quantisiert, keine Überlappungsartefakte | Video |
| GRV-006 | Piano Roll | Note verlängern/kürzen | Länge ändert sich, Raster bleibt stabil | Video |
| GRV-007 | Piano Roll | Undo/Redo | Letzte Note-/Edit-Aktion wird rückgängig/wiederhergestellt | Screenshot-Serie |
| GRV-008 | Pattern | Pattern vor/zurück | Pattern-ID ändert sich, Patternzustand bleibt getrennt | Screenshot |
| GRV-009 | Scene | Scene wechseln/erstellen | Scene-Zähler und aktive Scene ändern sich | Screenshot |
| GRV-010 | Chain Drawer | Chain öffnen | Drawer erscheint, Hauptcontent bleibt scrollbar/schließbar | Video |
| GRV-011 | Automation Drawer | Automation öffnen | Drawer erscheint, Parameterlane ist bedienbar | Video |
| GRV-012 | Automation | Lane-Bar ziehen | Automationswert ändert sich und bleibt nach Schließen erhalten | Video + Reopen |
| GRV-013 | Playhead | Play starten | Playhead bewegt sich synchron zum Tempo | Video |
| GRV-014 | Transport | Stop nach laufendem Pattern | Playhead stoppt, keine hängenden Noten | Video + Audio-Beobachtung |

## GROOVE / SND / Sound Design

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| SND-001 | Part Picker | Horizontal scrollen | Alle Parts erreichbar, keine Scrollblockade | Video |
| SND-002 | Part Picker | Part auswählen | Ausgewählter Part steuert folgende Source-/Synth-Controls | Screenshot |
| SND-003 | Source | Source Sample/Synth/Hybrid wechseln | Nur für erlaubte Kategorie möglich, Sample-Slots bleiben geschützt | Screenshot + Store/Export optional |
| SND-004 | Wave | Start/End ziehen | Wave-Region ändert sich visuell | Screenshot |
| SND-005 | Wave | Reverse/Normalize/Fade anwenden | Status/Preview ändert sich, kein Crash | Screenshot + Log |
| SND-006 | Synth | Engine ändern | Engine-Label und verfügbare Parameter ändern sich | Screenshot |
| SND-007 | Synth | Attack/Decay/Sustain/Release-Knob ziehen | Wertanzeige ändert sich und Sound reagiert bei Trigger | Video + Audio-Beobachtung |
| SND-008 | Filter | Cutoff/Reso ändern | Wert ändert sich, Klang wird heller/dunkler bei Trigger | Video + Audio-Beobachtung |
| SND-009 | FX Sends | Send-Werte ändern | Send-Level ändert sich und wird in FX/MIX nachvollziehbar | Screenshot |
| SND-010 | Grain | Grain-Controls ändern | Visualizer/Parameter reagieren, kein UI-Block | Video |
| SND-011 | Stretch | Time/Pitch-Controls ändern | Anzeige und erwartete Stretch/Pitch-Werte ändern sich | Screenshot |
| SND-012 | Slice | Slice-Count ändern | Slice-Marker ändern sich plausibel | Screenshot |

## GROOVE / ARP

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| ARP-001 | Mode | Mode-Zelle zyklisch tippen | Arp-Mode wechselt zyklisch | Screenshot |
| ARP-002 | Rate | Rate-Knob ziehen | Rate-Wert ändert sich und Arp-Timing folgt | Video + Audio-Beobachtung |
| ARP-003 | Gate | Gate-Knob ziehen | Noten werden kürzer/länger | Audio-Beobachtung |
| ARP-004 | Swing | Swing-Knob ziehen | Timing verschiebt sich hörbar/visuell | Audio/Playhead-Beobachtung |
| ARP-005 | Chance | Chance-Knob ändern | Event-Dichte variiert bei Playback | Audio-Beobachtung |
| ARP-006 | Octave | Octave ändern | Arp spielt höhere/tiefere Lagen | Audio-Beobachtung |

## 3D SYNTH

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| SYN-001 | Navigation | 3D SYNTH öffnen | Modulheader 3D SYNTH, passender Synth-Part wird gewählt | Screenshot |
| SYN-002 | Part Safety | Von KICK aus SYN öffnen | Auswahl springt auf ersten Synth-Part statt Kick zu mutieren | Screenshot |
| SYN-003 | Voice Picker | Horizontal scrollen | Alle Parts erreichbar, Scroll blockiert nicht | Video |
| SYN-004 | Macro Direction | BRIGHT/DARK/PUNCH/DREAM tippen | Klangparameter ändern sich gemäß Preset-Richtung | Screenshot vorher/nachher |
| SYN-005 | Shape | OSC Shape tippen | Shape wechselt zyklisch | Screenshot |
| SYN-006 | Cutoff-Knob | Drag | Cutoff-Wert ändert sich, Klang wird heller/dunkler | Video + Audio-Beobachtung |
| SYN-007 | Reso-Knob | Drag | Resonanzwert ändert sich | Screenshot + Audio |
| SYN-008 | Attack/Decay/Sustain/Release | Drag je Control | Amp-Envelope-Werte ändern sich | Screenshot-Serie |
| SYN-009 | Reverb | Drag | Send-Wert ändert sich, Hallanteil hörbar | Audio-Beobachtung |
| SYN-010 | Secondary Panel | Panel öffnen/schließen | Seitliches Panel erscheint/verschwindet ohne Layoutbruch | Video |
| SYN-011 | Secondary Knobs | LFO/Detune/Width/Pan/Drive ändern | Werte ändern sich im Panel | Screenshot |
| SYN-012 | Keyboard | Taste C/D/E tippen | Note triggert Synth-Part, aktiver Key wird kurz markiert | Video + Audio |
| SYN-013 | Keyboard | Octave +/- tippen | OCT-Anzeige ändert sich und Tonhöhe folgt | Video + Audio |
| SYN-014 | Keyboard Strip | Horizontal scrollen | Alle 13 Tasten erreichbar | Video |
| SYN-015 | Vertical Scroll | Bis Deep Editor scrollen | Keyboard und Deep Editor vollständig über Bottomnav erreichbar | Video |
| SYN-016 | Deep Editor | Öffnen | Synth3DSubtab wird sichtbar | Screenshot |
| SYN-017 | Deep Editor Audition | Audition tippen | Synth-Part triggert ohne Crash | Audio + Log |

## 3D BASS

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| BAS-001 | Navigation | 3D BASS öffnen | Modulheader 3D BASS, passender Bass-Part wird gewählt | Screenshot |
| BAS-002 | Part Safety | Von KICK aus BAS öffnen | Auswahl springt auf ersten Bass-Part statt Kick zu mutieren | Screenshot |
| BAS-003 | Voice Picker | Horizontal scrollen | Alle Parts erreichbar, Scroll blockiert nicht | Video |
| BAS-004 | Sub-Fader | Horizontal ziehen | SUB-Wert ändert sich, Bassfundament reagiert | Video + Audio |
| BAS-005 | Punch-Fader | Horizontal ziehen | PUNCH-Wert ändert sich, Attack reagiert | Video + Audio |
| BAS-006 | Drive-Fader | Horizontal ziehen | DRIVE-Wert ändert sich, Sättigung reagiert | Video + Audio |
| BAS-007 | Filter-Fader | Horizontal ziehen | FILTER-Wert ändert sich, Klanghelligkeit reagiert | Video + Audio |
| BAS-008 | Width-Fader | Horizontal ziehen | WIDTH-Wert ändert sich, Stereo/Spatial-Eindruck reagiert | Audio-Beobachtung |
| BAS-009 | Glide-Fader | Horizontal ziehen | GLIDE-Wert ändert sich, Portamento reagiert | Audio-Beobachtung |
| BAS-010 | Mode | POLY/MONO/LEGATO tippen | Performance-Mode wechselt sichtbar | Screenshot |
| BAS-011 | AI Bassline | Button tippen | Bassnoten werden generiert, Piano Roll zeigt neue Notes | Screenshot vor/nach ROLL |
| BAS-012 | Keyboard | Taste C/D/E tippen | Bass-Part triggert im Bassregister | Video + Audio |
| BAS-013 | Keyboard | Octave +/- tippen | OCT-Anzeige ändert sich, Basslage bleibt begrenzt nutzbar | Video |
| BAS-014 | Vertical Scroll | Über Slider-Bereich scrollen | Vertikalscroll bleibt möglich, Slider blockieren nicht vollständig | Video |
| BAS-015 | Piano Roll Access | Button tippen | App wechselt zu GROOVE/ROLL mit Bass-Part selektiert | Screenshot |
| BAS-016 | Deep Editor | Öffnen | Bass3DSubtab sichtbar und bedienbar | Screenshot |

## SAMPLE FORGE

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| FRG-001 | Navigation | SAMPLE FORGE öffnen | Modulheader SAMPLE FORGE sichtbar | Screenshot |
| FRG-002 | Import | Audio-Datei auswählen | Datei wird geladen, Waveform/Name/Dauer erscheinen | Screenshot + Log |
| FRG-003 | Record/Render | Aufnahme/Render starten soweit verfügbar | Busy-Zustand sichtbar, Abschluss ohne Crash | Video |
| FRG-004 | Trim | Trim ausführen | Buffer/Region verkürzt sich, Status bestätigt | Screenshot |
| FRG-005 | Fade | Fade anwenden | Fade-Werte/Status aktualisieren sich | Screenshot |
| FRG-006 | Pitch | Pitch-Shift anwenden | Pitch-Wert/Status ändert sich, Audio reagiert | Audio |
| FRG-007 | Stretch | Time-Stretch anwenden | Stretch-Wert/Status ändert sich | Screenshot |
| FRG-008 | Spectral Freeze | Freeze rendern | Renderstatus abgeschlossen, kein UI-Hänger | Video + Log |
| FRG-009 | Slice | Slice-Count ändern | Marker neu verteilt | Screenshot |
| FRG-010 | Assign | Sample einem Sample-Part zuweisen | Part zeigt Sample-Namen und triggert Buffer | Screenshot + Audio |

## FX MIX LAB / MIX

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| MIX-001 | Navigation | FX -> MIX öffnen | MIX-Ansicht sichtbar | Screenshot |
| MIX-002 | Part Cell | Part auswählen | Selected Part und Sends beziehen sich auf diesen Part | Screenshot |
| MIX-003 | Volume-Fader | Ziehen | Lautstärke-Wert ändert sich, Meter/Audio reagieren | Video + Audio |
| MIX-004 | Pan-Knob | Ziehen | Pan-Wert ändert sich, Stereo-Lage reagiert | Audio |
| MIX-005 | Pitch-Knob | Ziehen | Pitch-Wert ändert sich, Tonhöhe reagiert | Audio |
| MIX-006 | Mute | Tippen | Part wird stumm, Status sichtbar | Audio + Screenshot |
| MIX-007 | Solo | Tippen | Nur solo geschaltete Parts hörbar | Audio + Screenshot |
| MIX-008 | Bus Routing | Bus-Ziel ändern | Part routePartMainToBus/Anzeige ändert sich | Screenshot |
| MIX-009 | Sends | Send je Bus ändern | FX-Anteil/Meter reagieren | Audio + Screenshot |
| MIX-010 | Master | Master-Level ändern | Gesamtpegel ändert sich, kein Clipping bei moderaten Werten | Meter/Audio |

## FX MIX LAB / FX

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| FX-001 | Navigation | FX-Subtab öffnen | FX-Bus-Strips sichtbar | Screenshot |
| FX-002 | Bus Strip | Bus auswählen/expandieren | ExpandedStrip zeigt Parameter | Screenshot |
| FX-003 | FX Type | Typ wechseln | Parameter passen zum Typ | Screenshot |
| FX-004 | Mix/Level-Knob | Ziehen | Wert ändert sich, FX-Anteil hörbar | Audio + Screenshot |
| FX-005 | Bypass/Mute | Tippen | FX-Bus wird deaktiviert/aktiviert | Audio |
| FX-006 | Routing Diagram | Diagramm prüfen | Routing entspricht gewählter Bus-Zuordnung | Screenshot |
| FX-007 | Master Meter | Playback aktiv | Meter bewegen sich ohne dauerhaftes Clippen | Video |

## FX MIX LAB / PERF

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| PERF-001 | Navigation | PERFORM öffnen | PerformanceTab sichtbar | Screenshot |
| PERF-002 | Crossfader | Ziehen | Mix-/Morph-Wert verändert sich | Video |
| PERF-003 | XY Pad | Drag | X/Y-Werte ändern sich, Macro-Ziele reagieren | Video |
| PERF-004 | Live Channel | Mute/Solo/Level bedienen | LiveChannel zeigt geänderten Zustand, Audio reagiert | Audio + Screenshot |
| PERF-005 | Macro | Macro triggern | Zugeordnete Parameter ändern sich | Screenshot |

## FX MIX LAB / REMIX

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| RMX-001 | Navigation | REMIX öffnen | RemixTab sichtbar | Screenshot |
| RMX-002 | AI Chain | AI Chain anwenden | Effektkette/Parameter aktualisieren sich | Screenshot |
| RMX-003 | Beat Repeat | Aktivieren/ändern | Repeat-Effekt hörbar bei Playback | Audio |
| RMX-004 | Stutter | Aktivieren/ändern | Stutter-Effekt hörbar, UI bleibt responsive | Audio + Video |
| RMX-005 | Glitch/Looper | Aktivieren/ändern | Effekt greift ohne Transport-Crash | Audio + Log |
| RMX-006 | Roll Link | Piano-Roll-Button tippen | Wechsel zu ROLL erfolgt | Screenshot |

## FX MIX LAB / PROD / 3D Matrix

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| PROD-001 | Navigation | 3D MTX öffnen | ProdTab sichtbar | Screenshot |
| PROD-002 | Matrix-Knobs | Parameter ziehen | Wert, Spectrum/HeatMap ändern sich | Video |
| PROD-003 | Render | Sample rendern | Renderstatus und Preview-Buffer entstehen | Screenshot + Log |
| PROD-004 | Play Preview | Preview abspielen | Gerenderter Klang hörbar | Audio |
| PROD-005 | Export | WAV exportieren | Datei/Blob wird erzeugt oder Download angestoßen | Browser/Android-Nachweis |

## VOICE

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| VOC-001 | Navigation | VOICE öffnen | VoiceTab sichtbar | Screenshot |
| VOC-002 | Permission | Mic-Permission anfragen | Android Permission-Dialog oder Status sichtbar | Screenshot |
| VOC-003 | Record | Aufnahme starten/stoppen | Recording-Indikator und Waveform reagieren | Video |
| VOC-004 | Pitch/Harmony | Slider ändern | Werte ändern sich, Voice-Engine reagiert bei Input | Screenshot/Audio |
| VOC-005 | Note Detection | Singen/Signal anlegen | erkannte Notes/Zähler ändern sich | Video |
| VOC-006 | Live Input | Aktivieren/deaktivieren | Input-Status toggelt, kein Feedback-Loop | Audio-Beobachtung |

## AI

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| AI-001 | Navigation | AI öffnen | AiSceneTab sichtbar | Screenshot |
| AI-002 | Generate | Scene/Groove generieren | Pattern/Parts/Notes werden aktualisiert | Screenshot vorher/nachher |
| AI-003 | Reroll | Seed/Reroll tippen | Vorschlag ändert sich deterministisch/plausibel | Screenshot |
| AI-004 | Apply | Vorschlag anwenden | Änderungen erscheinen in ROLL/MIX/SND | Screenshot-Serie |
| AI-005 | Activity Log | Aktionen ausführen | Logeintrag wird erzeugt | Screenshot |
| AI-006 | Offline/Fallback | Ohne Backend nutzen | Kein harter Crash; lokaler Fallback oder klare Fehlermeldung | Screenshot + Console |

## WAVE / BNARL

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| WAVE-001 | Navigation | WAVE/BNARL öffnen | BrainwaveTab sichtbar | Screenshot |
| WAVE-002 | Enable | Engine aktivieren/deaktivieren | Status ändert sich, Audio startet/stoppt kontrolliert | Audio + Screenshot |
| WAVE-003 | Mode | Binaural/Isochronic wechseln | Mode-Anzeige und Parameter ändern sich | Screenshot |
| WAVE-004 | Frequency-Knob | Frequenz ändern | Anzeige ändert sich, Ton/Beat-Frequenz folgt | Audio |
| WAVE-005 | Volume-Knob | Level ändern | Pegel hörbar/Meter plausibel | Audio |
| WAVE-006 | Solfeggio Row | Frequenz wählen | Aktive Frequenz wird markiert | Screenshot |
| WAVE-007 | Background | Aktiviert lassen und Modul wechseln | Engine bleibt gemäß Erwartung aktiv/stumm, kein Crash | Log + Audio |

## WAVE / SPTL

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| SPC-001 | Navigation | SPTL öffnen | SpatialTab sichtbar | Screenshot |
| SPC-002 | Canvas | Spatial Visual prüfen | Canvas rendert nicht leer | Screenshot |
| SPC-003 | Position | Spatial-Parameter ändern | Visual/Audio-Lage ändern sich | Video/Audio |
| SPC-004 | Sync | Spatial Sync aktivieren | Sync-Panel zeigt aktiven Zustand | Screenshot |

## SETTINGS / SETUP / SYNC / LIB / DBG

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| SET-001 | Navigation | SETTINGS öffnen | SettingsPage sichtbar | Screenshot |
| SET-002 | Setup | Audio/Quality-Option ändern | Einstellung ändert sich und bleibt im UI erhalten | Screenshot |
| SET-003 | Setup | Toggle bedienen | Toggle-Zustand wechselt, kein Layoutbruch | Screenshot |
| SET-004 | Setup | Numeric Field ändern | Wert wird clamp-konform übernommen | Screenshot |
| SYNC-001 | Sync | SYNC öffnen | SyncTab sichtbar | Screenshot |
| SYNC-002 | MIDI | MIDI Start/Stop soweit verfügbar | Status aktualisiert sich oder klare Fehlermeldung | Screenshot + Log |
| SYNC-003 | Clock | Clock-Quelle wechseln | MasterClock-Status ändert sich | Screenshot |
| LIB-001 | Library | LIB öffnen | Library-Ansicht sichtbar | Screenshot |
| LIB-002 | Preset Save | Preset speichern | Neuer Preset-Eintrag erscheint | Screenshot |
| LIB-003 | Preset Load | Preset laden | Projekt-/Groovezustand ändert sich plausibel | Screenshot-Serie |
| DBG-001 | Diagnostics | TopBar Diagnostics öffnen | DiagPanel/Modal erscheint | Screenshot |
| DBG-002 | Diagnostics | Export/Share JSON | Diagnose-Artefakt wird erzeugt oder Share-Flow startet | Datei-/Share-Nachweis |

## Projekt-, Import-, Export- und Persistenz-Workflows

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| PRJ-001 | Projekt | Neues Pattern/Scene anlegen | Zähler und selektierter Zustand ändern sich | Screenshot |
| PRJ-002 | Projekt | Projekt speichern/exportieren | Exportdatei entsteht oder Download/Share wird gestartet | Datei-Nachweis |
| PRJ-003 | Projekt | Projekt importieren | Zustand wird geladen, selectedPart/Pattern werden geclamped | Screenshot + Log |
| PRJ-004 | Persistenz | App schließen/öffnen | Relevante lokale Einstellungen bleiben erhalten | Screenshot vorher/nachher |
| PRJ-005 | Integrity | Sample-Part mit Synth-Editor öffnen | Sample-Slot bleibt sample-only, keine falsche Mutation | Screenshot/Store |
| PRJ-006 | Recovery | Fehlerhafte Datei importieren | Klare Fehlermeldung, kein Crash | Screenshot + Log |

## Native Android / WebView / Bridge

| ID | Bereich | Bedienhandlung | Erwartete Wirkung | E2E-Nachweis |
|---|---|---|---|---|
| AND-001 | Install | APK installieren | Gradle `BUILD SUCCESSFUL`, `Installed on 1 device` | Konsolenlog |
| AND-002 | Launch | Activity starten | WebView lädt App aus `file:///android_asset/webapp/index.html` | Screenshot + Log |
| AND-003 | Assets | CSS/JS laden | Kein CORS-/Asset-Blocker, App wird sichtbar | Logcat + Screenshot |
| AND-004 | Base44 Offline | Ohne Base44 Env starten | Lokale UI wird nach Network Error sichtbar, kein Endlos-Spinner | Screenshot + Log |
| AND-005 | Bridge | `window.VibeCoreNative` prüfen | Native Bridge ist verfügbar oder sauber als browser fallback erkannt | DevTools/Log |
| AND-006 | Engine | Native/WebAudio Start | Engine startet nach User-Gesture | Audio/Status |
| AND-007 | Permissions | Mikrofon anfragen | Host-Permission-Flow funktioniert | Screenshot |
| AND-008 | Lifecycle | App background/foreground | Kein Crash, Audio stoppt/pausiert erwartbar | Log + Audio |
| AND-009 | Back/Recents | App schließen | Kein Crash, keine hängende Audioausgabe | Logcat |
| AND-010 | Orientation | Rotation falls erlaubt | Layout bleibt nutzbar oder Rotation ist kontrolliert gesperrt | Screenshot |

## Nachweisordner pro Testlauf

Empfohlenes Schema:

```txt
evidence/
  YYYY-MM-DD_HH-mm_device-model_commit/
    00_context.txt
    01_build.log
    02_install.log
    03_launch.log
    screenshots/
      NAV-001_home.png
      SYN-012_keyboard.png
    videos/
      BAS-014_scroll.mp4
    logs/
      full_logcat.log
      console.log
    results.csv
```

`00_context.txt`:

```txt
Commit:
Device:
Android:
APK SHA-256:
Runtime:
Tester:
Audio volume:
Known warnings:
```

`results.csv` Spalten:

```csv
id,status,runtime,device,commit,evidence,notes
```

## Priorisierte Smoke-Suite

Diese 20 Fälle reichen als schneller Gate-Test nach jedem Build:

| Priorität | Fälle |
|---|---|
| P0 Launch | NAV-001, AND-001, AND-002, AND-003, AND-004 |
| P0 Bedienbarkeit | NAV-007, NAV-010, NAV-011, NAV-012, BAS-014 |
| P0 Instrumente | SYN-001, SYN-012, BAS-001, BAS-012 |
| P0 Transport | NAV-004, NAV-005, GRV-013, GRV-014 |
| P1 Workflows | GRV-003, MIX-003, FRG-002, DBG-001 |

## Erweiterungsregeln

Neue UI-Funktionen bekommen vor Merge mindestens:

1. Einen Matrix-Eintrag mit stabiler ID.
2. Eine erwartete sichtbare Wirkung.
3. Eine erwartete State-/Audio-/Dateiwirkung.
4. Einen konkreten Nachweisweg.
5. Ein Abbruchkriterium, falls Audio, Datei-I/O, Native Bridge oder KI beteiligt ist.

