# diagrams/ — Quell-Diagramme

Primärnotation **Mermaid** (`.mmd`) für Architektur-/Fluss-/Zustandsdiagramme. **PlantUML** (`.puml`) für komplexe Sequenzdiagramme (in `exports/` gerendert). Diagramme sind versioniert wie Code.

## Struktur
- `architecture/` — Schichten, Systemgrenzen, Layer-Modell
- `dsp/` — Signal-Fluss, Modulations-Graph
- `runtime/` — Threads, State, Lifecycle
- `ui/` — Komponenten, Navigation, User-Journey
- `sync/` — Clock-Distribution, Time-Lines, PLL
- `sdk/` — API-Struktur, Modul-Interfaces
- `exports/` — gerenderte PDF/PNG (Release-Exemplare)

## Verwendete Diagramme
| Datei | Inhalt | referenziert in |
|---|---|---|
| `architecture/layer-model.mmd` | 5-Schichten-Modell | 02_Architecture |
| `runtime/thread-model.mmd` | Threads & Pfade | 02_Architecture |
| `sync/clock-distribution.mmd` | Sync-Verteilung | 04_Sync_Engine |

## Render-Hinweis
Mermaid wird direkt in Markdown gerendert; PlantUML via `plantuml.jar` → `exports/`. CI prüft Syntax.