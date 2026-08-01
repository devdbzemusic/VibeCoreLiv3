# MODULE UI — Component Library

**Wiederverwendbare UI-Komponenten für alle Module**
**Status:** Production Ready

---

## Core Components

### TopBar
- Logo + Version
- BPM Display (LCD-style, ±Buttons, Tap-Tempo)
- Arp Quick-Access (Mode + Complexity)
- Pattern/Scene Display
- Master Volume + Meters
- CPU/Voices Display
- Quality/FPS Indicator
- Diagnostics Toggle
- Transport (Record, Play, Stop)

### TabBar
- Hub-basierte Navigation (5 Hubs)
- Sub-Tab Strip (aktiver Hub)
- LED Indicators (tone-coded)
- Last-used sub-tab memory per hub

### PartStrip
- Horizontale Part-Auswahl
- Pro Part: Color-Dot, ID, Name
- Solo/Mute Indicators
- Touch-optimiert (min. 68px width, 40px height)

### ChannelStrip
- Volume, Pan, Pitch Fader
- Mute/Solo Buttons
- Send-Level Controls

## Reusable Patterns

### ParamSlider
```jsx
<ParamSlider label="PITCH" value={pitch} min={-24} max={24}
  onChange={(v) => setPartPitch(id, v)} />
```
- Panel-inset, label + value display
- `accent-primary` range input
- `touch-none` für präzises Drag

### Fader (Vertical)
- Vertikaler Fader für Mix-Tab
- Peak-Meter Overlay
- Schreibmodus `vertical-lr`

### Panel Sections
```jsx
<div className="panel p-3">
  <div className="flex items-center gap-2 mb-2">
    <Icon className="h-3.5 w-3.5 text-primary" />
    <span className="font-display text-xs text-primary">TITLE</span>
  </div>
  <div className="hairline mb-3" />
  {/* content */}
</div>
```

### AI Suggestion Card
```jsx
<div className="panel-inset p-3 rounded-md">
  <Sparkles className="h-3.5 w-3.5 text-primary" />
  <p className="font-mono text-[10px]">{description}</p>
  <button className="bg-gradient-primary">APPLY</button>
</div>
```

## Icons (lucide-react)

Verwendete Icons: Activity, Bot, Brain, Disc, FlaskConical, Grid3x3, Layers, Library, Mic, Orbit, Piano, Radio, Repeat, Settings, Shuffle, Sliders, Sparkles, Wand2, etc.

## Store Integration

Alle Komponenten greifen ausschließlich auf `useGroove()` zu. Keine eigene Business-Logik.