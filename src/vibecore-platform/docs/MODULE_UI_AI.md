# MODULE UI — AI

**Kontextbezogen · Unaufdringlich · Optional · Kein Chat**
**Status:** Production Ready

---

## Prinzip

AI erscheint ausschließlich kontextbezogen. Keine eigene Welt, keine Chat-Anwendung. AI-Vorschläge sind immer optional und werden über bestehende Store-Actions angewendet (immutable → rückgängig).

## AI-Integration pro Modul

| Modul | AI-Funktion | Vorschlag |
|-------|-------------|-----------|
| Groove | Groove AI | "Groove verbessern", Fills, Variationen |
| Synth | Sound AI | "Sound optimieren" |
| Bass | Melody AI | "Bassline erzeugen" |
| Sample Forge | Sample AI | "Slice-Vorschläge" |
| FX Mix Lab | Mix AI | "Mix-Vorschläge" |
| Voice | Voice AI | "Vocal verbessern" |
| Remix | Remix/Arrangement AI | "Arrangement erzeugen" |

## UI-Pattern

AI-Vorschläge erscheinen als:
1. **Action-Buttons** im jeweiligen Modul-Tab
2. **Beschreibungstext** mit musikalischer Begründung
3. **Apply-Button** zum Bestätigen
4. **Keine automatische Anwendung** — immer optional

## Design-Regeln

- AI-Section immer als `panel` mit `Wand2`/`Sparkles` Icon
- "APPLY" als `bg-gradient-primary` Button
- Genre-Selector als `tab-pill` Buttons
- Ergebnis als `panel-inset` mit Beschreibungstext

## Realtime

- Alle AI-Berechnungen auf Control-Thread
- Keine Blockierung des Audiopfads
- AI liest Kontext (`buildContext()`) und erzeugt Vorschläge
- Anwendung via Store-Actions (keine direkten Audio-Mutationen)