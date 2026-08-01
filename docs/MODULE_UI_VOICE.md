# VOICE Module UI Spec

## Overview
Vocal production surface: record, pitch-shift, harmonize, layer, phrase-generate. One-touch record requires no pre-configuration.

## 3-Touch Access
| Touch | Action |
|-------|--------|
| 1 | Tap the large red RECORD button (center-screen, 80×80px) |
| 2 | Tap an edit action in the horizontal toolbar (PITCH / HARMONY / LAYER / PHRASE) |
| 3 | Tap "APPLY · {tool}" to run AI on the selected action |

## Layout (top → bottom)
1. **Large record button** — 80×80px circular, red fill when recording, pulsing animation
2. **Waveform display** — `min-h-[120px] h-[24vw] max-h-[180px]`; animated bar visualization; shows ● REC / N NOTES / NO TAKE
3. **Horizontal editing toolbar** — 4 buttons equal-width below the waveform: PITCH · HARMONY · LAYER · PHRASE (44px height, icon + label)
4. **AI section** — `AiContextButton` "Improve Vocal" in header + full-width "APPLY · {tool}" button
5. **8-parameter sliders** — 2-column grid
6. **Takes list** — compact rows with step, note name, length, velocity; trash icon per take

## 8-Parameter Rule
| # | Label | Store mapping |
|---|-------|---------------|
| 1 | PITCH | `setPartPitch(id, v)` — ±24 semitones |
| 2 | VOLUME | `setPartVolume(id, v)` — 0–100% |
| 3 | PAN | `setPartPan(id, v)` — −50..+50 |
| 4 | FORMANT | `setChannel(id, { lpCut: v })` — 0–100 |
| 5 | STRETCH | `setWaveEdit(id, { timeStretch: v })` — 0–100 |
| 6 | DRIVE | `setChannel(id, { drive: v })` — 0–100 |
| 7 | REVERB | `setSend(id, 0, v)` — 0–100 |
| 8 | DELAY | `setSend(id, 1, v)` — 0–100 |

## Waveform Visualization
- 48 animated bars; height derived from note index and note count
- During recording: bars are `bg-neon-crimson/60` with `animationName: "pulse"` at varying durations and delays (pure CSS, no JS timer)
- With notes: bars are `bg-primary/40`
- Empty: bars are `bg-muted-foreground/20` at minimal height

## AI Actions (4)
| Key | Function called |
|-----|-----------------|
| PITCH | `suggestVocalPitch()` |
| HARMONY | `suggestVocalHarmony()` |
| LAYER | `suggestVocalLayer()` |
| PHRASE | `suggestVocalPhrase()` |

All log to `aiHistory` as "Vocal {tool}" from module "VOICE".

## Files
- `src/components/groovebox/VoiceTab.tsx`
- `src/lib/ai/voiceAssistant.ts`
